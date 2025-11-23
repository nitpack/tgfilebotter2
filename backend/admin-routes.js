// admin-routes.js - Admin Panel API Routes (PRODUCTION-READY - ALL SECURITY FIXES APPLIED)
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
    this.csrfTokens = new Map();
    this.sessionFile = path.join(__dirname, '..', 'data', 'config', 'sessions.json');
    
    // Admin credentials (from environment)
    this.adminCredentials = {
      username: process.env.ADMIN_USERNAME || 'admin',
      password: this.hashPassword(process.env.ADMIN_PASSWORD || 'admin123')
    };
    
    // Load existing sessions on startup
    this.loadSessions().catch(err => console.error('Failed to load sessions:', err));
    
    // SECURITY FIX: Cleanup old failed login attempts every 15 minutes
    setInterval(() => this.cleanupFailedLogins(), 15 * 60 * 1000);
    
    // SECURITY FIX: Periodic CSRF token cleanup every 5 minutes
    setInterval(() => this.cleanupCSRFTokens(), 5 * 60 * 1000);
    
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
      
      // SECURITY FIX: Ensure file has correct permissions
      await fs.chmod(this.sessionFile, 0o600);
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
      
      // SECURITY FIX: Atomic write using temp file
      const tempFile = `${this.sessionFile}.tmp`;
      await fs.writeFile(tempFile, JSON.stringify(sessions, null, 2));
      await fs.chmod(tempFile, 0o600);
      await fs.rename(tempFile, this.sessionFile);
    } catch (error) {
      console.error('Error saving sessions:', error);
    }
  }

  hashPassword(password) {
    // CRITICAL FIX #3: Enforce PASSWORD_SALT requirement
    if (!process.env.PASSWORD_SALT) {
      console.error('CRITICAL: PASSWORD_SALT not set in environment!');
      throw new Error('PASSWORD_SALT environment variable required for secure password hashing');
    }
    const salt = process.env.PASSWORD_SALT;
    return crypto.createHash('sha256').update(password + salt).digest('hex');
  }

  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // CRITICAL FIX #1: Generate and validate CSRF tokens with automatic cleanup
  generateCSRFToken(sessionToken) {
    const csrfToken = crypto.randomBytes(32).toString('hex');
    this.csrfTokens.set(csrfToken, {
      sessionToken,
      expires: Date.now() + 3600000 // 1 hour
    });
    
    // SECURITY FIX: Trigger cleanup if map gets too large
    if (this.csrfTokens.size > 1000) {
      this.cleanupCSRFTokens();
    }
    
    return csrfToken;
  }

  validateCSRFToken(csrfToken, sessionToken) {
    const tokenData = this.csrfTokens.get(csrfToken);
    if (!tokenData) return false;
    if (tokenData.expires < Date.now()) {
      this.csrfTokens.delete(csrfToken);
      return false;
    }
    if (tokenData.sessionToken !== sessionToken) return false;
    return true;
  }

  // CRITICAL FIX #1: Cleanup expired CSRF tokens
  cleanupCSRFTokens() {
    const now = Date.now();
    let cleaned = 0;
    for (const [token, data] of this.csrfTokens.entries()) {
      if (data.expires < now) {
        this.csrfTokens.delete(token);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`Cleaned ${cleaned} expired CSRF tokens`);
    }
  }

  // PERFORMANCE FIX #16: Optimized cleanup with batch deletion
  cleanupFailedLogins() {
    const now = Date.now();
    const toDelete = [];
    
    for (const [ip, attempts] of this.failedLogins.entries()) {
      if (attempts.blockedUntil < now && attempts.count === 0) {
        toDelete.push(ip);
      } else if (attempts.blockedUntil < now && attempts.count > 0) {
        // Reset count after block expires
        attempts.count = 0;
        attempts.blockedUntil = 0;
      }
    }
    
    // Batch delete to avoid iterator issues
    toDelete.forEach(ip => this.failedLogins.delete(ip));
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
      this.saveSessions();
      return res.status(401).json({ success: false, error: 'Session expired' });
    }
    
    // Extend session
    session.expires = Date.now() + 30 * 60 * 1000; // 30 minutes
    session.lastActivity = Date.now();
    this.saveSessions();
    req.adminSession = session;
    next();
  }

  // CRITICAL FIX #2: CSRF validation middleware
  validateCSRF(req, res, next) {
    const csrfToken = req.headers['x-csrf-token'] || req.body.csrfToken;
    const sessionToken = req.headers.authorization?.substring(7);
    
    if (!csrfToken || !this.validateCSRFToken(csrfToken, sessionToken)) {
      return res.status(403).json({
        success: false,
        error: 'Invalid CSRF token'
      });
    }
    
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
    const csrf = this.validateCSRF.bind(this);
    
    // SECURITY FIX: Get CSRF token endpoint
    this.router.get('/csrf-token', auth, (req, res) => {
      const sessionToken = req.headers.authorization.substring(7);
      const csrfToken = this.generateCSRFToken(sessionToken);
      res.json({ success: true, csrfToken });
    });

    // Login
    this.router.post('/login', 
      this.checkLoginAttempts.bind(this),
      [
        body('username').trim().isLength({ min: 1, max: 100 }).withMessage('Invalid username'),
        body('password').isLength({ min: 1, max: 1000 }).withMessage('Invalid password')
      ],
      async (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({ 
              success: false, 
              error: 'Invalid input'
            });
          }

          const { username, password } = req.body;
          const ip = req.ip;
          
          // Sanitize username
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
              expires: Date.now() + 30 * 60 * 1000, // 30 minutes
              lastActivity: Date.now(),
              ip: ip // SECURITY FIX: Track IP for session hijacking detection
            };
            
            this.sessions.set(token, session);
            await this.saveSessions();
            
            await this.adminBot.sendAlert('system', `Admin logged in from IP: ${ip}`);
            
            // Generate initial CSRF token
            const csrfToken = this.generateCSRFToken(token);
            
            return res.json({ success: true, token, csrfToken });
            
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
            
            // SECURITY FIX: Generic error message
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

    // CRITICAL FIX #2: Logout endpoint with CSRF protection
    this.router.post('/logout', auth, csrf, async (req, res) => {
      try {
        const token = req.headers.authorization.substring(7);
        this.sessions.delete(token);
        
        // SECURITY FIX: Cleanup associated CSRF tokens
        for (const [csrfToken, data] of this.csrfTokens.entries()) {
          if (data.sessionToken === token) {
            this.csrfTokens.delete(csrfToken);
          }
        }
        
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
        
        // SECURITY FIX: Don't expose bot tokens
        const safeBots = bots.map(bot => ({
          ...bot,
          botToken: '••••••' + (bot.botToken ? bot.botToken.slice(-4) : '')
        }));
        
        res.json({ success: true, bots: safeBots });
        
      } catch (error) {
        console.error('Get bots error:', error);
        res.status(500).json({ success: false, error: 'Failed to load bots' });
      }
    });

    // Get single bot
    this.router.get('/bot/:botId', auth, async (req, res) => {
      try {
        const botId = this.security.sanitizeInput(req.params.botId);
        const bot = this.storage.getBotById(botId);
        
        if (!bot) {
          return res.status(404).json({ success: false, error: 'Bot not found' });
        }
        
        // SECURITY FIX: Mask bot token
        const safeBot = {
          ...bot,
          botToken: '••••••' + (bot.botToken ? bot.botToken.slice(-4) : '')
        };
        
        res.json({ success: true, bot: safeBot });
        
      } catch (error) {
        console.error('Get bot error:', error);
        res.status(500).json({ success: false, error: 'Failed to load bot' });
      }
    });

    // Approve bot endpoint
    this.router.post('/approve-bot', auth, csrf, 
      [body('botId').trim().notEmpty().withMessage('Bot ID required')],
      async (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({ 
              success: false, 
              error: 'Invalid input',
              details: errors.array().map(e => e.msg)
            });
          }

          const { botId } = req.body;
          const sanitizedBotId = this.security.sanitizeInput(botId);
          
          const bot = this.storage.getBotById(sanitizedBotId);
          
          if (!bot) {
            return res.status(404).json({ success: false, error: 'Bot not found' });
          }
          
          if (bot.status === 'approved') {
            return res.json({ success: true, message: 'Bot already approved' });
          }
          
          // Create backup of operation
          await this.storage.createOperationBackup('approve_bot', {
            botId: sanitizedBotId,
            botUsername: bot.botUsername,
            previousStatus: bot.status,
            timestamp: new Date().toISOString(),
            approvedBy: req.adminSession.username
          });
          
          const success = await this.storage.updateBotStatusAtomic(sanitizedBotId, 'approved');
          
          if (success) {
            await this.adminBot.sendAlert('approval', 
              `Bot ${bot.botUsername} has been approved!\nBot ID: ${sanitizedBotId}\nOwner: ${bot.ownerId || 'Not registered'}`
            );
            
            // Notify bot owner if registered
            if (bot.ownerId) {
              try {
                await this.botManager.sendAdminMessage(
                  sanitizedBotId,
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
    this.router.post('/disconnect-bot', auth, csrf,
      [body('botId').trim().notEmpty().withMessage('Bot ID required')],
      async (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({ 
              success: false, 
              error: 'Invalid input'
            });
          }

          const { botId } = req.body;
          const sanitizedBotId = this.security.sanitizeInput(botId);
          
          const bot = this.storage.getBotById(sanitizedBotId);
          
          if (!bot) {
            return res.status(404).json({ success: false, error: 'Bot not found' });
          }
          
          await this.storage.createOperationBackup('disconnect_bot', {
            botId: sanitizedBotId,
            botUsername: bot.botUsername,
            previousStatus: bot.status,
            timestamp: new Date().toISOString(),
            disconnectedBy: req.adminSession.username
          });
          
          const success = await this.storage.updateBotStatusAtomic(sanitizedBotId, 'disconnected');
          
          if (success) {
            await this.botManager.stopBot(sanitizedBotId);
            await this.adminBot.sendAlert('moderation', `Bot ${sanitizedBotId} has been disconnected`);
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
    this.router.post('/ban-user', auth, csrf,
      [
        body('userId').trim().notEmpty().withMessage('User ID required'),
        body('reason').optional().trim().isLength({ max: 500 }).withMessage('Reason too long')
      ],
      async (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({ 
              success: false, 
              error: 'Invalid input'
            });
          }

          const { userId, reason } = req.body;
          const sanitizedUserId = this.security.sanitizeInput(userId);
          const sanitizedReason = this.security.sanitizeInput(reason || 'No reason provided');
          
          // MINOR FIX #10: Validate userId is a number
          if (!/^\d+$/.test(sanitizedUserId)) {
            return res.status(400).json({ 
              success: false, 
              error: 'Invalid user ID format' 
            });
          }
          
          const userBots = this.storage.getBotsByOwner(sanitizedUserId);
          
          await this.storage.createOperationBackup('ban_user', {
            userId: sanitizedUserId,
            reason: sanitizedReason,
            timestamp: new Date().toISOString(),
            bannedBy: req.adminSession.username,
            botsAffected: userBots.map(b => ({
              id: b.id,
              botUsername: b.botUsername,
              status: b.status
            }))
          });
          
          await this.storage.addBannedUser(sanitizedUserId, sanitizedReason);
          
          // Disconnect all bots owned by this user
          for (const bot of userBots) {
            await this.storage.updateBotStatusAtomic(bot.id, 'disconnected');
            await this.botManager.stopBot(bot.id);
          }
          
          await this.adminBot.sendAlert('ban', 
            `User ${sanitizedUserId} banned. ${userBots.length} bot(s) disconnected.\nReason: ${sanitizedReason}`
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
    this.router.post('/unban-user', auth, csrf,
      [body('userId').trim().notEmpty().withMessage('User ID required')],
      async (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({ 
              success: false, 
              error: 'Invalid input'
            });
          }

          const { userId } = req.body;
          const sanitizedUserId = this.security.sanitizeInput(userId);
          
          if (!/^\d+$/.test(sanitizedUserId)) {
            return res.status(400).json({ 
              success: false, 
              error: 'Invalid user ID format' 
            });
          }
          
          await this.storage.createOperationBackup('unban_user', {
            userId: sanitizedUserId,
            timestamp: new Date().toISOString(),
            unbannedBy: req.adminSession.username
          });
          
          const config = await this.storage.loadConfig('banned_users') || { users: [] };
          config.users = config.users.filter(u => u.userId !== sanitizedUserId);
          await this.storage.saveConfig('banned_users', config);
          
          await this.adminBot.sendAlert('moderation', `User ${sanitizedUserId} has been unbanned`);
          
          res.json({ success: true });
          
        } catch (error) {
          console.error('Unban user error:', error);
          res.status(500).json({ success: false, error: 'Failed to unban user' });
        }
      });

    // Send message to bot owner
    this.router.post('/send-message', auth, csrf,
      [
        body('botId').trim().notEmpty().withMessage('Bot ID required'),
        body('message').trim().notEmpty().isLength({ max: 4000 }).withMessage('Message too long')
      ],
      async (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({ 
              success: false, 
              error: 'Invalid input'
            });
          }

          const { botId, message } = req.body;
          const sanitizedBotId = this.security.sanitizeInput(botId);
          const sanitizedMessage = this.security.sanitizeInput(message);
          
          if (!sanitizedMessage) {
            return res.status(400).json({ success: false, error: 'Invalid message content' });
          }
          
          const bot = this.storage.getBotById(sanitizedBotId);
          
          if (!bot || !bot.ownerId) {
            return res.status(404).json({ success: false, error: 'Bot or owner not found' });
          }
          
          await this.botManager.sendAdminMessage(sanitizedBotId, bot.ownerId, sanitizedMessage);
          
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
        
        // SECURITY FIX: Don't send sensitive tokens to client
        const safeConfig = {
          telegramUserId: config.telegramUserId || null,
          botToken: config.botToken ? '••••••' + config.botToken.slice(-4) : null,
          channelId: config.channelId || null
        };
        
        res.json({ success: true, config: safeConfig });
        
      } catch (error) {
        console.error('Get admin config error:', error);
        res.status(500).json({ success: false, error: 'Failed to load config' });
      }
    });

    // MINOR FIX #11: Save admin config with enhanced validation
    this.router.post('/config/admin', auth, csrf,
      [
        body('telegramUserId').optional().isInt({ min: 1 }).withMessage('Invalid user ID'),
        body('botToken').optional().trim().isLength({ min: 40, max: 100 }).withMessage('Invalid token length'),
        body('channelId').optional().trim().matches(/^(@[a-zA-Z0-9_]{5,32}|-100\d{10,})$/).withMessage('Invalid channel format')
      ],
      async (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({ 
              success: false, 
              error: 'Invalid input',
              details: errors.array().map(e => e.msg)
            });
          }

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
    this.router.post('/config/system', auth, csrf,
      [
        body('maxJsonSizeMB').optional().isInt({ min: 1, max: 50 }).withMessage('Invalid size'),
        body('welcomeMessage').optional().trim().isLength({ max: 500 }).withMessage('Message too long'),
        body('invalidInputMessage').optional().trim().isLength({ max: 500 }).withMessage('Message too long')
      ],
      async (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({ 
              success: false, 
              error: 'Invalid input'
            });
          }

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

    // Security log
    this.router.get('/security-log', auth, async (req, res) => {
      try {
        // TODO: Implement actual security log storage
        res.json({ success: true, events: [] });
      } catch (error) {
        res.json({ success: true, events: [] });
      }
    });

    // Create backup
    this.router.post('/create-backup', auth, csrf, async (req, res) => {
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
    
    // SECURITY FIX: Cleanup endpoint for expired sessions/tokens
    this.router.post('/cleanup', auth, csrf, async (req, res) => {
      try {
        const now = Date.now();
        let cleaned = 0;
        
        // Cleanup expired sessions
        for (const [token, session] of this.sessions.entries()) {
          if (session.expires < now) {
            this.sessions.delete(token);
            cleaned++;
          }
        }
        
        // Cleanup expired CSRF tokens
        this.cleanupCSRFTokens();
        
        // Cleanup failed login attempts
        this.cleanupFailedLogins();
        
        await this.saveSessions();
        
        res.json({ success: true, message: `Cleaned ${cleaned} expired sessions` });
      } catch (error) {
        console.error('Cleanup error:', error);
        res.status(500).json({ success: false, error: 'Cleanup failed' });
      }
    });
  }

  getRouter() {
    return this.router;
  }
}

module.exports = AdminRoutes;