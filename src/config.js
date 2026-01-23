const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

class ConfigManager {
  constructor() {
    this.userDataPath = app.getPath('userData');
    this.configPath = path.join(this.userDataPath, 'config.json');
    this.artworkPath = path.join(this.userDataPath, 'artwork');
    this.config = null;
  }

  async init() {
    // Ensure directories exist
    await fs.mkdir(this.artworkPath, { recursive: true });
    await fs.mkdir(path.join(this.artworkPath, 'boxart'), { recursive: true });
    await fs.mkdir(path.join(this.artworkPath, 'screenshots'), { recursive: true });
    await fs.mkdir(path.join(this.artworkPath, 'banners'), { recursive: true });
    await fs.mkdir(path.join(this.artworkPath, 'fanart'), { recursive: true });

    // Load or create config
    await this.load();
  }

  getDefaultConfig() {
    return {
      version: '1.0.0',
      theme: 'dark',
      defaultView: 'grid',
      syncProfiles: [
        {
          id: 'miyoo-mini',
          name: 'Miyoo Mini Plus',
          enabled: false,
          basePath: '',
          systemMappings: {
            'Nintendo Entertainment System': 'FC',
            'Super Nintendo': 'SFC',
            'Game Boy': 'GB',
            'Game Boy Color': 'GBC',
            'Game Boy Advance': 'GBA',
            'Sega Genesis': 'MD',
            'Sega Master System': 'MS',
            'Game Gear': 'GG',
            'PlayStation': 'PS'
          }
        },
        {
          id: 'anbernic-rg35xx',
          name: 'Anbernic RG35XX',
          enabled: false,
          basePath: '',
          systemMappings: {
            'Nintendo Entertainment System': 'roms/NES',
            'Super Nintendo': 'roms/SNES',
            'Game Boy': 'roms/GB',
            'Game Boy Color': 'roms/GBC',
            'Game Boy Advance': 'roms/GBA',
            'Nintendo 64': 'roms/N64',
            'Sega Genesis': 'roms/GENESIS',
            'Sega Master System': 'roms/MS',
            'Game Gear': 'roms/GG',
            'PlayStation': 'roms/PS1'
          }
        },
        {
          id: 'steam-deck',
          name: 'Steam Deck',
          enabled: false,
          basePath: '',
          systemMappings: {
            'Nintendo Entertainment System': 'Emulation/roms/nes',
            'Super Nintendo': 'Emulation/roms/snes',
            'Game Boy': 'Emulation/roms/gb',
            'Game Boy Color': 'Emulation/roms/gbc',
            'Game Boy Advance': 'Emulation/roms/gba',
            'Nintendo 64': 'Emulation/roms/n64',
            'Nintendo DS': 'Emulation/roms/nds',
            'Sega Genesis': 'Emulation/roms/genesis',
            'PlayStation': 'Emulation/roms/psx',
            'GameCube': 'Emulation/roms/gc',
            'PlayStation/GameCube/Wii': 'Emulation/roms/wii'
          }
        },
        {
          id: 'retroid-pocket',
          name: 'Retroid Pocket',
          enabled: false,
          basePath: '',
          systemMappings: {
            'Nintendo Entertainment System': 'roms/NES',
            'Super Nintendo': 'roms/SNES',
            'Game Boy': 'roms/GB',
            'Game Boy Color': 'roms/GBC',
            'Game Boy Advance': 'roms/GBA',
            'Nintendo 64': 'roms/N64',
            'Nintendo DS': 'roms/NDS',
            'Sega Genesis': 'roms/GENESIS',
            'PlayStation': 'roms/PS1',
            'PSP': 'roms/PSP'
          }
        },
        {
          id: 'custom',
          name: 'Custom Profile',
          enabled: false,
          basePath: '',
          systemMappings: {}
        }
      ],
      artwork: {
        enabled: true,
        types: ['boxart', 'screenshot', 'banner', 'fanart'],
        defaultType: 'boxart'
      },
      scanning: {
        recursive: true,
        ignoreHidden: true
      },
      scraper: {
        enabled: false,
        service: 'screenscraper',
        credentials: {
          username: '',
          password: ''
        },
        autoScrape: false,
        artworkTypes: ['boxart', 'screenshot']
      }
    };
  }

  async load() {
    try {
      const data = await fs.readFile(this.configPath, 'utf8');
      this.config = JSON.parse(data);

      // Merge with defaults for any missing fields
      const defaults = this.getDefaultConfig();
      this.config = { ...defaults, ...this.config };
    } catch (error) {
      // Config doesn't exist, create default
      this.config = this.getDefaultConfig();
      await this.save();
    }
  }

  async save() {
    await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
  }

  get(key) {
    if (!key) return this.config;

    const keys = key.split('.');
    let value = this.config;

    for (const k of keys) {
      value = value?.[k];
    }

    return value;
  }

  async set(key, value) {
    const keys = key.split('.');
    let obj = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!obj[keys[i]]) obj[keys[i]] = {};
      obj = obj[keys[i]];
    }

    obj[keys[keys.length - 1]] = value;
    await this.save();
  }

  getSyncProfiles() {
    return this.config.syncProfiles || [];
  }

  async updateSyncProfile(profileId, updates) {
    const profiles = this.config.syncProfiles;
    const index = profiles.findIndex(p => p.id === profileId);

    if (index !== -1) {
      profiles[index] = { ...profiles[index], ...updates };
      await this.save();
      return profiles[index];
    }

    return null;
  }

  async addCustomSystemMapping(profileId, system, folder) {
    const profiles = this.config.syncProfiles;
    const profile = profiles.find(p => p.id === profileId);

    if (profile) {
      if (!profile.systemMappings) profile.systemMappings = {};
      profile.systemMappings[system] = folder;
      await this.save();
      return true;
    }

    return false;
  }

  getArtworkPath(romId, artworkType = 'boxart') {
    return path.join(this.artworkPath, artworkType, `${romId}.jpg`);
  }

  async importArtwork(romId, artworkType, sourcePath) {
    const destPath = this.getArtworkPath(romId, artworkType);
    await fs.copyFile(sourcePath, destPath);
    return destPath;
  }

  async deleteArtwork(romId, artworkType) {
    const artPath = this.getArtworkPath(romId, artworkType);
    try {
      await fs.unlink(artPath);
      return true;
    } catch (error) {
      return false;
    }
  }

  async artworkExists(romId, artworkType = 'boxart') {
    const artPath = this.getArtworkPath(romId, artworkType);
    try {
      await fs.access(artPath);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = ConfigManager;
