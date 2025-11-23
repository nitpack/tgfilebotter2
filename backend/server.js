// server.js - Main Backend Server Entry Point (PRODUCTION-READY WITH ALL FIXES)
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const path = require('path');
const crypto = require('crypto');

const BotManager = require('./bot-manager');
const Storage = require('./storage');
const Security = require('./security');
const Config = require('./config');
const AdminBot = require('./admin-bot');
const AdminRoutes = require('./admin-routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize core components
const storage = new Storage();
const security = new Security();
const config = new Config(storage);
const adminBot = new AdminBot(config, storage);
const botManager = new BotManager(storage, config, adminBot);

// Initialize admin routes
const adminRoutes = new AdminRoutes(storage, config, botManager, adminBot, security);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Trust proxy
app.set('trust proxy', 1);

// Request size limits with DoS protection
app.use(express.json({ 
  limit: '15mb',
  verify: (req, res, buf, encoding) => {
    try {
      const body = buf.toString(encoding || 'utf8');
      const depth = (body.match(/{/g) || []).length;
      if (depth > 100) {
        throw new Error('JSON too deeply nested');
      }
      if (/"[^"]{100000,}"/.test(body)) {
        throw new Error('JSON contains extremely long strings');
      }
    } catch (error) {
      throw error;
    }
  }
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  etag: true
}));

// Rate limiting - Global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
    });
  }
});

// Rate limiting - Upload endpoint
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Upload rate limit exceeded. Please try again later.',
  standardHeaders: true,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: 'Upload rate limit exceeded',
      retryAfter: Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000)
    });
  }
});

// MAJOR FIX #6: Rate limit metadata endpoint
const metadataLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many metadata requests.',
  standardHeaders: true
});

app.use(globalLimiter);

