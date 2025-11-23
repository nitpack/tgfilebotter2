// bot-manager.js - Manages Multiple Telegram Bots (FIXED VERSION)
// FIXES: Error isolation, bot recovery mechanism, proper error handling
const TelegramBot = require('node-telegram-bot-api');
const Security = require('./security');

class BotManager {
  constructor(storage, config, adminBot) {
    this.storage = storage;
    this.config = config;
    this.adminBot = adminBot;
    this.security = new Security();
    this.bots = new Map(); // botId -> bot instance
    this.botTokenMap = new Map(); // token -> botId
    
    // FIXED: Add recovery monitoring
    this.recoveryInterval = null;
  }

  async loadAllBots() {
    try {
      const allBots = this.storage.getAllBots();
      console.log(`Loading ${allBots.length} bots...`);

      for (const botData of allBots) {
        if (botData.status !== 'banned') {
          await this.addBot(
            botData.id,
            botData.botToken,
            botData.channelId,
            botData.metadata,
            botData.status,
            botData.ownerId
          );
        }
      }

      console.log(`✓ Loaded ${this.bots.size} active bots`);
      
      // Start recovery monitor
      this.startRecoveryMonitor();
      
    } catch (error) {
      console.error('Error loading bots:', error);
      throw error;
    }
  }

  // FIXED: Improved error handling with isolation
  async addBot(botId, token, channelId, metadata, status = 'pending', ownerId = null) {
    try {
      // Create bot instance with error handling
      const bot = new TelegramBot(token, { 
        polling: {
          interval: 300,
          autoStart: true,
          params: {
            timeout: 10
          }
        }
      });
      
      // Test bot connection before adding
      try {
        await bot.getMe();
      } catch (error) {
        throw new Error(`Bot token invalid or revoked: ${error.message}`);
      }
      
      // Store bot info
      const botInfo = {
        instance: bot,
        botId,
        token,
        channelId,
        metadata,
        status,
        ownerId,
        started: new Date().toISOString(),
        errors: [], // Track errors per bot
        lastHealthCheck: Date.now()
      };

      this.bots.set(botId, botInfo);
      this.botTokenMap.set(token, botId);

      // Setup handlers with error isolation
      this.setupBotHandlers(botInfo);

      console.log(`✓ Bot ${botId} initialized (status: ${status})`);
      return botId;

    } catch (error) {
      console.error(`❌ Error adding bot ${botId}:`, error);
      await this.adminBot.sendAlert('error', `Failed to initialize bot ${botId}: ${error.message}`);
      
      // Don't throw - log and continue with other bots
      return null;
    }
  }

