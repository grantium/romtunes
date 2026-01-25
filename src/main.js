const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const AdmZip = require('adm-zip');
const Database = require('./database');
const ConfigManager = require('./config');
const SyncManager = require('./sync');
const ScreenScraper = require('./scraper');
const TheGamesDB = require('./scrapers/thegamesdb');

let mainWindow;
let db;
let config;
let syncManager;
let scraper;

// Get the active scraper based on config
function getActiveScraper() {
  const scraperProvider = config.get('scraper.provider') || 'thegamesdb';

  if (scraperProvider === 'screenscraper') {
    if (!scraper || scraper.constructor.name !== 'ScreenScraper') {
      console.log('[Scraper] Initializing ScreenScraper');
      scraper = new ScreenScraper(config);
    }
  } else {
    if (!scraper || scraper.constructor.name !== 'TheGamesDB') {
      console.log('[Scraper] Initializing TheGamesDB');
      scraper = new TheGamesDB(config);
    }
  }

  return scraper;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1a1a1a',
      symbolColor: '#ffffff'
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(async () => {
  config = new ConfigManager();
  await config.init();

  db = new Database();
  syncManager = new SyncManager(config, db);

  // Initialize default scraper
  getActiveScraper();

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    db.close();
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'ROM Files',
        extensions: ['nes', 'smc', 'sfc', 'gb', 'gbc', 'gba', 'n64', 'z64', 'v64', 'nds', '3ds', 'iso', 'cue', 'bin', 'gcm', 'cso', 'md', 'smd', 'gen', 'gg', 'sms', 'rom', 'zip', '7z']
      },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths;
  }
  return null;
});

