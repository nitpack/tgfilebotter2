// server.js - Main Backend Server Entry Point (FIXED VERSION)
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const path = require('path');

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
  contentSecurityPolicy: false // Allow inline scripts for admin panel
}));
app.use(express.json({ limit: '15mb' }));

// Serve static files from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting - Global
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting - Upload endpoint (stricter)
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Upload rate limit exceeded. Please try again later.',
});

app.use(globalLimiter);

// ============================================================
// PUBLIC ROUTES
// ============================================================

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve admin panel at /admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-panel.html'));
});

// ============================================================
// API ROUTES
// ============================================================

// Bot metadata upload endpoint
app.post('/api/upload',
  uploadLimiter,
  [
    body('botToken').trim().notEmpty().isLength({ max: 100 }),
    body('channelId').trim().notEmpty().isLength({ max: 50 }),
    body('botUsername').trim().notEmpty().matches(/^@[a-zA-Z0-9_]{5,32}$/),
    body('metadata').isObject(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        await adminBot.sendAlert('security', `Invalid upload attempt from IP: ${req.ip}`);
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid input data',
          details: errors.array()
        });
      }

      const { botToken, channelId, botUsername, metadata } = req.body;

      // Sanitize inputs
      const sanitizedToken = security.sanitizeInput(botToken);
      const sanitizedChannelId = security.sanitizeInput(channelId);
      const sanitizedUsername = security.sanitizeInput(botUsername);

      // Validate JSON metadata size
      const metadataSize = JSON.stringify(metadata).length;
      const maxSize = config.getMaxJsonSize();
      
      if (metadataSize > maxSize) {
        return res.status(413).json({
          success: false,
          error: `JSON metadata too large. Maximum: ${maxSize / 1024 / 1024}MB, Yours: ${(metadataSize / 1024 / 1024).toFixed(2)}MB`
        });
      }

      // Validate and sanitize JSON metadata
      const sanitizedMetadata = security.sanitizeJSON(metadata);
      if (!sanitizedMetadata) {
        await adminBot.sendAlert('security', `Malicious JSON detected from IP: ${req.ip}`);
        return res.status(400).json({
          success: false,
          error: 'Invalid or potentially malicious JSON structure detected'
        });
      }

      // Validate folder structure
      const folderValidation = security.validateFolderStructure(sanitizedMetadata);
      if (!folderValidation.valid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid folder structure',
          details: folderValidation.errors
        });
      }

      // Check if bot already exists
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

// Bot metadata endpoint (for update mode in uploader)
app.get('/api/bot-metadata/:botToken', async (req, res) => {
  try {
    const botToken = security.sanitizeInput(req.params.botToken);
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

// ============================================================
// ADMIN ROUTES (authenticated via admin-routes.js)
// ============================================================
app.use('/api/admin', adminRoutes.getRouter());

// ============================================================
// ERROR HANDLING
// ============================================================
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  adminBot.sendAlert('error', `Unhandled server error: ${err.message}`).catch(console.error);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// ============================================================
// SERVER INITIALIZATION
// ============================================================
async function startServer() {
  try {
    await config.initialize();
    await botManager.loadAllBots();
    await adminBot.initialize();
    
    console.log('✓ Configuration loaded');
    console.log('✓ Bots loaded and initialized');
    console.log('✓ Admin bot ready');

    app.listen(PORT, () => {
      console.log(`\n🚀 Server running on port ${PORT}`);
      console.log(`📊 Active bots: ${botManager.getActiveBotCount()}`);
      console.log(`⏰ Started at: ${new Date().toISOString()}\n`);
      
      adminBot.sendAlert('system', 
        `Server started successfully\nActive bots: ${botManager.getActiveBotCount()}\nPort: ${PORT}`
      ).catch(console.error);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n⚠️  SIGTERM received, shutting down gracefully...');
  await adminBot.sendAlert('system', 'Server shutting down (SIGTERM)');
  await botManager.stopAllBots();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n⚠️  SIGINT received, shutting down gracefully...');
  await adminBot.sendAlert('system', 'Server shutting down (SIGINT)');
  await botManager.stopAllBots();
  process.exit(0);
});

startServer();

module.exports = app;