  setupBotHandlers(botInfo) {
    const { instance: bot, botId, channelId, metadata, status, ownerId } = botInfo;
    const adminUserId = this.config.getAdminUserId();

    // FIXED: Add error handler to prevent crashes
    bot.on('polling_error', (error) => {
      console.error(`Polling error for bot ${botId}:`, error);
      
      // Track errors
      if (!botInfo.errors) botInfo.errors = [];
      botInfo.errors.push({
        timestamp: new Date().toISOString(),
        error: error.message,
        type: 'polling'
      });
      
      // If too many errors, stop bot
      if (botInfo.errors.length > 10) {
        console.error(`Bot ${botId} has too many errors, stopping...`);
        this.stopBot(botId).catch(console.error);
        this.adminBot.sendAlert('error', `Bot ${botId} stopped due to repeated errors`).catch(console.error);
      }
    });

    // Handle /start command with error isolation
    bot.onText(/\/start/, async (msg) => {
      try {
        const userId = msg.from.id;
        const chatId = msg.chat.id;

        // Sanitize message
        const sanitizedMsg = this.security.sanitizeTelegramMessage(msg);
        if (!sanitizedMsg) {
          await this.adminBot.sendAlert('security', `Malicious message blocked from user ${userId} in bot ${botId}`);
          return;
        }

        // Check bot status and user permissions
        if (status === 'pending') {
          // Only admin can interact with pending bots
          if (userId !== adminUserId) {
            return; // Silently ignore non-admin users for pending bots
          }
          await bot.sendMessage(chatId, 
            `⚠️ ADMIN TEST MODE ⚠️\n\nThis bot is pending approval. You are testing as admin.`
          );
        } else if (status === 'disconnected') {
          await bot.sendMessage(chatId, 
            '⛔ This bot is currently disconnected. Please contact the administrator.'
          );
          return;
        } else if (status === 'banned') {
          return; // Banned bots should not respond at all
        }

        // Send welcome message
        const welcomeMsg = this.config.getWelcomeMessage();
        await bot.sendMessage(chatId, welcomeMsg);

        // Show main menu (root folders)
        await this.sendFolderMenu(bot, chatId, metadata, []);
        
      } catch (error) {
        console.error(`Error handling /start for bot ${botId}:`, error);
        // Don't crash - just log the error
      }
    });

    // Handle text messages (for owner registration) with error isolation
    bot.on('message', async (msg) => {
      try {
        // Skip if it's a command
        if (msg.text && msg.text.startsWith('/')) return;

        const userId = msg.from.id;
        const chatId = msg.chat.id;
        const text = msg.text || '';

        // Sanitize message
        const sanitizedMsg = this.security.sanitizeTelegramMessage(msg);
        if (!sanitizedMsg) {
          await this.adminBot.sendAlert('security', `Malicious message blocked from user ${userId} in bot ${botId}`);
          return;
        }

        // Check if this is owner registration
        if (!ownerId && text.toLowerCase().includes('register')) {
          // Register bot owner
          this.storage.registerBotOwner(botId, userId);
          botInfo.ownerId = userId;

          await bot.sendMessage(chatId, 
            '✅ Registration successful! Your bot has been submitted for review.\n\nYou will be notified once approved.'
          );

          await this.adminBot.sendAlert('registration', 
            `Bot ${botId} owner registered\nUser ID: ${userId}\nBot needs approval`
          );

          return;
        }

        // For other text messages, send invalid input message
        const invalidMsg = this.config.getInvalidInputMessage();
        await bot.sendMessage(chatId, invalidMsg);
        
      } catch (error) {
        console.error(`Error handling message for bot ${botId}:`, error);
        // Don't crash - just log the error
      }
    });

    // Handle inline keyboard callbacks with error isolation
    bot.on('callback_query', async (query) => {
      try {
        const userId = query.from.id;
        const chatId = query.message.chat.id;
        const data = query.data;

        // Sanitize callback data
        const sanitizedData = this.security.sanitizeInput(data);
        if (!sanitizedData) {
          await this.adminBot.sendAlert('security', `Malicious callback blocked from user ${userId} in bot ${botId}`);
          return;
        }

        // Check bot status
        if (status === 'pending' && userId !== adminUserId) {
          await bot.answerCallbackQuery(query.id);
          return;
        }

        if (status === 'disconnected' || status === 'banned') {
          await bot.answerCallbackQuery(query.id);
          return;
        }

        // Parse callback data
        const [action, ...pathParts] = sanitizedData.split('|');
        const path = pathParts.join('|').split('/').filter(p => p);

        if (action === 'folder') {
          // Navigate to folder
          await this.sendFolderMenu(bot, chatId, metadata, path);
          await bot.answerCallbackQuery(query.id);

        } else if (action === 'main') {
          // Return to main menu
          await this.sendFolderMenu(bot, chatId, metadata, []);
          await bot.answerCallbackQuery(query.id, { text: 'Returned to main menu' });

        } else if (action === 'page') {
          // Handle pagination
          const pageNum = parseInt(pathParts[0]);
          const currentPath = pathParts.slice(1).join('|').split('/').filter(p => p);
          await this.sendFolderMenu(bot, chatId, metadata, currentPath, pageNum);
          await bot.answerCallbackQuery(query.id);
        }
        
      } catch (error) {
        console.error(`Error handling callback for bot ${botId}:`, error);
        try {
          await bot.answerCallbackQuery(query.id, { text: 'Error processing request' });
        } catch (e) {
          // Even answering callback failed, just log
          console.error('Failed to answer callback query:', e);
        }
      }
    });
  }