ipcMain.handle('scan-roms', async (event, folderPath) => {
  const romExtensions = [
    '.nes', '.smc', '.sfc', '.gb', '.gbc', '.gba',
    '.n64', '.z64', '.v64', '.nds', '.3ds',
    '.iso', '.cue', '.bin', '.gcm', '.cso',
    '.md', '.smd', '.gen', '.gg', '.sms',
    '.rom', '.zip', '.7z'
  ];

  async function scanDirectory(dir) {
    const roms = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const subRoms = await scanDirectory(fullPath);
        roms.push(...subRoms);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (romExtensions.includes(ext)) {
          const stats = await fs.stat(fullPath);
          roms.push({
            name: path.basename(entry.name, ext),
            filename: entry.name,
            path: fullPath,
            size: stats.size,
            extension: ext,
            system: await detectSystem(ext, fullPath),
            dateAdded: new Date().toISOString()
          });
        }
      }
    }

    return roms;
  }

  async function detectSystem(extension, filePath) {
    const systemMap = {
      '.nes': 'Nintendo Entertainment System',
      '.smc': 'Super Nintendo',
      '.sfc': 'Super Nintendo',
      '.gb': 'Game Boy',
      '.gbc': 'Game Boy Color',
      '.gba': 'Game Boy Advance',
      '.n64': 'Nintendo 64',
      '.z64': 'Nintendo 64',
      '.v64': 'Nintendo 64',
      '.nds': 'Nintendo DS',
      '.3ds': 'Nintendo 3DS',
      '.md': 'Sega Genesis',
      '.smd': 'Sega Genesis',
      '.gen': 'Sega Genesis',
      '.gg': 'Game Gear',
      '.sms': 'Sega Master System',
      '.iso': 'PlayStation/GameCube/Wii',
      '.cue': 'PlayStation',
      '.bin': 'PlayStation',
      '.gcm': 'GameCube',
      '.cso': 'PSP'
    };

    // For non-archive files, use extension mapping
    if (extension !== '.zip' && extension !== '.7z') {
      return systemMap[extension] || 'Unknown';
    }

    // For ZIP/7z files, try to detect from the archive contents
    try {
      const zip = new AdmZip(filePath);
      const zipEntries = zip.getEntries();

      // Look for ROM files inside the archive
      for (const entry of zipEntries) {
        if (!entry.isDirectory) {
          const romExt = path.extname(entry.entryName).toLowerCase();
          if (systemMap[romExt]) {
            console.log(`Detected ${systemMap[romExt]} from ${entry.entryName} in ${path.basename(filePath)}`);
            return systemMap[romExt];
          }
        }
      }
    } catch (error) {
      console.error(`Failed to read archive ${filePath}:`, error.message);
    }

    // Fallback: try to detect from parent directory name
    const dirName = path.basename(path.dirname(filePath)).toLowerCase();
    const dirSystemMap = {
      'nes': 'Nintendo Entertainment System',
      'nintendo entertainment system': 'Nintendo Entertainment System',
      'snes': 'Super Nintendo',
      'super nintendo': 'Super Nintendo',
      'gb': 'Game Boy',
      'game boy': 'Game Boy',
      'gbc': 'Game Boy Color',
      'game boy color': 'Game Boy Color',
      'gba': 'Game Boy Advance',
      'game boy advance': 'Game Boy Advance',
      'n64': 'Nintendo 64',
      'nintendo 64': 'Nintendo 64',
      'nds': 'Nintendo DS',
      'nintendo ds': 'Nintendo DS',
      '3ds': 'Nintendo 3DS',
      'nintendo 3ds': 'Nintendo 3DS',
      'genesis': 'Sega Genesis',
      'sega genesis': 'Sega Genesis',
      'megadrive': 'Sega Genesis',
      'mega drive': 'Sega Genesis',
      'md': 'Sega Genesis',
      'gg': 'Game Gear',
      'game gear': 'Game Gear',
      'sms': 'Sega Master System',
      'master system': 'Sega Master System',
      'ps1': 'PlayStation',
      'psx': 'PlayStation',
      'playstation': 'PlayStation',
      'gamecube': 'GameCube',
      'gc': 'GameCube',
      'wii': 'Wii',
      'psp': 'PSP'
    };

    if (dirSystemMap[dirName]) {
      console.log(`Detected ${dirSystemMap[dirName]} from directory name for ${path.basename(filePath)}`);
      return dirSystemMap[dirName];
    }

    return 'Unknown';
  }

  try {
    const roms = await scanDirectory(folderPath);

    // Add ROMs to database
    for (const rom of roms) {
      db.addRom(rom);
    }

    return { success: true, count: roms.length };
  } catch (error) {
    console.error('Error scanning ROMs:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('import-files', async (event, filePaths) => {
  const romExtensions = [
    '.nes', '.smc', '.sfc', '.gb', '.gbc', '.gba',
    '.n64', '.z64', '.v64', '.nds', '.3ds',
    '.iso', '.cue', '.bin', '.gcm', '.cso',
    '.md', '.smd', '.gen', '.gg', '.sms',
    '.rom', '.zip', '.7z'
  ];

  async function detectSystem(extension, filePath) {
    const systemMap = {
      '.nes': 'Nintendo Entertainment System',
      '.smc': 'Super Nintendo',
      '.sfc': 'Super Nintendo',
      '.gb': 'Game Boy',
      '.gbc': 'Game Boy Color',
      '.gba': 'Game Boy Advance',
      '.n64': 'Nintendo 64',
      '.z64': 'Nintendo 64',
      '.v64': 'Nintendo 64',
      '.nds': 'Nintendo DS',
      '.3ds': 'Nintendo 3DS',
      '.md': 'Sega Genesis',
      '.smd': 'Sega Genesis',
      '.gen': 'Sega Genesis',
      '.gg': 'Game Gear',
      '.sms': 'Sega Master System',
      '.iso': 'PlayStation/GameCube/Wii',
      '.cue': 'PlayStation',
      '.bin': 'PlayStation',
      '.gcm': 'GameCube',
      '.cso': 'PSP'
    };

    // For non-archive files, use extension mapping
    if (extension !== '.zip' && extension !== '.7z') {
      return systemMap[extension] || 'Unknown';
    }

    // For ZIP/7z files, try to detect from the archive contents
    try {
      const zip = new AdmZip(filePath);
      const zipEntries = zip.getEntries();

      // Look for ROM files inside the archive
      for (const entry of zipEntries) {
        if (!entry.isDirectory) {
          const romExt = path.extname(entry.entryName).toLowerCase();
          if (systemMap[romExt]) {
            console.log(`Detected ${systemMap[romExt]} from ${entry.entryName} in ${path.basename(filePath)}`);
            return systemMap[romExt];
          }
        }
      }
    } catch (error) {
      console.error(`Failed to read archive ${filePath}:`, error.message);
    }

    // Fallback: try to detect from parent directory name
    const dirName = path.basename(path.dirname(filePath)).toLowerCase();
    const dirSystemMap = {
      'nes': 'Nintendo Entertainment System',
      'nintendo entertainment system': 'Nintendo Entertainment System',
      'snes': 'Super Nintendo',
      'super nintendo': 'Super Nintendo',
      'gb': 'Game Boy',
      'game boy': 'Game Boy',
      'gbc': 'Game Boy Color',
      'game boy color': 'Game Boy Color',
      'gba': 'Game Boy Advance',
      'game boy advance': 'Game Boy Advance',
      'n64': 'Nintendo 64',
      'nintendo 64': 'Nintendo 64',
      'nds': 'Nintendo DS',
      'nintendo ds': 'Nintendo DS',
      '3ds': 'Nintendo 3DS',
      'nintendo 3ds': 'Nintendo 3DS',
      'genesis': 'Sega Genesis',
      'sega genesis': 'Sega Genesis',
      'megadrive': 'Sega Genesis',
      'mega drive': 'Sega Genesis',
      'md': 'Sega Genesis',
      'gg': 'Game Gear',
      'game gear': 'Game Gear',
      'sms': 'Sega Master System',
      'master system': 'Sega Master System',
      'ps1': 'PlayStation',
      'psx': 'PlayStation',
      'playstation': 'PlayStation',
      'gamecube': 'GameCube',
      'gc': 'GameCube',
      'wii': 'Wii',
      'psp': 'PSP'
    };

    if (dirSystemMap[dirName]) {
      console.log(`Detected ${dirSystemMap[dirName]} from directory name for ${path.basename(filePath)}`);
      return dirSystemMap[dirName];
    }

    return 'Unknown';
  }

  try {
    const roms = [];

    for (const filePath of filePaths) {
      const ext = path.extname(filePath).toLowerCase();

      if (romExtensions.includes(ext)) {
        const stats = await fs.stat(filePath);
        const filename = path.basename(filePath);

        roms.push({
          name: path.basename(filePath, ext),
          filename: filename,
          path: filePath,
          size: stats.size,
          extension: ext,
          system: await detectSystem(ext, filePath),
          dateAdded: new Date().toISOString()
        });
      }
    }

    // Add ROMs to database
    for (const rom of roms) {
      db.addRom(rom);
    }

    return { success: true, count: roms.length };
  } catch (error) {
    console.error('Error importing files:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-roms', async (event, filters) => {
  return db.getRoms(filters);
});

ipcMain.handle('get-systems', async () => {
  return db.getSystems();
});

ipcMain.handle('delete-rom', async (event, id) => {
  return db.deleteRom(id);
});

ipcMain.handle('update-rom', async (event, id, updates) => {
  try {
    return db.updateRom(id, updates);
  } catch (error) {
    console.error('Error updating ROM:', error);
    throw error;
  }
});

ipcMain.handle('get-stats', async () => {
  return db.getStats();
});

// Config Handlers
ipcMain.handle('get-config', async (event, key) => {
  return config.get(key);
});

ipcMain.handle('set-config', async (event, key, value) => {
  return config.set(key, value);
});

ipcMain.handle('get-sync-profiles', async () => {
  return config.getSyncProfiles();
});

ipcMain.handle('update-sync-profile', async (event, profileId, updates) => {
  return config.updateSyncProfile(profileId, updates);
});

ipcMain.handle('add-system-mapping', async (event, profileId, system, folder) => {
  return config.addCustomSystemMapping(profileId, system, folder);
});

// Artwork Handlers
ipcMain.handle('select-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('import-artwork', async (event, romId, artworkType, sourcePath) => {
  try {
    const destPath = await config.importArtwork(romId, artworkType, sourcePath);

    // Update database
    const updates = {};
    updates[artworkType] = destPath;
    db.updateRom(romId, updates);

    return { success: true, path: destPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-artwork', async (event, romId, artworkType) => {
  try {
    await config.deleteArtwork(romId, artworkType);

    // Update database
    const updates = {};
    updates[artworkType] = null;
    db.updateRom(romId, updates);

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-artwork-path', async (event, romId, artworkType) => {
  const artPath = config.getArtworkPath(romId, artworkType);
  const exists = await config.artworkExists(romId, artworkType);
  return exists ? artPath : null;
});

// Sync Handlers
ipcMain.handle('sync-roms', async (event, profileId, romIds = null, options = {}) => {
  let lastProgress = null;

  const result = await syncManager.syncRoms(profileId, romIds, options, (progress) => {
    lastProgress = progress;
    // Send progress to renderer
    mainWindow.webContents.send('sync-progress', progress);
  });

  return result;
});

ipcMain.handle('sync-artwork', async (event, profileId, romIds = null, artworkTypes = ['boxart']) => {
  return syncManager.syncArtwork(profileId, romIds, artworkTypes);
});

ipcMain.handle('verify-sync', async (event, profileId) => {
  return syncManager.verifySync(profileId);
});

ipcMain.handle('get-sync-status', async () => {
  return syncManager.getSyncStatus();
});

ipcMain.handle('scan-device-for-roms', async (event, profileId) => {
  return syncManager.scanDeviceForRoms(profileId);
});

ipcMain.handle('import-from-device', async (event, profileId, romPaths) => {
  return syncManager.importFromDevice(profileId, romPaths);
});

// Scraper Handlers
ipcMain.handle('scrape-rom', async (event, romId, artworkTypes = ['boxart', 'screenshot']) => {
  try {
    const activeScraper = getActiveScraper();
    const rom = db.db.prepare('SELECT * FROM roms WHERE id = ?').get(romId);

    if (!rom) {
      return { success: false, error: 'ROM not found' };
    }

    const result = await activeScraper.scrapeRom(rom, artworkTypes);

    if (result.success) {
      // Update database with downloaded artwork paths
      const updates = {};
      for (const [artType, artPath] of Object.entries(result.downloadedArtwork)) {
        updates[artType] = artPath;
      }

      if (Object.keys(updates).length > 0) {
        db.updateRom(romId, updates);
      }
    }

    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('bulk-scrape', async (event, romIds = null, artworkTypes = ['boxart', 'screenshot']) => {
  const activeScraper = getActiveScraper();
  let roms;

  if (romIds) {
    roms = romIds.map(id => db.db.prepare('SELECT * FROM roms WHERE id = ?').get(id)).filter(Boolean);
  } else {
    roms = db.getRoms({});
  }

  const results = {
    total: roms.length,
    scraped: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };

  for (let i = 0; i < roms.length; i++) {
    const rom = roms[i];

    try {
      // Skip if already has artwork
      if (rom.boxart && artworkTypes.includes('boxart')) {
        console.log(`[Scraper] Skipping ${rom.name} - already has box art`);
        results.skipped++;

        mainWindow.webContents.send('scrape-progress', {
          current: i + 1,
          total: roms.length,
          rom: rom.name,
          status: 'skipped',
          message: 'Already has artwork'
        });
        continue;
      }

      console.log(`[Scraper] Scraping ${i + 1}/${roms.length}: ${rom.name} (${rom.system})`);

      const result = await activeScraper.scrapeRom(rom, artworkTypes);

      if (result.success) {
        // Update database
        const updates = {};
        for (const [artType, artPath] of Object.entries(result.downloadedArtwork)) {
          updates[artType] = artPath;
        }

        if (Object.keys(updates).length > 0) {
          db.updateRom(rom.id, updates);
          console.log(`[Scraper] ✓ Success: ${rom.name} - Downloaded: ${Object.keys(updates).join(', ')}`);
        }

        results.scraped++;

        mainWindow.webContents.send('scrape-progress', {
          current: i + 1,
          total: roms.length,
          rom: rom.name,
          status: 'success',
          message: `Downloaded ${Object.keys(result.downloadedArtwork).join(', ')}`
        });
      } else {
        console.error(`[Scraper] ✗ Failed: ${rom.name} - ${result.error}`);
        results.failed++;
        results.errors.push({
          rom: rom.name,
          error: result.error
        });

        mainWindow.webContents.send('scrape-progress', {
          current: i + 1,
          total: roms.length,
          rom: rom.name,
          status: 'failed',
          message: result.error
        });
      }
    } catch (error) {
      console.error(`[Scraper] ✗ Error: ${rom.name} - ${error.message}`);
      results.failed++;
      results.errors.push({
        rom: rom.name,
        error: error.message
      });

      mainWindow.webContents.send('scrape-progress', {
        current: i + 1,
        total: roms.length,
        rom: rom.name,
        status: 'error',
        message: error.message
      });
    }
  }

  return results;
});

ipcMain.handle('test-scraper-credentials', async () => {
  const activeScraper = getActiveScraper();
  return activeScraper.testCredentials();
});
