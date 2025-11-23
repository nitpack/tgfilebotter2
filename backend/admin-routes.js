// admin-routes.js - Admin Panel API Routes (FIXED VERSION)
// FIXES: Session persistence, input validation, missing approve endpoint, operation backups
const express = require('express');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const fs = require('fs').promises;
const path = require('path');

class AdminRoutes {
  constructor(storage, config, botManager, adminBot, security) {
    this.router = express.Router();
    this.storage = storage;
    this.config = config;
    this.botManager = botManager;
    this.adminBot = adminBot;
    this.security = security;
    
    // Session storage with persistence
    this.sessions = new Map();
    this.failedLogins = new Map();
    this.sessionFile = path.join(__dirname, '..', 'data', 'config', 'sessions.json');
    
    // Admin credentials (should be from environment)
    this.adminCredentials = {
      username: process.env.ADMIN_USERNAME || 'admin',
      password: this.hashPassword(process.env.ADMIN_PASSWORD || 'admin123')
    };
    
    // Load existing sessions on startup
    this.loadSessions().catch(err => console.error('Failed to load sessions:', err));
    
    this.setupRoutes();
  }

  async loadSessions() {
    try {
      const data = await fs.readFile(this.sessionFile, 'utf8');
      const sessions = JSON.parse(data);
      const now = Date.now();
      
      // Restore non-expired sessions
      for (const [token, session] of Object.entries(sessions)) {
        if (session.expires > now) {
          this.sessions.set(token, session);
        }
      }
      console.log(`✓ Restored ${this.sessions.size} active admin sessions`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error loading sessions:', error);
      }
    }
  }

  async saveSessions() {
    try {
      const sessions = {};
      for (const [token, session] of this.sessions.entries()) {
        sessions[token] = session;
      }
      await fs.writeFile(this.sessionFile, JSON.stringify(sessions, null, 2));
    } catch (error) {
      console.error('Error saving sessions:', error);
    }
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
      this.saveSessions(); // Persist deletion
      return res.status(401).json({ success: false, error: 'Session expired' });
    }
    
    // Extend session
    session.expires = Date.now() + 30 * 60 * 1000; // 30 minutes
    this.saveSessions(); // Persist extension
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
        
        // FIXED: Input validation
        if (!username || typeof username !== 'string' || username.length > 100) {
          return res.status(400).json({ success: false, error: 'Invalid username' });
        }
        
        if (!password || typeof password !== 'string' || password.length > 1000) {
          return res.status(400).json({ success: false, error: 'Invalid password' });
        }
        
        // Sanitize username (but not password - may contain special chars)
        const cleanUsername = this.security.sanitizeInput(username);
        if (!cleanUsername) {
          return res.status(400).json({ success: false, error: 'Invalid username format' });
        }
        
        const hashedPassword = this.hashPassword(password);
        
        if (cleanUsername === this.adminCredentials.username && 
            hashedPassword === this.adminCredentials.password) {
          
          // Clear failed attempts
          this.failedLogins.delete(ip);
          
          // Create session
          const token = this.generateToken();
          const session = {
            token,
            username: cleanUsername,
            created: Date.now(),
            expires: Date.now() + 30 * 60 * 1000 // 30 minutes
          };
          
          this.sessions.set(token, session);
          await this.saveSessions(); // FIXED: Persist to disk
          
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

    // Logout endpoint (clear session)
    this.router.post('/logout', auth, async (req, res) => {
      try {
        const token = req.headers.authorization.substring(7);
        this.sessions.delete(token);
        await this.saveSessions();
        res.json({ success: true, message: 'Logged out successfully' });
      } catch (error) {
        res.status(500).json({ success: false, error: 'Logout failed' });
      }
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

    // FIXED: NEW - Approve bot endpoint
    this.router.post('/approve-bot', auth, async (req, res) => {
      try {
        const { botId } = req.body;
        
        if (!botId) {
          return res.status(400).json({ success: false, error: 'Bot ID required' });
        }
        
        const bot = this.storage.getBotById(botId);
        
        if (!bot) {
          return res.status(404).json({ success: false, error: 'Bot not found' });
        }
        
        if (bot.status === 'approved') {
          return res.json({ success: true, message: 'Bot already approved' });
        }
        
        // Create backup of operation
        await this.storage.createOperationBackup('approve_bot', {
          botId,
          botUsername: bot.botUsername,
          previousStatus: bot.status,
          timestamp: new Date().toISOString(),
          approvedBy: req.adminSession.username
        });
        
        // Update status to approved
        const success = await this.storage.updateBotStatusAtomic(botId, 'approved');
        
        if (success) {
          await this.adminBot.sendAlert('approval', 
            `Bot ${bot.botUsername} has been approved!\n` +
            `Bot ID: ${botId}\n` +
            `Owner: ${bot.ownerId || 'Not registered'}`
          );
          
          // Notify bot owner if registered
          if (bot.ownerId) {
            try {
              await this.botManager.sendAdminMessage(
                botId,
                bot.ownerId,
                '🎉 Your bot has been approved! It is now public and available to all users.'
              );
            } catch (error) {
              console.error('Failed to notify bot owner:', error);
            }
          }
          
          return res.json({ 
            success: true,
            message: 'Bot approved successfully'
          });
        } else {
          return res.status(500).json({ 
            success: false, 
            error: 'Failed to update bot status' 
          });
        }
        
      } catch (error) {
        console.error('Approve bot error:', error);
        res.status(500).json({ success: false, error: 'Failed to approve bot' });
      }
    });

    // Disconnect bot
    this.router.post('/disconnect-bot', auth, async (req, res) => {
      try {
        const { botId } = req.body;
        
        if (!botId) {
          return res.status(400).json({ success: false, error: 'Bot ID required' });
        }
        
        const bot = this.storage.getBotById(botId);
        
        if (!bot) {
          return res.status(404).json({ success: false, error: 'Bot not found' });
        }
        
        // Create backup of operation
        await this.storage.createOperationBackup('disconnect_bot', {
          botId,
          botUsername: bot.botUsername,
          previousStatus: bot.status,
          timestamp: new Date().toISOString(),
          disconnectedBy: req.adminSession.username
        });
        
        const success = await this.storage.updateBotStatusAtomic(botId, 'disconnected');
        
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
        
        // Get user's bots before banning (for backup)
        const userBots = this.storage.getBotsByOwner(userId);
        
        // FIXED: Create backup of operation
        await this.storage.createOperationBackup('ban_user', {
          userId,
          reason: reason || 'No reason provided',
          timestamp: new Date().toISOString(),
          bannedBy: req.adminSession.username,
          botsAffected: userBots.map(b => ({
            id: b.id,
            botUsername: b.botUsername,
            status: b.status
          }))
        });
        
        // Add to banned list
        await this.storage.addBannedUser(userId, reason || 'No reason provided');
        
        // Disconnect all bots owned by this user
        for (const bot of userBots) {
          await this.storage.updateBotStatusAtomic(bot.id, 'disconnected');
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
        
        // Create backup of operation
        await this.storage.createOperationBackup('unban_user', {
          userId,
          timestamp: new Date().toISOString(),
          unbannedBy: req.adminSession.username
        });
        
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
        const fsSync = require('fs');
        const backupsDir = path.join(__dirname, '..', 'data', 'backups');
        
        const dirs = fsSync.readdirSync(backupsDir);
        const backups = [];
        
        for (const dir of dirs) {
          if (dir.startsWith('backup_')) {
            try {
              const manifestPath = path.join(backupsDir, dir, 'manifest.json');
              const manifest = JSON.parse(fsSync.readFileSync(manifestPath, 'utf8'));
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
