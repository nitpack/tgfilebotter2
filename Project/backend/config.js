// config.js - Configuration Management
class Config {
  constructor(storage) {
    this.storage = storage;
    this.config = {
      admin: null,
      system: null
    };
  }

  async initialize() {
    try {
      // Load admin configuration
      this.config.admin = await this.storage.loadConfig('admin');
      if (!this.config.admin) {
        // Create default admin config
        this.config.admin = {
          telegramUserId: null, // To be set via admin panel
          botToken: null,       // Admin bot token
          channelId: null,      // Admin channel ID
          createdAt: new Date().toISOString()
        };
        await this.storage.saveConfig('admin', this.config.admin);
        console.log('⚠️  Admin configuration not set. Please configure via admin panel.');
      }

      // Load system configuration
      this.config.system = await this.storage.loadConfig('system');
      if (!this.config.system) {
        // Create default system config
        this.config.system = {
          maxJsonSizeMB: 10,
          welcomeMessage: '👋 Welcome! Use the buttons below to navigate through folders and access files.',
          invalidInputMessage: '❌ Invalid input. Please use the buttons to navigate.',
          createdAt: new Date().toISOString()
        };
        await this.storage.saveConfig('system', this.config.system);
      }

      console.log('✓ Configuration loaded');
      return true;

    } catch (error) {
      console.error('Error initializing config:', error);
      throw error;
    }
  }

  // Admin Configuration
  getAdminUserId() {
    return this.config.admin?.telegramUserId || null;
  }

  getAdminBotToken() {
    return this.config.admin?.botToken || null;
  }

  getAdminChannelId() {
    return this.config.admin?.channelId || null;
  }

  async setAdminConfig(userId, botToken, channelId) {
    this.config.admin = {
      ...this.config.admin,
      telegramUserId: userId,
      botToken: botToken,
      channelId: channelId,
      updatedAt: new Date().toISOString()
    };

    await this.storage.saveConfig('admin', this.config.admin);
    return true;
  }

  isAdminConfigured() {
    return !!(
      this.config.admin?.telegramUserId &&
      this.config.admin?.botToken &&
      this.config.admin?.channelId
    );
  }

  // System Configuration
  getMaxJsonSize() {
    const sizeMB = this.config.system?.maxJsonSizeMB || 10;
    return sizeMB * 1024 * 1024; // Convert to bytes
  }

  async setMaxJsonSize(sizeMB) {
    if (sizeMB < 1 || sizeMB > 50) {
      throw new Error('JSON size must be between 1 and 50 MB');
    }

    this.config.system.maxJsonSizeMB = sizeMB;
    this.config.system.updatedAt = new Date().toISOString();
    
    await this.storage.saveConfig('system', this.config.system);
    return true;
  }

  getWelcomeMessage() {
    return this.config.system?.welcomeMessage || 
      '👋 Welcome! Use the buttons below to navigate through folders and access files.';
  }

  async setWelcomeMessage(message) {
    if (!message || message.length > 500) {
      throw new Error('Welcome message must be between 1 and 500 characters');
    }

    this.config.system.welcomeMessage = message;
    this.config.system.updatedAt = new Date().toISOString();
    
    await this.storage.saveConfig('system', this.config.system);
    return true;
  }

  getInvalidInputMessage() {
    return this.config.system?.invalidInputMessage || 
      '❌ Invalid input. Please use the buttons to navigate.';
  }

  async setInvalidInputMessage(message) {
    if (!message || message.length > 500) {
      throw new Error('Invalid input message must be between 1 and 500 characters');
    }

    this.config.system.invalidInputMessage = message;
    this.config.system.updatedAt = new Date().toISOString();
    
    await this.storage.saveConfig('system', this.config.system);
    return true;
  }

  // Get all system settings
  getSystemSettings() {
    return {
      maxJsonSizeMB: this.config.system?.maxJsonSizeMB || 10,
      welcomeMessage: this.getWelcomeMessage(),
      invalidInputMessage: this.getInvalidInputMessage()
    };
  }

  // Get all admin settings (excluding sensitive data)
  getAdminSettings() {
    return {
      telegramUserId: this.config.admin?.telegramUserId || null,
      hasAdminBot: !!this.config.admin?.botToken,
      hasAdminChannel: !!this.config.admin?.channelId,
      configured: this.isAdminConfigured()
    };
  }
}

module.exports = Config;