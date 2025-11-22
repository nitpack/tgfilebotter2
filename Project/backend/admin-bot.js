// admin-bot.js - Admin Notification Bot
const TelegramBot = require('node-telegram-bot-api');

class AdminBot {
  constructor(config, storage) {
    this.config = config;
    this.storage = storage;
    this.bot = null;
    this.adminChannelId = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      const botToken = this.config.getAdminBotToken();
      const channelId = this.config.getAdminChannelId();

      if (!botToken || !channelId) {
        console.warn('⚠️  Admin bot not configured. Notifications disabled.');
        return false;
      }

      this.bot = new TelegramBot(botToken, { polling: false });
      this.adminChannelId = channelId;
      this.isInitialized = true;

      console.log('✓ Admin bot initialized');
      return true;

    } catch (error) {
      console.error('Error initializing admin bot:', error);
      return false;
    }
  }

  async sendAlert(type, message) {
    if (!this.isInitialized) {
      console.log('[ADMIN ALERT]', type, ':', message);
      return false;
    }

    try {
      const emoji = this.getEmojiForType(type);
      const formattedMessage = `${emoji} *${type.toUpperCase()}*\n\n${message}\n\n_${new Date().toLocaleString()}_`;

      await this.bot.sendMessage(this.adminChannelId, formattedMessage, {
        parse_mode: 'Markdown'
      });

      return true;

    } catch (error) {
      console.error('Error sending admin alert:', error);
      console.log('[ADMIN ALERT FAILED]', type, ':', message);
      return false;
    }
  }

  async sendSystemNotification(title, details) {
    if (!this.isInitialized) {
      console.log('[SYSTEM NOTIFICATION]', title, ':', details);
      return false;
    }

    try {
      const message = `🖥️ *SYSTEM NOTIFICATION*\n\n*${title}*\n\n${details}\n\n_${new Date().toLocaleString()}_`;

      await this.bot.sendMessage(this.adminChannelId, message, {
        parse_mode: 'Markdown'
      });

      return true;

    } catch (error) {
      console.error('Error sending system notification:', error);
      return false;
    }
  }

  async sendBackupReport(backupResult) {
    if (!this.isInitialized) {
      console.log('[BACKUP REPORT]', backupResult);
      return false;
    }

    try {
      let message;
      
      if (backupResult.success) {
        message = `✅ *BACKUP SUCCESSFUL*\n\n` +
                 `Timestamp: ${backupResult.manifest.timestamp}\n` +
                 `Bots backed up: ${backupResult.manifest.botCount}\n` +
                 `Checksum: \`${backupResult.manifest.checksum.substring(0, 16)}...\`\n\n` +
                 `Location: ${backupResult.backupDir}\n\n` +
                 `_${new Date().toLocaleString()}_`;
      } else {
        message = `❌ *BACKUP FAILED*\n\n` +
                 `Error: ${backupResult.error}\n\n` +
                 `_${new Date().toLocaleString()}_`;
      }

      await this.bot.sendMessage(this.adminChannelId, message, {
        parse_mode: 'Markdown'
      });

      return true;

    } catch (error) {
      console.error('Error sending backup report:', error);
      return false;
    }
  }

  async sendSecurityAlert(severity, eventType, details) {
    if (!this.isInitialized) {
      console.log('[SECURITY ALERT]', severity, eventType, ':', details);
      return false;
    }

    try {
      const emoji = severity === 'HIGH' ? '🚨' : severity === 'MEDIUM' ? '⚠️' : 'ℹ️';
      
      const message = `${emoji} *SECURITY ALERT - ${severity}*\n\n` +
                     `Type: ${eventType}\n` +
                     `Details: ${details}\n\n` +
                     `_${new Date().toLocaleString()}_`;

      await this.bot.sendMessage(this.adminChannelId, message, {
        parse_mode: 'Markdown'
      });

      return true;

    } catch (error) {
      console.error('Error sending security alert:', error);
      return false;
    }
  }

  async sendDailyReport(stats) {
    if (!this.isInitialized) {
      console.log('[DAILY REPORT]', stats);
      return false;
    }

    try {
      const message = `📊 *DAILY REPORT*\n\n` +
                     `Total Bots: ${stats.totalBots}\n` +
                     `Approved: ${stats.approved}\n` +
                     `Pending: ${stats.pending}\n` +
                     `Disconnected: ${stats.disconnected}\n` +
                     `Banned Users: ${stats.bannedUsers}\n\n` +
                     `New Bots Today: ${stats.newBotsToday}\n` +
                     `Updates Today: ${stats.updatesToday}\n\n` +
                     `_${new Date().toLocaleString()}_`;

      await this.bot.sendMessage(this.adminChannelId, message, {
        parse_mode: 'Markdown'
      });

      return true;

    } catch (error) {
      console.error('Error sending daily report:', error);
      return false;
    }
  }

  getEmojiForType(type) {
    const emojiMap = {
      'new_bot': '🤖',
      'approval': '✅',
      'update': '🔄',
      'security': '🔒',
      'error': '❌',
      'system': '🖥️',
      'registration': '📝',
      'backup': '💾',
      'warning': '⚠️',
      'ddos': '🚨',
      'injection': '⚠️'
    };

    return emojiMap[type] || 'ℹ️';
  }

  async testConnection() {
    if (!this.isInitialized) {
      return { success: false, error: 'Admin bot not initialized' };
    }

    try {
      const me = await this.bot.getMe();
      await this.sendAlert('system', 'Admin bot connection test successful!');
      
      return { 
        success: true, 
        botUsername: me.username,
        botId: me.id
      };

    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  isConfigured() {
    return this.isInitialized;
  }
}

module.exports = AdminBot;