// PUBLIC ROUTES
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// MAJOR FIX #9: Detailed health check with authentication
app.get('/api/health/detailed', async (req, res) => {
  const token = req.query.token;
  
  // SECURITY FIX: Generate token on first startup or use env variable
  if (!global.HEALTH_CHECK_TOKEN) {
    global.HEALTH_CHECK_TOKEN = process.env.HEALTH_CHECK_TOKEN || 
      crypto.randomBytes(16).toString('hex');
    if (!process.env.HEALTH_CHECK_TOKEN) {
      console.log(`⚠ Generated health check token: ${global.HEALTH_CHECK_TOKEN}`);
      console.log('  Set HEALTH_CHECK_TOKEN in .env for persistent access');
    }
  }
  
  if (token !== global.HEALTH_CHECK_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {}
  };

  try {
    health.checks.botManager = {
      status: botManager.getActiveBotCount() >= 0 ? 'ok' : 'error',
      activeBots: botManager.getActiveBotCount()
    };

    try {
      const bots = storage.getAllBots();
      health.checks.storage = {
        status: 'ok',
        totalBots: bots.length
      };
    } catch (error) {
      health.checks.storage = {
        status: 'error',
        error: 'Storage check failed'
      };
      health.status = 'degraded';
    }

    health.checks.adminBot = {
      status: adminBot.isConfigured() ? 'ok' : 'not_configured'
    };

    const memUsage = process.memoryUsage();
    health.checks.memory = {
      status: memUsage.heapUsed < memUsage.heapTotal * 0.9 ? 'ok' : 'warning',
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`
    };

    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: 'Health check failed'
    });
  }
});

// Serve admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-panel.html'));
});

// API ROUTES
app.get('/api/csrf-token', (req, res) => {
  const token = crypto.randomBytes(32).toString('hex');
  res.json({ csrfToken: token });
});

// Bot metadata upload endpoint
app.post('/api/upload',
  uploadLimiter,
  [
    body('botToken')
      .trim()
      .notEmpty().withMessage('Bot token is required')
      .isLength({ max: 100 }).withMessage('Bot token too long')
      .matches(/^\d{8,10}:[A-Za-z0-9_-]{35}$/).withMessage('Invalid bot token format'),
    body('channelId')
      .trim()
      .notEmpty().withMessage('Channel ID is required')
      .isLength({ max: 50 }).withMessage('Channel ID too long')
      .matches(/^(@[a-zA-Z0-9_]{5,32}|-100\d{10,})$/).withMessage('Invalid channel ID format'),
    body('botUsername')
      .trim()
      .notEmpty().withMessage('Bot username is required')
      .matches(/^@[a-zA-Z0-9_]{5,32}$/).withMessage('Invalid bot username format'),
    body('metadata')
      .isObject().withMessage('Metadata must be an object')
      .custom((value) => {
        if (!value.hasOwnProperty('subfolders') || !value.hasOwnProperty('files')) {
          throw new Error('Invalid metadata structure');
        }
        return true;
      })
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        await adminBot.sendAlert('security', `Invalid upload attempt from IP: ${req.ip}`);
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid input data',
          details: errors.array().map(e => e.msg)
        });
      }

      const { botToken, channelId, botUsername, metadata } = req.body;

      const sanitizedToken = security.sanitizeInput(botToken);
      const sanitizedChannelId = security.sanitizeInput(channelId);
      const sanitizedUsername = security.sanitizeInput(botUsername);

      if (!sanitizedToken || !sanitizedChannelId || !sanitizedUsername) {
        return res.status(400).json({
          success: false,
          error: 'Input sanitization failed'
        });
      }

      const metadataSize = JSON.stringify(metadata).length;
      const maxSize = config.getMaxJsonSize();
      
      if (metadataSize > maxSize) {
        return res.status(413).json({
          success: false,
          error: `JSON metadata too large. Maximum: ${maxSize / 1024 / 1024}MB, Yours: ${(metadataSize / 1024 / 1024).toFixed(2)}MB`
        });
      }

      const sanitizedMetadata = security.sanitizeJSON(metadata);
      if (!sanitizedMetadata) {
        await adminBot.sendAlert('security', `Malicious JSON detected from IP: ${req.ip}`);
        return res.status(400).json({
          success: false,
          error: 'Invalid or potentially malicious JSON structure detected'
        });
      }

      const folderValidation = security.validateFolderStructure(sanitizedMetadata);
      if (!folderValidation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid folder structure',
          details: folderValidation.errors.map(e => e.error)
        });
      }

      const existingBot = storage.getBotByToken(sanitizedToken);
      const isUpdate = !!existingBot;

      if (isUpdate) {
        const changePercentage = storage.calculateChangePercentage(
          existingBot.metadata,
          sanitizedMetadata
        );

        if (changePercentage > 30) {
          await adminBot.sendAlert('update', 
            `Bot ${sanitizedUsername} updated with ${changePercentage.toFixed(1)}% changes. Review recommended.`
          );
        }

        storage.updateBot(sanitizedToken, {
          metadata: sanitizedMetadata,
          lastUpdate: new Date().toISOString(),
          changePercentage
        });

        return res.json({
          success: true,
          message: 'Bot metadata updated successfully',
          isUpdate: true,
          changePercentage
        });
      } else {
        const botId = storage.createBot({
          botToken: sanitizedToken,
          channelId: sanitizedChannelId,
          botUsername: sanitizedUsername,
          metadata: sanitizedMetadata,
          status: 'pending',
          createdAt: new Date().toISOString()
        });

        await botManager.addBot(botId, sanitizedToken, sanitizedChannelId, sanitizedMetadata);

        await adminBot.sendAlert('new_bot', 
          `New bot created: ${sanitizedUsername}\nBot ID: ${botId}\nStatus: Pending approval`
        );

        return res.json({
          success: true,
          message: 'Bot created successfully. Awaiting admin approval.',
          botId,
          status: 'pending'
        });
      }

    } catch (error) {
      console.error('Upload error:', error);
      await adminBot.sendAlert('error', `Upload endpoint error: ${error.message}`);
      
      return res.status(500).json({
        success: false,
        error: 'Internal server error during upload'
      });
    }
  }
);

// Bot status check endpoint
app.get('/api/bot-status/:botToken', async (req, res) => {
  try {
    const botToken = security.sanitizeInput(req.params.botToken);
    
    if (!botToken || !security.isValidBotToken(botToken)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bot token format'
      });
    }
    
    const bot = storage.getBotByToken(botToken);

    if (!bot) {
      return res.status(404).json({
        success: false,
        error: 'Bot not found'
      });
    }

    return res.json({
      success: true,
      status: bot.status,
      botId: bot.id,
      botUsername: bot.botUsername,
      createdAt: bot.createdAt,
      ownerRegistered: !!bot.ownerId
    });

  } catch (error) {
    console.error('Status check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error checking bot status'
    });
  }
});

// MAJOR FIX #6: Bot metadata endpoint with rate limiting
app.get('/api/bot-metadata/:botToken', metadataLimiter, async (req, res) => {
  try {
    const botToken = security.sanitizeInput(req.params.botToken);
    
    if (!botToken || !security.isValidBotToken(botToken)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid bot token format'
      });
    }
    
    const bot = storage.getBotByToken(botToken);

    if (!bot) {
      return res.status(404).json({
        success: false,
        error: 'Bot not found'
      });
    }

    return res.json({
      success: true,
      botId: bot.id,
      status: bot.status,
      metadata: bot.metadata,
      lastUpdate: bot.lastUpdate,
      createdAt: bot.createdAt
    });

  } catch (error) {
    console.error('Metadata fetch error:', error);
    return res.status(500).json({
      success: false,
      error: 'Error fetching bot metadata'
    });
  }
});

// ADMIN ROUTES
app.use('/api/admin', adminRoutes.getRouter());

// ERROR HANDLING
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found'
  });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  adminBot.sendAlert('error', `Unhandled server error: ${err.message}`).catch(console.error);
  
  res.status(500).json({
    success: false,
    error: isDevelopment ? err.message : 'Internal server error',
    ...(isDevelopment && { stack: err.stack })
  });
});

// SERVER INITIALIZATION

// MAJOR FIX #7: Environment validation before startup
function validateEnvironment() {
  const errors = [];
  
  if (!process.env.ADMIN_USERNAME) {
    errors.push('ADMIN_USERNAME not set');
  }
  
  if (!process.env.ADMIN_PASSWORD) {
    errors.push('ADMIN_PASSWORD not set');
  } else if (process.env.ADMIN_PASSWORD.length < 12) {
    errors.push('ADMIN_PASSWORD must be at least 12 characters');
  }
  
  // CRITICAL FIX #7: Validate PASSWORD_SALT
  if (!process.env.PASSWORD_SALT) {
    errors.push('PASSWORD_SALT not set (required for password hashing)');
  } else if (process.env.PASSWORD_SALT.length < 32) {
    errors.push('PASSWORD_SALT must be at least 32 characters');
  }
  
  if (process.env.ADMIN_PASSWORD && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/.test(process.env.ADMIN_PASSWORD)) {
    console.warn('⚠ WARNING: ADMIN_PASSWORD should contain uppercase, lowercase, number, and special character');
  }
  
  const port = process.env.PORT || 3000;
  if (isNaN(port) || port < 1 || port > 65535) {
    errors.push('PORT must be a valid number between 1-65535');
  }
  
  if (errors.length > 0) {
    console.error('\n❌ ENVIRONMENT VALIDATION FAILED:\n');
    errors.forEach(err => console.error(`  - ${err}`));
    console.error('\nPlease set required environment variables and restart.\n');
    process.exit(1);
  }
  
  console.log('✓ Environment variables validated');
}

let server;
let isShuttingDown = false;

async function startServer() {
  try {
    validateEnvironment();
    
    await config.initialize();
    await botManager.loadAllBots();
    await adminBot.initialize();
    
    console.log('✓ Configuration loaded');
    console.log('✓ Bots loaded and initialized');
    console.log('✓ Admin bot ready');

    server = app.listen(PORT, () => {
      console.log(`\n🚀 Server running on port ${PORT}`);
      console.log(`📊 Active bots: ${botManager.getActiveBotCount()}`);
      console.log(`⏰ Started at: ${new Date().toISOString()}\n`);
      
      adminBot.sendAlert('system', 
        `Server started successfully\nActive bots: ${botManager.getActiveBotCount()}\nPort: ${PORT}`
      ).catch(console.error);
    });

    server.timeout = 120000;
    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n⚠️  ${signal} received, initiating graceful shutdown...`);
  
  if (server) {
    server.close(() => {
      console.log('✓ HTTP server closed');
    });
  }

  const forceTimeout = setTimeout(() => {
    console.error('❌ Forced shutdown due to timeout');
    process.exit(1);
  }, 30000);

  try {
    if (adminRoutes && adminRoutes.saveSessions) {
      await adminRoutes.saveSessions();
      console.log('✓ Sessions saved');
    }

    await botManager.stopAllBots();
    console.log('✓ All bots stopped');

    await adminBot.sendAlert('system', `Server shutting down (${signal})`);
    console.log('✓ Admin notification sent');

    clearTimeout(forceTimeout);
    console.log('✓ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'));

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  adminBot.sendAlert('error', `Uncaught exception: ${error.message}`).catch(console.error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  adminBot.sendAlert('error', `Unhandled rejection: ${reason}`).catch(console.error);
});

startServer();

module.exports = app;