  async sendFolderMenu(bot, chatId, metadata, currentPath, page = 0) {
    try {
      // Navigate to current folder in metadata
      let currentFolder = metadata;
      for (const folder of currentPath) {
        if (!currentFolder.subfolders || !currentFolder.subfolders[folder]) {
          await bot.sendMessage(chatId, '❌ Folder not found.');
          return;
        }
        currentFolder = currentFolder.subfolders[folder];
      }

      // Get subfolders (sorted alphabetically with Unicode support)
      const subfolders = Object.keys(currentFolder.subfolders || {}).sort((a, b) => 
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
      );

      // Get files in current folder
      const files = currentFolder.files || [];

      // If folder contains files, forward them
      if (files.length > 0 && page === 0) {
        await bot.sendMessage(chatId, `📁 Sending ${files.length} file(s) from this folder...`);
        
        for (const file of files) {
          try {
            await bot.forwardMessage(chatId, currentFolder.channelId || metadata.channelId, file.messageId);
          } catch (error) {
            console.error(`Error forwarding file:`, error);
          }
        }
      }

      // Prepare inline keyboard for subfolders
      if (subfolders.length === 0) {
        if (files.length === 0) {
          await bot.sendMessage(chatId, '📭 This folder is empty.');
        }
        
        // Only show main button if not at root
        if (currentPath.length > 0) {
          const keyboard = {
            inline_keyboard: [[
              { text: '🏠 Main Menu', callback_data: 'main|' }
            ]]
          };
          await bot.sendMessage(chatId, 'Navigation:', { reply_markup: keyboard });
        }
        return;
      }

      // Pagination (30 buttons per page, 3 rows of 10)
      const ITEMS_PER_PAGE = 30;
      const BUTTONS_PER_ROW = 10;
      
      const startIdx = page * ITEMS_PER_PAGE;
      const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, subfolders.length);
      const pageSubfolders = subfolders.slice(startIdx, endIdx);

      // Create button rows
      const buttons = [];
      for (let i = 0; i < pageSubfolders.length; i += BUTTONS_PER_ROW) {
        const row = pageSubfolders.slice(i, i + BUTTONS_PER_ROW).map(folder => ({
          text: `📁 ${folder}`,
          callback_data: `folder|${[...currentPath, folder].join('/')}`
        }));
        buttons.push(row);
      }

      // Add navigation buttons at the bottom
      const navButtons = [];
      const totalPages = Math.ceil(subfolders.length / ITEMS_PER_PAGE);

      if (page > 0) {
        navButtons.push({ text: '⬅️ Back', callback_data: `page|${page - 1}|${currentPath.join('/')}` });
      }
      if (page < totalPages - 1) {
        navButtons.push({ text: '➡️ Next', callback_data: `page|${page + 1}|${currentPath.join('/')}` });
      }
      if (currentPath.length > 0) {
        navButtons.push({ text: '🏠 Main', callback_data: 'main|' });
      }

      if (navButtons.length > 0) {
        buttons.push(navButtons);
      }

      // Send menu
      const pathDisplay = currentPath.length > 0 ? currentPath.join(' > ') : 'Main Menu';
      const pageInfo = totalPages > 1 ? ` (Page ${page + 1}/${totalPages})` : '';
      
      await bot.sendMessage(chatId, `📂 ${pathDisplay}${pageInfo}`, {
        reply_markup: { inline_keyboard: buttons }
      });

    } catch (error) {
      console.error('Error sending folder menu:', error);
      try {
        await bot.sendMessage(chatId, '❌ Error loading folder menu.');
      } catch (e) {
        // Failed to send error message too
        console.error('Failed to send error message:', e);
      }
    }
  }

  async sendAdminMessage(botId, ownerId, message) {
    try {
      const botInfo = this.bots.get(botId);
      if (!botInfo) {
        throw new Error('Bot not found');
      }

      // Sanitize admin message
      const sanitizedMessage = this.security.sanitizeInput(message);
      
      await botInfo.instance.sendMessage(ownerId, 
        `📨 Message from Administrator:\n\n${sanitizedMessage}`
      );

      return true;
    } catch (error) {
      console.error(`Error sending admin message:`, error);
      throw error;
    }
  }

  // FIXED: Add recovery monitoring
  startRecoveryMonitor() {
    // Check every 5 minutes for failed bots
    this.recoveryInterval = setInterval(async () => {
      for (const [botId, botInfo] of this.bots.entries()) {
        try {
          // Check if bot is still responsive
          const me = await botInfo.instance.getMe();
          
          // Reset error count on success
          if (botInfo.errors) {
            botInfo.errors = [];
          }
          
          botInfo.lastHealthCheck = Date.now();
          
        } catch (error) {
          console.error(`Bot ${botId} health check failed:`, error);
          
          // Track failure
          if (!botInfo.errors) botInfo.errors = [];
          botInfo.errors.push({
            timestamp: new Date().toISOString(),
            error: error.message,
            type: 'health_check'
          });

          // If failed multiple times, attempt restart
          if (botInfo.errors.length >= 3) {
            console.log(`Attempting to restart bot ${botId}...`);
            
            try {
              await this.stopBot(botId);
              
              const bot = this.storage.getBotById(botId);
              if (bot && bot.status === 'approved') {
                await this.addBot(
                  botId,
                  bot.botToken,
                  bot.channelId,
                  bot.metadata,
                  bot.status,
                  bot.ownerId
                );
                
                await this.adminBot.sendAlert('recovery', 
                  `Bot ${botId} was automatically restarted after health check failure`
                );
              }
            } catch (restartError) {
              console.error(`Failed to restart bot ${botId}:`, restartError);
              await this.adminBot.sendAlert('error',
                `Failed to auto-restart bot ${botId}: ${restartError.message}`
              );
            }
          }
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  async stopBot(botId) {
    const botInfo = this.bots.get(botId);
    if (botInfo) {
      try {
        await botInfo.instance.stopPolling();
      } catch (error) {
        console.error(`Error stopping bot ${botId}:`, error);
      }
      this.bots.delete(botId);
      this.botTokenMap.delete(botInfo.token);
      console.log(`✓ Bot ${botId} stopped`);
    }
  }

  async stopAllBots() {
    // Clear recovery interval
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
    }
    
    console.log('Stopping all bots...');
    for (const [botId, botInfo] of this.bots.entries()) {
      try {
        await botInfo.instance.stopPolling();
      } catch (error) {
        console.error(`Error stopping bot ${botId}:`, error);
      }
    }
    this.bots.clear();
    this.botTokenMap.clear();
    console.log('✓ All bots stopped');
  }

  getActiveBotCount() {
    return this.bots.size;
  }

  getBotInfo(botId) {
    return this.bots.get(botId);
  }
}

module.exports = BotManager;
