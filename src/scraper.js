const https = require('https');
const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class ScreenScraper {
  constructor(config) {
    this.config = config;
    this.baseUrl = 'https://www.screenscraper.fr/api2';

    // Dev credentials - users must register their own at screenscraper.fr
    // Without valid credentials, the API will reject requests
    this.devid = '';
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
      softname: this.softname,
      output: 'json',
      ...params
    };

    // Add user credentials if available
    if (credentials.username && credentials.password) {
      queryParams.ssid = credentials.username;
      queryParams.sspassword = credentials.password;
    }

    // Note: devid/devpassword are optional but provide better rate limits
    // Users can register as a developer at screenscraper.fr for higher quotas
    if (this.devid) {
      queryParams.devid = this.devid;
    }
    if (this.devpassword) {
      queryParams.devpassword = this.devpassword;
    }

    const queryString = Object.entries(queryParams)
      .filter(([key, value]) => value !== '' && value !== null && value !== undefined)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');

    const url = `${this.baseUrl}/${endpoint}.php?${queryString}`;

    // Debug log (remove credentials for security)
    const debugUrl = url.replace(/sspassword=[^&]+/, 'sspassword=***').replace(/devpassword=[^&]+/, 'devpassword=***');
    console.log('ScreenScraper API URL:', debugUrl);

    return url;
  }

  async makeRequest(url, maxRetries = 2) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // eslint-disable-next-line no-await-in-loop
        return await this.makeSingleRequest(url);
      } catch (error) {
        lastError = error;

        // Retry transient network/server failures
        const isTransient = /timed out|socket hang up|ECONNRESET|ENOTFOUND|EAI_AGAIN|429|5\d\d/i.test(error.message);
        if (!isTransient || attempt === maxRetries) {
          throw error;
        }

        const backoffMs = 750 * (attempt + 1);
        // eslint-disable-next-line no-await-in-loop
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    throw lastError;
  }

  async makeSingleRequest(url) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;

      const request = protocol.get(url, (res) => {
        const statusCode = res.statusCode || 0;

        // Handle redirects explicitly
        if ([301, 302, 303, 307, 308].includes(statusCode) && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, url).toString();
          res.resume();
          this.makeSingleRequest(redirectUrl).then(resolve).catch(reject);
          return;
        }

        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (statusCode >= 400) {
            const preview = data.substring(0, 200).trim();
            reject(new Error(`ScreenScraper request failed (${statusCode}): ${preview}`));
            return;
          }

          try {
            // Log response for debugging
            console.log('ScreenScraper Response:', data.substring(0, 500));

            const json = JSON.parse(data);

            // Check for API errors (boolean or string)
            const success = json?.header?.success;
            if (success === false || success === 'false') {
              reject(new Error(json.header.error || 'API request failed'));
              return;
            }

            resolve(json);
          } catch (error) {
            // Provide more context about what failed
            const preview = data.substring(0, 200);
            console.error('Failed to parse ScreenScraper response:', preview);

            // Check if it's an HTML error page
            if (data.trim().startsWith('<!DOCTYPE') || data.trim().startsWith('<html')) {
              reject(new Error('ScreenScraper returned an error page. Please check your credentials or try again later.'));
            } else {
              reject(new Error(`Failed to parse API response: ${preview}...`));
            }
          }
        });
      });

      request.setTimeout(15000, () => {
        request.destroy(new Error('ScreenScraper request timed out after 15s'));
      });

      request.on('error', (error) => {
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
    const releaseDates = this.normalizeToArray(jeu.dates);

    const game = {
      id: jeu.id,
      name: this.getLocalizedText(jeu.noms),
      description: this.getLocalizedText(jeu.synopsis),
      releaseDate: releaseDates[0]?.text || null,
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

  normalizeToArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  getLocalizedText(textArray) {
    const items = this.normalizeToArray(textArray);
    if (items.length === 0) return null;

    // Prefer English, then region-free, then first available
    const english = items.find(t => t.langue === 'en');
    if (english) return english.text;

    const regionFree = items.find(t => t.region === 'wor');
    if (regionFree) return regionFree.text;

    return items[0]?.text || null;
  }

  normalizeMediaUrl(url) {
    if (!url || typeof url !== 'string') return null;
    return url.trim().replace(/&amp;/g, '&');
  }

  extractMediaUrls(medias) {
    const mediaUrls = {
      boxart: {},
      boxart2d: {},
      boxart3d: {},
      screenshot: null,
      banner: null,
      fanart: null
    };

    const boxartPrefs = this.config.get('artwork.boxartPreferences') || {};
    const preferredRegion = boxartPrefs.preferredRegion || 'us';
    const fallbackRegions = boxartPrefs.fallbackRegions || ['wor', 'us', 'eu', 'jp'];
    const downloadAll = boxartPrefs.downloadAllVariants || false;

    const mediaEntries = this.normalizeToArray(medias);

    for (const media of mediaEntries) {
      const mediaType = media.type;
      const region = media.region || 'wor';
      const mediaUrl = this.normalizeMediaUrl(media.url);

      // Handle different boxart types separately
      if (mediaType === 'box-2D') {
        if (!mediaUrls.boxart2d[region] && mediaUrl) {
          mediaUrls.boxart2d[region] = mediaUrl;
        }
      } else if (mediaType === 'box-3D') {
        if (!mediaUrls.boxart3d[region] && mediaUrl) {
          mediaUrls.boxart3d[region] = mediaUrl;
        }
      } else if (mediaType === 'box-2D-side' || mediaType === 'box-spine') {
        if (!mediaUrls.boxart.spine && mediaUrl) {
          mediaUrls.boxart.spine = mediaUrl;
        }
      } else if (mediaType === 'screenmarquee') {
        if (!mediaUrls.banner && mediaUrl) {
          mediaUrls.banner = mediaUrl;
        }
      } else if (mediaType === 'sstitle' || mediaType === 'ss') {
        if (!mediaUrls.screenshot && mediaUrl) {
          mediaUrls.screenshot = mediaUrl;
        }
      } else if (mediaType === 'fanart') {
        if (!mediaUrls.fanart && mediaUrl) {
          mediaUrls.fanart = mediaUrl;
        }
      }
    }

    // Select best boxart based on preferences
    const preferredStyle = boxartPrefs.preferredStyle || '2d';
    const boxartSource = preferredStyle === '3d' ? mediaUrls.boxart3d : mediaUrls.boxart2d;

    const regionOrder = [preferredRegion, ...fallbackRegions].filter((region, index, list) => list.indexOf(region) === index);

    // Try preferred region first, then fallbacks
    for (const region of regionOrder) {
      if (boxartSource[region]) {
        mediaUrls.boxart.primary = boxartSource[region];
        mediaUrls.boxart.region = region;
        break;
      }
    }

    // If no preferred style found, try the other style
    if (!mediaUrls.boxart.primary) {
      const altSource = preferredStyle === '3d' ? mediaUrls.boxart2d : mediaUrls.boxart3d;
      for (const region of regionOrder) {
        if (altSource[region]) {
          mediaUrls.boxart.primary = altSource[region];
          mediaUrls.boxart.region = region;
          break;
        }
      }
    }

    return mediaUrls;
  }

  async downloadImage(url, destPath, maxRedirects = 3) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const file = require('fs').createWriteStream(destPath);

      const request = protocol.get(url, (response) => {
        const statusCode = response.statusCode || 0;

        if ([301, 302, 303, 307, 308].includes(statusCode) && response.headers.location) {
          if (maxRedirects <= 0) {
            file.close(() => require('fs').unlink(destPath, () => {}));
            response.resume();
            reject(new Error('Too many redirects while downloading artwork'));
            return;
          }

          const redirectUrl = new URL(response.headers.location, url).toString();
          response.resume();
          file.close(() => require('fs').unlink(destPath, () => {}));
          this.downloadImage(redirectUrl, destPath, maxRedirects - 1).then(resolve).catch(reject);
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          const error = new Error(`Failed to download image (${statusCode})`);
          file.close(() => require('fs').unlink(destPath, () => {}));
          response.resume();
          reject(error);
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve(destPath);
        });
      });

      request.setTimeout(20000, () => {
        request.destroy(new Error('Image download timed out after 20s'));
      });

      request.on('error', (error) => {
        file.close(() => require('fs').unlink(destPath, () => {})); // Delete partial file
        reject(error);
      });

      file.on('error', (error) => {
        file.close(() => require('fs').unlink(destPath, () => {}));
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

  normalizeArtworkTypeForPath(artType) {
    const artworkTypeMap = {
      screenshot: 'screenshots',
      banner: 'banners',
      fanart: 'fanart',
      boxart: 'boxart'
    };

    return artworkTypeMap[artType] || artType;
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
      const boxartPrefs = this.config.get('artwork.boxartPreferences') || {};
      const downloadAll = boxartPrefs.downloadAllVariants || false;

      for (const artType of artworkTypes) {
        // Handle boxart with variants
        if (artType === 'boxart') {
          // Download primary (preferred) boxart
          if (gameInfo.media.boxart.primary) {
            await this.waitForRateLimit();
            const artPath = this.config.getArtworkPath(rom.id, 'boxart');
            await this.downloadImage(gameInfo.media.boxart.primary, artPath);
            downloadedArtwork.boxart = artPath;
            downloadedArtwork.boxartRegion = gameInfo.media.boxart.region || 'unknown';
          }

          // Optionally download all variants
          if (downloadAll) {
            // Download best 2D variant
            const preferredRegion = boxartPrefs.preferredRegion || 'us';
            const fallbacks = boxartPrefs.fallbackRegions || ['wor', 'us', 'eu', 'jp'];
            const regionOrder = [preferredRegion, ...fallbacks].filter((region, index, list) => list.indexOf(region) === index);

            for (const region of regionOrder) {
              if (gameInfo.media.boxart2d[region]) {
                await this.waitForRateLimit();
                const artPath = this.config.getArtworkPath(rom.id, 'boxart', '2d');
                await this.downloadImage(gameInfo.media.boxart2d[region], artPath);
                downloadedArtwork.boxart2d = artPath;
                break;
              }
            }

            // Download best 3D variant
            for (const region of regionOrder) {
              if (gameInfo.media.boxart3d[region]) {
                await this.waitForRateLimit();
                const artPath = this.config.getArtworkPath(rom.id, 'boxart', '3d');
                await this.downloadImage(gameInfo.media.boxart3d[region], artPath);
                downloadedArtwork.boxart3d = artPath;
                break;
              }
            }
          }
        } else if (gameInfo.media[artType]) {
          // Handle other artwork types (screenshot, banner, fanart)
          await this.waitForRateLimit();
          const configArtworkType = this.normalizeArtworkTypeForPath(artType);
          const artPath = this.config.getArtworkPath(rom.id, configArtworkType);
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
      const credentials = this.config.get('scraper.credentials') || {};

      // Check if user has provided credentials
      if (!credentials.username || !credentials.password) {
        return {
          success: false,
          error: 'Please enter your ScreenScraper username and password. Register for free at screenscraper.fr to get API access.'
        };
      }

      console.log('[ScreenScraper] Testing credentials for user:', credentials.username);

      const url = this.buildUrl('jeuInfos', {
        systemeid: 1,
        romnom: 'Sonic'
      });

      await this.waitForRateLimit();
      const response = await this.makeRequest(url);

      console.log('[ScreenScraper] Credentials test successful!');
      return { success: true };
    } catch (error) {
      console.error('[ScreenScraper] Credentials test failed:', error.message);

      // Provide more helpful error messages
      if (error.message.includes('Erreur de login') || error.message.includes('identifiants')) {
        return {
          success: false,
          error: 'Invalid ScreenScraper credentials. Check your username and password. Note: ScreenScraper may require developer credentials for API access. Visit https://www.screenscraper.fr/forumsujets.php?suj=784 to apply for dev credentials.'
        };
      }
      return { success: false, error: error.message };
    }
  }
}

module.exports = ScreenScraper;
