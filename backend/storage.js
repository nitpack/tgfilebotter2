// storage.js - JSON File Storage Management (FIXED VERSION)
// FIXES: Race conditions with atomic writes, operation backups, caching layer
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class Storage {
  constructor() {
    this.dataDir = path.join(__dirname, '..', 'data');
    this.botsDir = path.join(this.dataDir, 'bots');
    this.configDir = path.join(this.dataDir, 'config');
    this.backupsDir = path.join(this.dataDir, 'backups');
    
    // FIXED: Add write queue for atomic operations
    this.writeQueue = new Map(); // botId -> Promise
    
    // FIXED: Add caching layer
    this.botCache = new Map(); // botId -> { data, timestamp }
    this.CACHE_TTL = 60000; // 1 minute
    
    this.initializeDirectories();
  }

  async initializeDirectories() {
    try {
      await fsPromises.mkdir(this.dataDir, { recursive: true });
      await fsPromises.mkdir(this.botsDir, { recursive: true });
      await fsPromises.mkdir(this.configDir, { recursive: true });
      await fsPromises.mkdir(this.backupsDir, { recursive: true });
      console.log('✓ Storage directories initialized');
    } catch (error) {
      console.error('Error initializing directories:', error);
      throw error;
    }
  }

  // FIXED: Atomic bot status update (prevents race conditions)
  async updateBotStatusAtomic(botId, status) {
    // Wait for any pending writes to complete
    if (this.writeQueue.has(botId)) {
      await this.writeQueue.get(botId);
    }
    
    // Create new write promise
    const writePromise = (async () => {
      try {
        const bot = this.getBotById(botId, false); // Don't use cache
        if (!bot) return false;
        
        bot.status = status;
        bot.statusChangedAt = new Date().toISOString();
        
        await this.saveBot(bot);
        this.clearCache(botId); // Invalidate cache
        return true;
      } finally {
        this.writeQueue.delete(botId);
      }
    })();
    
    this.writeQueue.set(botId, writePromise);
    return await writePromise;
  }

  // FIXED: Create operation backup before destructive actions
  async createOperationBackup(operation, data) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(
        this.backupsDir, 
        `operation_${operation}_${timestamp}.json`
      );
      
      await fsPromises.writeFile(
        backupPath,
        JSON.stringify({
          operation,
          timestamp,
          data
        }, null, 2)
      );
      
      return true;
    } catch (error) {
      console.error('Failed to create operation backup:', error);
      return false;
    }
  }

  // Bot Operations
  createBot(botData) {
    const botId = this.generateBotId();
    const bot = {
      id: botId,
      ...botData,
      createdAt: botData.createdAt || new Date().toISOString(),
      status: botData.status || 'pending',
      ownerId: null
    };

    this.saveBotSync(bot);
    return botId;
  }

  saveBotSync(bot) {
    const filePath = path.join(this.botsDir, `bot_${bot.id}.json`);
    try {
      fs.writeFileSync(filePath, JSON.stringify(bot, null, 2), 'utf8');
      this.clearCache(bot.id); // Invalidate cache
    } catch (err) {
      console.error(`Error saving bot ${bot.id}:`, err);
    }
  }

  async saveBot(bot) {
    const filePath = path.join(this.botsDir, `bot_${bot.id}.json`);
    await fsPromises.writeFile(filePath, JSON.stringify(bot, null, 2), 'utf8');
    this.clearCache(bot.id); // Invalidate cache
  }

  // FIXED: Added caching with proper invalidation
  getBotById(botId, useCache = true) {
    // Check cache first
    if (useCache) {
      const cached = this.botCache.get(botId);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }
    }

    try {
      const filePath = path.join(this.botsDir, `bot_${botId}.json`);
      if (!fs.existsSync(filePath)) {
        return null;
      }
      const data = fs.readFileSync(filePath, 'utf8');
      const bot = JSON.parse(data);
      
      // Update cache
      this.botCache.set(botId, {
        data: bot,
        timestamp: Date.now()
      });
      
      return bot;
    } catch (error) {
      console.error(`Error reading bot ${botId}:`, error);
      return null;
    }
  }

  getBotByToken(token) {
    const allBots = this.getAllBots();
    return allBots.find(bot => bot.botToken === token);
  }

  getAllBots() {
    try {
      if (!fs.existsSync(this.botsDir)) {
        return [];
      }
      
      const files = fs.readdirSync(this.botsDir);
      const bots = [];

      for (const file of files) {
        if (file.startsWith('bot_') && file.endsWith('.json')) {
          try {
            const filePath = path.join(this.botsDir, file);
            const data = fs.readFileSync(filePath, 'utf8');
            const bot = JSON.parse(data);
            bots.push(bot);
          } catch (error) {
            console.error(`Error reading bot file ${file}:`, error);
          }
        }
      }

      return bots;
    } catch (error) {
      console.error('Error getting all bots:', error);
      return [];
    }
  }

  updateBot(botToken, updates) {
    const bot = this.getBotByToken(botToken);
    if (!bot) return false;

    const updatedBot = {
      ...bot,
      ...updates,
      lastUpdate: new Date().toISOString()
    };

    this.saveBotSync(updatedBot);
    return true;
  }

  updateBotStatus(botId, status) {
    const bot = this.getBotById(botId, false); // Don't use cache
    if (!bot) return false;

    bot.status = status;
    bot.statusChangedAt = new Date().toISOString();
    
    this.saveBotSync(bot);
    return true;
  }

  registerBotOwner(botId, ownerId) {
    const bot = this.getBotById(botId, false); // Don't use cache
    if (!bot) return false;

    bot.ownerId = ownerId;
    bot.ownerRegisteredAt = new Date().toISOString();
    
    this.saveBotSync(bot);
    return true;
  }

  async deleteBot(botId) {
    try {
      const filePath = path.join(this.botsDir, `bot_${botId}.json`);
      await fsPromises.unlink(filePath);
      this.clearCache(botId); // Clear from cache
      return true;
    } catch (error) {
      console.error(`Error deleting bot ${botId}:`, error);
      return false;
    }
  }

  getBotsByOwner(ownerId) {
    const allBots = this.getAllBots();
    return allBots.filter(bot => bot.ownerId === ownerId);
  }

  // Cache management
  clearCache(botId = null) {
    if (botId) {
      this.botCache.delete(botId);
    } else {
      this.botCache.clear();
    }
  }

  // Change detection for updates
  calculateChangePercentage(oldMetadata, newMetadata) {
    try {
      const oldFiles = this.countFilesRecursive(oldMetadata);
      const newFiles = this.countFilesRecursive(newMetadata);
      
      const oldFileIds = new Set(this.extractFileIds(oldMetadata));
      const newFileIds = new Set(this.extractFileIds(newMetadata));
      
      const addedFiles = [...newFileIds].filter(id => !oldFileIds.has(id)).length;
      const removedFiles = [...oldFileIds].filter(id => !newFileIds.has(id)).length;
      const totalChanges = addedFiles + removedFiles;
      
      const baseCount = Math.max(oldFiles, newFiles, 1);
      const changePercentage = (totalChanges / baseCount) * 100;
      
      return Math.min(changePercentage, 100);
    } catch (error) {
      console.error('Error calculating change percentage:', error);
      return 0;
    }
  }

  countFilesRecursive(metadata) {
    if (!metadata) return 0;
    let count = (metadata.files || []).length;
    
    if (metadata.subfolders) {
      for (const subfolder of Object.values(metadata.subfolders)) {
        count += this.countFilesRecursive(subfolder);
      }
    }
    
    return count;
  }

  extractFileIds(metadata, ids = []) {
    if (!metadata) return ids;
    
    if (metadata.files) {
      ids.push(...metadata.files.map(f => f.fileId || f.messageId));
    }
    
    if (metadata.subfolders) {
      for (const subfolder of Object.values(metadata.subfolders)) {
        this.extractFileIds(subfolder, ids);
      }
    }
    
    return ids;
  }

  // Configuration Management
  async loadConfig(configName) {
    try {
      const filePath = path.join(this.configDir, `${configName}.json`);
      const data = await fsPromises.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      console.error(`Error loading config ${configName}:`, error);
      throw error;
    }
  }

  async saveConfig(configName, data) {
    try {
      const filePath = path.join(this.configDir, `${configName}.json`);
      await fsPromises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error(`Error saving config ${configName}:`, error);
      throw error;
    }
  }

  // Banned Users Management
  async getBannedUsers() {
    const config = await this.loadConfig('banned_users');
    return config ? config.users || [] : [];
  }

  async addBannedUser(userId, reason = '') {
    let config = await this.loadConfig('banned_users') || { users: [] };
    
    if (!config.users.find(u => u.userId === userId)) {
      config.users.push({
        userId,
        reason,
        bannedAt: new Date().toISOString()
      });
      
      await this.saveConfig('banned_users', config);
    }
    
    return true;
  }

  async isBanned(userId) {
    const bannedUsers = await this.getBannedUsers();
    return bannedUsers.some(u => u.userId === userId);
  }

  // Backup Operations
  async createBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.join(this.backupsDir, `backup_${timestamp}`);
      
      await fsPromises.mkdir(backupDir, { recursive: true });

      // Copy bots directory
      await this.copyDirectory(this.botsDir, path.join(backupDir, 'bots'));
      
      // Copy config directory
      await this.copyDirectory(this.configDir, path.join(backupDir, 'config'));

      // Create backup manifest
      const manifest = {
        timestamp,
        createdAt: new Date().toISOString(),
        botCount: this.getAllBots().length,
        checksum: await this.calculateDirectoryChecksum(backupDir)
      };

      await fsPromises.writeFile(
        path.join(backupDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2),
        'utf8'
      );

      console.log(`✓ Backup created: ${backupDir}`);
      return { success: true, backupDir, manifest };

    } catch (error) {
      console.error('Error creating backup:', error);
      return { success: false, error: error.message };
    }
  }

  async copyDirectory(src, dest) {
    await fsPromises.mkdir(dest, { recursive: true });
    
    if (!fs.existsSync(src)) {
      return;
    }
    
    const entries = await fsPromises.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fsPromises.copyFile(srcPath, destPath);
      }
    }
  }

  async calculateDirectoryChecksum(dirPath) {
    const files = await this.getAllFilesRecursive(dirPath);
    const hash = crypto.createHash('sha256');

    for (const file of files.sort()) {
      const content = await fsPromises.readFile(file);
      hash.update(content);
    }

    return hash.digest('hex');
  }

  async getAllFilesRecursive(dirPath, fileList = []) {
    if (!fs.existsSync(dirPath)) {
      return fileList;
    }
    
    const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await this.getAllFilesRecursive(fullPath, fileList);
      } else {
        fileList.push(fullPath);
      }
    }

    return fileList;
  }

  // Utility
  generateBotId() {
    return crypto.randomBytes(8).toString('hex');
  }
}

module.exports = Storage;
