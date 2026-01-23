const https = require('https');
const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class ScreenScraper {
  constructor(config) {
    this.config = config;
    this.baseUrl = 'https://www.screenscraper.fr/api2';

    // Dev credentials for RomTunes
    // Note: Users should register at screenscraper.fr for better rate limits
    this.devid = 'romtunes';
    this.devpassword = '';
    this.softname = 'RomTunes';
    this.lastRequestTime = 0;
    this.minRequestInterval = 2000; // 2 seconds between requests
  }

  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  buildUrl(endpoint, params = {}) {
    const credentials = this.config.get('scraper.credentials') || {};

    const queryParams = {
      devid: this.devid,
      devpassword: this.devpassword,
      softname: this.softname,
      output: 'json',
      ...params
    };

    // Add user credentials if available
    if (credentials.username && credentials.password) {
      queryParams.ssid = credentials.username;
      queryParams.sspassword = credentials.password;
    }

    const queryString = Object.entries(queryParams)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');

    return `${this.baseUrl}/${endpoint}.php?${queryString}`;
  }

  async makeRequest(url) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;

      protocol.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const json = JSON.parse(data);

            // Check for API errors
            if (json.header && json.header.success === false) {
              reject(new Error(json.header.error || 'API request failed'));
              return;
            }

            resolve(json);
          } catch (error) {
            reject(new Error('Failed to parse API response'));
          }
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }

  getSystemId(systemName) {
    const systemMap = {
      'Nintendo Entertainment System': 3,
      'Super Nintendo': 4,
      'Game Boy': 9,
      'Game Boy Color': 10,
      'Game Boy Advance': 12,
      'Nintendo 64': 14,
      'Nintendo DS': 15,
      'Nintendo 3DS': 17,
      'Sega Genesis': 1,
      'Sega Master System': 2,
      'Game Gear': 8,
      'PlayStation': 57,
      'PSP': 61,
      'GameCube': 13,
      'Wii': 16
    };

    return systemMap[systemName] || null;
  }

  async searchGameByFilename(filename, systemName) {
    await this.waitForRateLimit();

    const systemId = this.getSystemId(systemName);
    if (!systemId) {
      throw new Error(`System not supported: ${systemName}`);
    }

    // Clean filename (remove extension and common tags)
    const cleanName = path.basename(filename, path.extname(filename))
      .replace(/\(.*?\)/g, '') // Remove parentheses content
      .replace(/\[.*?\]/g, '') // Remove brackets content
      .trim();

    const url = this.buildUrl('jeuInfos', {
      systemeid: systemId,
      romnom: cleanName
    });

    try {
      const response = await this.makeRequest(url);

      if (response.response && response.response.jeu) {
        return this.parseGameInfo(response.response.jeu);
      }

      return null;
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  async searchGameByCRC(crc, systemName) {
    await this.waitForRateLimit();

    const systemId = this.getSystemId(systemName);
    if (!systemId) {
      throw new Error(`System not supported: ${systemName}`);
    }

    const url = this.buildUrl('jeuInfos', {
      systemeid: systemId,
      crc: crc.toUpperCase()
    });

    try {
      const response = await this.makeRequest(url);

      if (response.response && response.response.jeu) {
        return this.parseGameInfo(response.response.jeu);
      }

      return null;
    } catch (error) {
      console.error('CRC search error:', error);
      throw error;
    }
  }

  parseGameInfo(jeu) {
    const game = {
      id: jeu.id,
      name: this.getLocalizedText(jeu.noms),
      description: this.getLocalizedText(jeu.synopsis),
      releaseDate: jeu.dates ? jeu.dates[0]?.text : null,
      publisher: jeu.editeur?.text || null,
      developer: jeu.developpeur?.text || null,
      genre: this.getLocalizedText(jeu.genres),
      players: jeu.joueurs?.text || null,
      rating: jeu.note?.text || null,
      media: {}
    };

    // Extract artwork URLs
    if (jeu.medias) {
      game.media = this.extractMediaUrls(jeu.medias);
    }

    return game;
  }

  getLocalizedText(textArray) {
    if (!textArray || textArray.length === 0) return null;

    // Prefer English, then region-free, then first available
    const english = textArray.find(t => t.langue === 'en');
    if (english) return english.text;

    const regionFree = textArray.find(t => t.region === 'wor');
    if (regionFree) return regionFree.text;

    return textArray[0]?.text || null;
  }

  extractMediaUrls(medias) {
    const mediaUrls = {};

    // Map ScreenScraper media types to our types
    const mediaTypeMap = {
      'box-2D': 'boxart',
      'box-3D': 'boxart',
      'screenmarquee': 'banner',
      'sstitle': 'screenshot',
      'ss': 'screenshot',
      'fanart': 'fanart'
    };

    for (const media of medias) {
      const mediaType = media.type;
      const ourType = mediaTypeMap[mediaType];

      if (ourType && media.url) {
        // Prefer higher resolution, or first found
        if (!mediaUrls[ourType] || media.format === 'png') {
          mediaUrls[ourType] = media.url;
        }
      }
    }

    return mediaUrls;
  }

  async downloadImage(url, destPath) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const file = require('fs').createWriteStream(destPath);

      protocol.get(url, (response) => {
        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve(destPath);
        });
      }).on('error', (error) => {
        require('fs').unlink(destPath, () => {}); // Delete partial file
        reject(error);
      });
    });
  }

  async calculateCRC32(filePath) {
    try {
      const data = await fs.readFile(filePath);

      // For large files, only read first 8MB for performance
      const bufferToHash = data.length > 8 * 1024 * 1024
        ? data.slice(0, 8 * 1024 * 1024)
        : data;

      // Simple CRC32 calculation
      let crc = 0xFFFFFFFF;
      for (let i = 0; i < bufferToHash.length; i++) {
        crc = crc ^ bufferToHash[i];
        for (let j = 0; j < 8; j++) {
          crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
        }
      }

      return ((crc ^ 0xFFFFFFFF) >>> 0).toString(16).toUpperCase().padStart(8, '0');
    } catch (error) {
      console.error('CRC calculation error:', error);
      return null;
    }
  }

  async scrapeRom(rom, artworkTypes = ['boxart', 'screenshot']) {
    try {
      // Try filename search first
      let gameInfo = await this.searchGameByFilename(rom.filename, rom.system);

      // If no result, try CRC (if file is accessible and reasonably sized)
      if (!gameInfo && rom.size < 50 * 1024 * 1024) { // Only for files < 50MB
        const crc = await this.calculateCRC32(rom.path);
        if (crc) {
          gameInfo = await this.searchGameByCRC(crc, rom.system);
        }
      }

      if (!gameInfo) {
        return { success: false, error: 'Game not found in database' };
      }

      // Download requested artwork types
      const downloadedArtwork = {};

      for (const artType of artworkTypes) {
        if (gameInfo.media[artType]) {
          await this.waitForRateLimit();

          const artPath = this.config.getArtworkPath(rom.id, artType);
          await this.downloadImage(gameInfo.media[artType], artPath);
          downloadedArtwork[artType] = artPath;
        }
      }

      return {
        success: true,
        gameInfo,
        downloadedArtwork
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async testCredentials() {
    try {
      const url = this.buildUrl('jeuInfos', {
        systemeid: 1,
        romnom: 'Sonic'
      });

      await this.waitForRateLimit();
      await this.makeRequest(url);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = ScreenScraper;
