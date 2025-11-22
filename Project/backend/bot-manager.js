// bot-manager.js - Manages Multiple Telegram Bots
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
    } catch (error) {
      console.error('Error loading bots:', error);
      throw error;
    }
  }

  async addBot(botId, token, channelId, metadata, status = 'pending', ownerId = null) {
    try {
      // Create bot instance
      const bot = new TelegramBot(token, { polling: true });
      
      // Store bot info
      const botInfo = {
        instance: bot,
        botId,
        token,
        channelId,
        metadata,
        status,
        ownerId,
        started: new Date().toISOString()
      };

      this.bots.set(botId, botInfo);
      this.botTokenMap.set(token, botId);

      // Setup handlers
      this.setupBotHandlers(botInfo);

      console.log(`✓ Bot ${botId} initialized (status: ${status})`);
      return botId;

    } catch (error) {
      console.error(`Error adding bot ${botId}:`, error);
      await this.adminBot.sendAlert('error', `Failed to initialize bot ${botId}: ${error.message}`);
      throw error;
    }
  }

  setupBotHandlers(botInfo) {
    const { instance: bot, botId, channelId, metadata, status, ownerId } = botInfo;
    const adminUserId = this.config.getAdminUserId();

    // Handle /start command
    bot.onText(/\/start/, async (msg) => {
      const userId = msg.from.id;
      const chatId = msg.chat.id;

      // Sanitize message
      const sanitizedMsg = this.security.sanitizeTelegramMessage(msg);
      if (!sanitizedMsg) {
        await this.adminBot.sendAlert('security', `Malicious message blocked from user ${userId} in bot ${botId}`);
        return;
      }

      try {
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
      }
    });

    // Handle text messages (for owner registration)
    bot.on('message', async (msg) => {
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
    });

    // Handle inline keyboard callbacks
    bot.on('callback_query', async (query) => {
      const userId = query.from.id;
      const chatId = query.message.chat.id;
      const data = query.data;

      // Sanitize callback data
      const sanitizedData = this.security.sanitizeInput(data);
      if (!sanitizedData) {
        await this.adminBot.sendAlert('security', `Malicious callback blocked from user ${userId} in bot ${botId}`);
        return;
      }

      try {
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
        await bot.answerCallbackQuery(query.id, { text: 'Error processing request' });
      }
    });

    // Error handling
    bot.on('polling_error', (error) => {
      console.error(`Polling error for bot ${botId}:`, error);
      this.adminBot.sendAlert('error', `Polling error in bot ${botId}: ${error.message}`).catch(console.error);
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
      await bot.sendMessage(chatId, '❌ Error loading folder menu.');
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

  async stopBot(botId) {
    const botInfo = this.bots.get(botId);
    if (botInfo) {
      await botInfo.instance.stopPolling();
      this.bots.delete(botId);
      this.botTokenMap.delete(botInfo.token);
      console.log(`✓ Bot ${botId} stopped`);
    }
  }

  async stopAllBots() {
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