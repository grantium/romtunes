const https = require('https');
const http = require('http');
const fs = require('fs').promises;
const path = require('path');

class TheGamesDB {
  constructor(config) {
    this.config = config;
    this.baseUrl = 'https://api.thegamesdb.net/v1';
    this.lastRequestTime = 0;
    this.minRequestInterval = 1000; // 1 second between requests (generous limit)
  }

  // Get API key fresh from config each time (allows updating without restart)
  getApiKey() {
    const credentials = this.config.get('scraper.thegamesdb') || {};
    return credentials.apiKey || '';
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
    const queryParams = {
      apikey: this.getApiKey(),
      ...params
    };

    const queryString = Object.entries(queryParams)
      .filter(([key, value]) => value !== '' && value !== null && value !== undefined)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');

    const url = `${this.baseUrl}/${endpoint}?${queryString}`;
    console.log('[TheGamesDB] API URL:', url);

    return url;
  }

  async makeRequest(url) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;

      protocol.get(url, (res) => {
        let data = '';

        // Log HTTP status
        console.log(`[TheGamesDB] HTTP Status: ${res.statusCode}`);

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            console.log('[TheGamesDB] Response (first 500 chars):', data.substring(0, 500));

            // Check if response is HTML error page before parsing
            const trimmed = data.trim();
            if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<HTML')) {
              console.error('[TheGamesDB] Received HTML response instead of JSON');
              console.error('[TheGamesDB] Full response:', data);
              reject(new Error('TheGamesDB returned an error page. Your API key may be invalid or you may have exceeded the rate limit. Get a free API key at https://forums.thegamesdb.net/viewforum.php?f=10'));
              return;
            }

            const json = JSON.parse(data);

            // Check for API errors
            if (json.code && json.code !== 200) {
              console.error('[TheGamesDB] API error code:', json.code, 'Status:', json.status);
              reject(new Error(json.status || 'API request failed'));
              return;
            }

            // Check for successful response structure
            if (!json.data) {
              console.warn('[TheGamesDB] Response missing data field:', json);
            }

            resolve(json);
          } catch (error) {
            const preview = data.substring(0, 200);
            console.error('[TheGamesDB] Failed to parse response:', preview);
            console.error('[TheGamesDB] Parse error:', error.message);
            reject(new Error(`Failed to parse API response: ${preview}...`));
          }
        });
      }).on('error', (error) => {
        console.error('[TheGamesDB] Network error:', error);
        reject(error);
      });
    });
  }

  getPlatformId(systemName) {
    // TheGamesDB platform IDs
    const platformMap = {
      'Nintendo Entertainment System': 7,
      'Super Nintendo': 6,
      'Game Boy': 4,
      'Game Boy Color': 41,
      'Game Boy Advance': 5,
      'Nintendo 64': 3,
      'Nintendo DS': 8,
      'Nintendo 3DS': 4912,
      'Sega Genesis': 18,
      'Sega Master System': 35,
      'Game Gear': 20,
      'PlayStation': 10,
      'PSP': 13,
      'GameCube': 2,
      'Wii': 9
    };

    return platformMap[systemName] || null;
  }

  async searchGameByName(gameName, systemName) {
    await this.waitForRateLimit();

    const platformId = this.getPlatformId(systemName);
    console.log(`[TheGamesDB] Searching for: "${gameName}" on platform: ${systemName} (ID: ${platformId})`);

    const params = {
      name: gameName
    };

    if (platformId) {
      params.filter = `platform:${platformId}`;
    }

    const url = this.buildUrl('Games/ByGameName', params);
    console.log('[TheGamesDB] Search URL:', url.replace(/apikey=[^&]+/, 'apikey=***'));

    try {
      const response = await this.makeRequest(url);

      console.log('[TheGamesDB] Search response data:', response.data ? 'Present' : 'Missing');
      console.log('[TheGamesDB] Games found:', response.data?.games?.length || 0);

      if (response.data && response.data.games && response.data.games.length > 0) {
        // Get the first match
        const game = response.data.games[0];
        console.log('[TheGamesDB] First match:', game.game_title);
        return await this.getGameDetails(game.id, response.data.base_url);
      }

      console.log('[TheGamesDB] No games found for:', gameName);
      return null;
    } catch (error) {
      console.error('[TheGamesDB] Search error:', error.message);
      throw error;
    }
  }

  async getGameDetails(gameId, baseUrl) {
    await this.waitForRateLimit();

    const url = this.buildUrl('Games/ByGameID', {
      id: gameId,
      fields: 'players,publishers,genres,overview,rating',
      include: 'boxart'
    });

    try {
      const response = await this.makeRequest(url);

      if (!response.data || !response.data.games || response.data.games.length === 0) {
        return null;
      }

      const game = response.data.games[0];
      const imagesBaseUrl = baseUrl || response.data.base_url;

      return this.parseGameInfo(game, imagesBaseUrl, response.include);
    } catch (error) {
      console.error('[TheGamesDB] Details error:', error);
      throw error;
    }
  }

  parseGameInfo(game, baseUrl, includeData) {
    const gameInfo = {
      id: game.id,
      name: game.game_title,
      description: game.overview || null,
      releaseDate: game.release_date || null,
      publisher: game.publishers && game.publishers.length > 0 ? game.publishers[0] : null,
      developer: game.developers && game.developers.length > 0 ? game.developers[0] : null,
      genre: game.genres && game.genres.length > 0 ? game.genres.join(', ') : null,
      players: game.players || null,
      rating: game.rating || null,
      media: {}
    };

    // Extract artwork URLs
    if (includeData && includeData.boxart && includeData.boxart.data) {
      const boxartData = includeData.boxart.data[game.id];
      if (boxartData) {
        gameInfo.media = this.extractMediaUrls(boxartData, baseUrl);
      }
    }

    return gameInfo;
  }

  extractMediaUrls(boxartData, baseUrl) {
    const mediaUrls = {
      boxart: {},
      screenshot: null,
      banner: null,
      fanart: null
    };

    const boxartPrefs = this.config.get('artwork.boxartPreferences') || {};
    const preferredRegion = boxartPrefs.preferredRegion || 'us';

    // TheGamesDB uses 'front', 'back', 'banner', 'screenshot', 'fanart', etc.
    for (const artwork of boxartData) {
      const type = artwork.type;
      const side = artwork.side;
      const filename = artwork.filename;
      const fullUrl = `${baseUrl.images}${filename}`;

      if (type === 'boxart' && side === 'front') {
        // Store by region if available (though TheGamesDB doesn't specify regions as clearly)
        if (!mediaUrls.boxart.primary) {
          mediaUrls.boxart.primary = fullUrl;
          mediaUrls.boxart.region = 'us'; // Default assumption
        }
      } else if (type === 'boxart' && side === 'back') {
        mediaUrls.boxart.back = fullUrl;
      } else if (type === 'banner') {
        mediaUrls.banner = fullUrl;
      } else if (type === 'screenshot') {
        if (!mediaUrls.screenshot) {
          mediaUrls.screenshot = fullUrl;
        }
      } else if (type === 'fanart') {
        if (!mediaUrls.fanart) {
          mediaUrls.fanart = fullUrl;
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

  async scrapeRom(rom, artworkTypes = ['boxart', 'screenshot']) {
    try {
      const apiKey = this.getApiKey();
      if (!apiKey) {
        return {
          success: false,
          error: 'TheGamesDB API key is not configured. Please add your API key in Settings → Scraper tab.'
        };
      }

      // Clean ROM name (remove extension and common tags)
      const cleanName = path.basename(rom.filename, rom.extension)
        .replace(/\(.*?\)/g, '') // Remove parentheses content
        .replace(/\[.*?\]/g, '') // Remove brackets content
        .trim();

      console.log(`[TheGamesDB] Searching for: ${cleanName} (${rom.system})`);

      const gameInfo = await this.searchGameByName(cleanName, rom.system);

      if (!gameInfo) {
        return { success: false, error: 'Game not found in database' };
      }

      console.log(`[TheGamesDB] Found: ${gameInfo.name}`);

      // Download requested artwork types
      const downloadedArtwork = {};

      for (const artType of artworkTypes) {
        if (artType === 'boxart' && gameInfo.media.boxart.primary) {
          await this.waitForRateLimit();
          const artPath = this.config.getArtworkPath(rom.id, 'boxart');
          await this.downloadImage(gameInfo.media.boxart.primary, artPath);
          downloadedArtwork.boxart = artPath;
          downloadedArtwork.boxartRegion = gameInfo.media.boxart.region || 'us';
        } else if (gameInfo.media[artType]) {
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
      console.error('[TheGamesDB] Scrape error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async testCredentials() {
    try {
      const apiKey = this.getApiKey();
      if (!apiKey) {
        return {
          success: false,
          error: 'Please enter your TheGamesDB API key. Register for free at https://forums.thegamesdb.net/viewforum.php?f=10'
        };
      }

      console.log('[TheGamesDB] Testing API key...');

      const url = this.buildUrl('Platforms', {});

      await this.waitForRateLimit();
      await this.makeRequest(url);

      console.log('[TheGamesDB] API key valid!');
      return { success: true };
    } catch (error) {
      console.error('[TheGamesDB] API key test failed:', error.message);
      return {
        success: false,
        error: `TheGamesDB error: ${error.message}`
      };
    }
  }
}

module.exports = TheGamesDB;
