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
          firmware: 'OnionOS',
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
          },
          artworkSettings: {
            enabled: true,
            folder: 'Imgs',
            dimensions: { width: 251, height: 361 },
            format: 'png',
            preferredType: '2d',
            preferredRegion: 'us'
          }
        },
        {
          id: 'anbernic-rg35xx',
          name: 'Anbernic RG35XX',
          firmware: 'GarlicOS',
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
          },
          artworkSettings: {
            enabled: true,
            folder: 'Imgs',
            dimensions: { width: 251, height: 361 },
            format: 'png',
            preferredType: '2d',
            preferredRegion: 'us'
          }
        },
        {
          id: 'anbernic-rg35xx-knulli',
          name: 'Anbernic RG35XX (Knulli/MuOS)',
          firmware: 'Knulli',
          enabled: false,
          basePath: '',
          systemMappings: {
            'Nintendo Entertainment System': 'roms/nes',
            'Super Nintendo': 'roms/snes',
            'Game Boy': 'roms/gb',
            'Game Boy Color': 'roms/gbc',
            'Game Boy Advance': 'roms/gba',
            'Nintendo 64': 'roms/n64',
            'Sega Genesis': 'roms/genesis',
            'Sega Master System': 'roms/mastersystem',
            'Game Gear': 'roms/gamegear',
            'PlayStation': 'roms/psx'
          },
          artworkSettings: {
            enabled: true,
            folder: '.boxart',
            dimensions: { width: 400, height: 300 },
            format: 'png',
            preferredType: '2d',
            preferredRegion: 'us'
          }
        },
        {
          id: 'steam-deck',
          name: 'Steam Deck',
          firmware: 'EmuDeck',
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
          },
          artworkSettings: {
            enabled: true,
            folder: 'boxart',
            dimensions: { width: 600, height: 900 },
            format: 'png',
            preferredType: '3d',
            preferredRegion: 'us'
          }
        },
        {
          id: 'retroid-pocket',
          name: 'Retroid Pocket',
          firmware: 'Android',
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
          },
          artworkSettings: {
            enabled: true,
            folder: 'boxart',
            dimensions: { width: 400, height: 600 },
            format: 'png',
            preferredType: '3d',
            preferredRegion: 'us'
          }
        },
        {
          id: 'custom',
          name: 'Custom Profile',
          firmware: 'Custom',
          enabled: false,
          basePath: '',
          systemMappings: {},
          artworkSettings: {
            enabled: true,
            folder: 'boxart',
            dimensions: { width: 400, height: 600 },
            format: 'png',
            preferredType: '2d',
            preferredRegion: 'us'
          }
        }
      ],
      artwork: {
        enabled: true,
        types: ['boxart', 'screenshot', 'banner', 'fanart'],
        defaultType: 'boxart',
        boxartPreferences: {
          preferredStyle: '2d', // '2d', '3d', 'spine', 'full'
          preferredRegion: 'us', // 'us', 'eu', 'jp', 'wor' (world)
          fallbackRegions: ['wor', 'us', 'eu', 'jp'],
          downloadAllVariants: false, // Download all boxart types
          autoConvert: true // Auto-convert to device specs on sync
        }
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

  getArtworkPath(romId, artworkType = 'boxart', variant = null) {
    // Validate artworkType to prevent path traversal
    const allowedTypes = ['boxart', 'screenshots', 'banners', 'fanart'];
    if (!allowedTypes.includes(artworkType)) {
      artworkType = 'boxart';
    }

    // Handle boxart variants (2d, 3d)
    let filename = `${romId}.jpg`;
    if (artworkType === 'boxart' && variant) {
      filename = `${romId}.${variant}.jpg`;
    }

    return path.join(this.artworkPath, artworkType, filename);
  }

  async importArtwork(romId, artworkType, sourcePath) {
    // Validate artworkType
    const allowedTypes = ['boxart', 'screenshots', 'banners', 'fanart'];
    if (!allowedTypes.includes(artworkType)) {
      throw new Error(`Invalid artwork type: ${artworkType}`);
    }

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
