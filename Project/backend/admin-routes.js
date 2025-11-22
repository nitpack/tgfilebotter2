// admin-routes.js - Admin Panel API Routes
const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');

class AdminRoutes {
  constructor(storage, config, botManager, adminBot, security) {
    this.router = express.Router();
    this.storage = storage;
    this.config = config;
    this.botManager = botManager;
    this.adminBot = adminBot;
    this.security = security;
    
    // Session storage (in-memory for now)
    this.sessions = new Map();
    this.failedLogins = new Map();
    
    // Admin credentials (should be in config, but hardcoded for initial setup)
    this.adminCredentials = {
      username: process.env.ADMIN_USERNAME || 'admin',
      password: this.hashPassword(process.env.ADMIN_PASSWORD || 'admin123')
    };
    
    this.setupRoutes();
  }

  hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Middleware: Check authentication
  authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    
    const token = authHeader.substring(7);
    const session = this.sessions.get(token);
    
    if (!session || Date.now() > session.expires) {
      this.sessions.delete(token);
      return res.status(401).json({ success: false, error: 'Session expired' });
    }
    
    // Extend session
    session.expires = Date.now() + 30 * 60 * 1000; // 30 minutes
    req.adminSession = session;
    next();
  }

  // Middleware: Rate limit login attempts
  checkLoginAttempts(req, res, next) {
    const ip = req.ip;
    const attempts = this.failedLogins.get(ip) || { count: 0, blockedUntil: 0 };
    
    if (attempts.blockedUntil > Date.now()) {
      const waitTime = Math.ceil((attempts.blockedUntil - Date.now()) / 1000 / 60);
      return res.status(429).json({
        success: false,
        error: `Too many failed attempts. Try again in ${waitTime} minutes.`
      });
    }
    
    next();
  }

  setupRoutes() {
    const auth = this.authenticate.bind(this);
    
    // Login
    this.router.post('/login', this.checkLoginAttempts.bind(this), async (req, res) => {
      try {
        const { username, password } = req.body;
        const ip = req.ip;
        
        if (!username || !password) {
          return res.status(400).json({ success: false, error: 'Missing credentials' });
        }
        
        const hashedPassword = this.hashPassword(password);
        
        if (username === this.adminCredentials.username && 
            hashedPassword === this.adminCredentials.password) {
          
          // Clear failed attempts
          this.failedLogins.delete(ip);
          
          // Create session
          const token = this.generateToken();
          const session = {
            token,
            username,
            created: Date.now(),
            expires: Date.now() + 30 * 60 * 1000 // 30 minutes
          };
          
          this.sessions.set(token, session);
          
          await this.adminBot.sendAlert('system', `Admin logged in from IP: ${ip}`);
          
          return res.json({ success: true, token });
          
        } else {
          // Track failed attempt
          const attempts = this.failedLogins.get(ip) || { count: 0, blockedUntil: 0 };
          attempts.count++;
          
          if (attempts.count >= 5) {
            attempts.blockedUntil = Date.now() + 15 * 60 * 1000; // 15 minutes
            await this.adminBot.sendSecurityAlert('HIGH', 'Login Attack', 
              `Multiple failed login attempts from IP: ${ip}`);
          }
          
          this.failedLogins.set(ip, attempts);
          
          return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }
        
      } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ success: false, error: 'Login failed' });
      }
    });

    // Verify session
    this.router.get('/verify', auth, (req, res) => {
      res.json({ success: true });
    });

    // Get statistics
    this.router.get('/stats', auth, async (req, res) => {
      try {
        const allBots = this.storage.getAllBots();
        const bannedUsers = await this.storage.getBannedUsers();
        
        const stats = {
          total: allBots.length,
          approved: allBots.filter(b => b.status === 'approved').length,
          pending: allBots.filter(b => b.status === 'pending').length,
          disconnected: allBots.filter(b => b.status === 'disconnected').length,
          bannedUsers: bannedUsers.length
        };
        
        res.json({ success: true, stats });
        
      } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ success: false, error: 'Failed to load stats' });
      }
    });

    // Get recent activity
    this.router.get('/activity', auth, async (req, res) => {
      try {
        // This would normally come from a log file
        // For now, return recent bots
        const allBots = this.storage.getAllBots();
        const recent = allBots
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          .slice(0, 10)
          .map(bot => ({
            timestamp: bot.createdAt,
            message: `New bot created: ${bot.botUsername}`,
            severity: 'low'
          }));
        
        res.json({ success: true, activity: recent });
        
      } catch (error) {
        res.json({ success: true, activity: [] });
      }
    });

    // Get bots
    this.router.get('/bots', auth, async (req, res) => {
      try {
        const { status } = req.query;
        let bots = this.storage.getAllBots();
        
        if (status && status !== 'all') {
          bots = bots.filter(b => b.status === status);
        }
        
        res.json({ success: true, bots });
        
      } catch (error) {
        console.error('Get bots error:', error);
        res.status(500).json({ success: false, error: 'Failed to load bots' });
      }
    });

    // Get single bot
    this.router.get('/bot/:botId', auth, async (req, res) => {
      try {
        const bot = this.storage.getBotById(req.params.botId);
        
        if (!bot) {
          return res.status(404).json({ success: false, error: 'Bot not found' });
        }
        
        res.json({ success: true, bot });
        
      } catch (error) {
        console.error('Get bot error:', error);
        res.status(500).json({ success: false, error: 'Failed to load bot' });
      }
    });

    // Disconnect bot
    this.router.post('/disconnect-bot', auth, async (req, res) => {
      try {
        const { botId } = req.body;
        
        if (!botId) {
          return res.status(400).json({ success: false, error: 'Bot ID required' });
        }
        
        const success = this.storage.updateBotStatus(botId, 'disconnected');
        
        if (success) {
          await this.adminBot.sendAlert('moderation', `Bot ${botId} has been disconnected`);
          return res.json({ success: true });
        } else {
          return res.status(404).json({ success: false, error: 'Bot not found' });
        }
        
      } catch (error) {
        console.error('Disconnect bot error:', error);
        res.status(500).json({ success: false, error: 'Failed to disconnect bot' });
      }
    });

    // Ban user
    this.router.post('/ban-user', auth, async (req, res) => {
      try {
        const { userId, reason } = req.body;
        
        if (!userId) {
          return res.status(400).json({ success: false, error: 'User ID required' });
        }
        
        // Add to banned list
        await this.storage.addBannedUser(userId, reason || 'No reason provided');
        
        // Disconnect all bots owned by this user
        const userBots = this.storage.getBotsByOwner(userId);
        for (const bot of userBots) {
          this.storage.updateBotStatus(bot.id, 'disconnected');
          await this.botManager.stopBot(bot.id);
        }
        
        await this.adminBot.sendAlert('ban', 
          `User ${userId} banned. ${userBots.length} bot(s) disconnected.\nReason: ${reason}`
        );
        
        res.json({ success: true, botsDisconnected: userBots.length });
        
      } catch (error) {
        console.error('Ban user error:', error);
        res.status(500).json({ success: false, error: 'Failed to ban user' });
      }
    });

    // Get banned users
    this.router.get('/banned-users', auth, async (req, res) => {
      try {
        const users = await this.storage.getBannedUsers();
        res.json({ success: true, users });
      } catch (error) {
        console.error('Get banned users error:', error);
        res.status(500).json({ success: false, error: 'Failed to load banned users' });
      }
    });

    // Unban user
    this.router.post('/unban-user', auth, async (req, res) => {
      try {
        const { userId } = req.body;
        
        if (!userId) {
          return res.status(400).json({ success: false, error: 'User ID required' });
        }
        
        // Remove from banned list
        const config = await this.storage.loadConfig('banned_users') || { users: [] };
        config.users = config.users.filter(u => u.userId !== userId);
        await this.storage.saveConfig('banned_users', config);
        
        await this.adminBot.sendAlert('moderation', `User ${userId} has been unbanned`);
        
        res.json({ success: true });
        
      } catch (error) {
        console.error('Unban user error:', error);
        res.status(500).json({ success: false, error: 'Failed to unban user' });
      }
    });

    // Send message to bot owner
    this.router.post('/send-message', auth, async (req, res) => {
      try {
        const { botId, message } = req.body;
        
        if (!botId || !message) {
          return res.status(400).json({ success: false, error: 'Bot ID and message required' });
        }
        
        const bot = this.storage.getBotById(botId);
        
        if (!bot || !bot.ownerId) {
          return res.status(404).json({ success: false, error: 'Bot or owner not found' });
        }
        
        // Sanitize message
        const sanitizedMessage = this.security.sanitizeInput(message);
        if (!sanitizedMessage) {
          return res.status(400).json({ success: false, error: 'Invalid message content' });
        }
        
        await this.botManager.sendAdminMessage(botId, bot.ownerId, sanitizedMessage);
        
        res.json({ success: true });
        
      } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ success: false, error: 'Failed to send message' });
      }
    });

    // Get admin config
    this.router.get('/config/admin', auth, async (req, res) => {
      try {
        const config = await this.storage.loadConfig('admin') || {};
        
        // Don't send sensitive tokens to client
        const safeConfig = {
          telegramUserId: config.telegramUserId || null,
          botToken: config.botToken ? '••••••••' : null,
          channelId: config.channelId || null
        };
        
        res.json({ success: true, config: safeConfig });
        
      } catch (error) {
        console.error('Get admin config error:', error);
        res.status(500).json({ success: false, error: 'Failed to load config' });
      }
    });

    // Save admin config
    this.router.post('/config/admin', auth, async (req, res) => {
      try {
        const { telegramUserId, botToken, channelId } = req.body;
        
        await this.config.setAdminConfig(telegramUserId, botToken, channelId);
        
        // Reinitialize admin bot with new config
        await this.adminBot.initialize();
        
        await this.adminBot.sendAlert('system', 'Admin configuration updated');
        
        res.json({ success: true });
        
      } catch (error) {
        console.error('Save admin config error:', error);
        res.status(500).json({ success: false, error: 'Failed to save config' });
      }
    });

    // Get system config
    this.router.get('/config/system', auth, async (req, res) => {
      try {
        const config = this.config.getSystemSettings();
        res.json({ success: true, config });
      } catch (error) {
        console.error('Get system config error:', error);
        res.status(500).json({ success: false, error: 'Failed to load config' });
      }
    });

    // Save system config
    this.router.post('/config/system', auth, async (req, res) => {
      try {
        const { maxJsonSizeMB, welcomeMessage, invalidInputMessage } = req.body;
        
        if (maxJsonSizeMB) {
          await this.config.setMaxJsonSize(maxJsonSizeMB);
        }
        
        if (welcomeMessage) {
          await this.config.setWelcomeMessage(welcomeMessage);
        }
        
        if (invalidInputMessage) {
          await this.config.setInvalidInputMessage(invalidInputMessage);
        }
        
        await this.adminBot.sendAlert('system', 'System configuration updated');
        
        res.json({ success: true });
        
      } catch (error) {
        console.error('Save system config error:', error);
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Security log (placeholder - would come from actual logging system)
    this.router.get('/security-log', auth, async (req, res) => {
      try {
        // This would normally read from a security log file
        // For now, return empty array
        res.json({ success: true, events: [] });
      } catch (error) {
        res.json({ success: true, events: [] });
      }
    });

    // Create backup
    this.router.post('/create-backup', auth, async (req, res) => {
      try {
        const result = await this.storage.createBackup();
        
        if (result.success) {
          await this.adminBot.sendBackupReport(result);
        }
        
        res.json(result);
        
      } catch (error) {
        console.error('Create backup error:', error);
        res.status(500).json({ success: false, error: 'Failed to create backup' });
      }
    });

    // Get backup history
    this.router.get('/backups', auth, async (req, res) => {
      try {
        const fs = require('fs').promises;
        const path = require('path');
        const backupsDir = path.join(__dirname, '..', 'data', 'backups');
        
        const dirs = await fs.readdir(backupsDir);
        const backups = [];
        
        for (const dir of dirs) {
          if (dir.startsWith('backup_')) {
            try {
              const manifestPath = path.join(backupsDir, dir, 'manifest.json');
              const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
              backups.push(manifest);
            } catch (e) {
              // Skip invalid backups
            }
          }
        }
        
        backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        res.json({ success: true, backups });
        
      } catch (error) {
        console.error('Get backups error:', error);
        res.json({ success: true, backups: [] });
      }
    });
  }

  getRouter() {
    return this.router;
  }
}

module.exports = AdminRoutes;