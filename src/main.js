const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
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

  let scannedFiles = 0;
  let foundRoms = 0;
  let skippedFiles = 0;

  async function scanDirectory(dir, depth = 0) {
    const roms = [];
    let entries;

    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
      console.log(`[Scanner] Scanning directory: ${dir} (${entries.length} entries, depth: ${depth})`);
    } catch (error) {
      console.error(`[Scanner] Failed to read directory ${dir}:`, error.message);
      return roms;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden directories and common non-ROM folders
        if (entry.name.startsWith('.') ||
            entry.name === 'node_modules' ||
            entry.name === '__MACOSX') {
          console.log(`[Scanner] Skipping hidden/system directory: ${entry.name}`);
          continue;
        }

        const subRoms = await scanDirectory(fullPath, depth + 1);
        roms.push(...subRoms);
      } else if (entry.isFile()) {
        scannedFiles++;

        // Skip hidden files
        if (entry.name.startsWith('.')) {
          skippedFiles++;
          continue;
        }

        const ext = path.extname(entry.name).toLowerCase();

        // Early skip if not a ROM extension (avoid stat call)
        if (!romExtensions.includes(ext)) {
          skippedFiles++;
          if (scannedFiles % 100 === 0) {
            console.log(`[Scanner] Progress: ${scannedFiles} files scanned, ${foundRoms} ROMs found, ${skippedFiles} skipped`);
          }
          continue;
        }

        try {
          const stats = await fs.stat(fullPath);
          foundRoms++;

          const rom = {
            name: path.basename(entry.name, ext),
            filename: entry.name,
            path: fullPath,
            size: stats.size,
            extension: ext,
            system: await detectSystem(ext, fullPath),
            dateAdded: new Date().toISOString()
          };

          roms.push(rom);

          // Send progress update every 10 ROMs
          if (foundRoms % 10 === 0) {
            console.log(`[Scanner] Found ROM #${foundRoms}: ${entry.name} (${formatBytes(stats.size)})`);
            event.sender.send('scan-progress', {
              scannedFiles,
              foundRoms,
              currentFile: entry.name,
              currentPath: dir
            });
          }
        } catch (error) {
          console.error(`[Scanner] Failed to process file ${fullPath}:`, error.message);
        }
      }
    }

    return roms;
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
    console.log(`[Scanner] Starting scan of: ${folderPath}`);
    const startTime = Date.now();

    const roms = await scanDirectory(folderPath);

    console.log(`[Scanner] Scan complete! Found ${roms.length} ROMs in ${scannedFiles} files (${skippedFiles} skipped)`);
    console.log(`[Scanner] Adding ROMs to database...`);

    // Add ROMs to database
    let added = 0;
    let duplicates = 0;

    for (const rom of roms) {
      const result = db.addRom(rom);
      if (result) {
        added++;
      } else {
        duplicates++;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Scanner] Done! Added ${added} ROMs (${duplicates} duplicates skipped) in ${duration}s`);

    return {
      success: true,
      count: added,
      duplicates,
      scannedFiles,
      skippedFiles,
      duration
    };
  } catch (error) {
    console.error('[Scanner] Error scanning ROMs:', error);
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

ipcMain.handle('delete-roms-by-folder', async (event, folderPath) => {
  try {
    console.log(`[Delete] Removing all ROMs from folder: ${folderPath}`);

    // Get all ROMs that start with this folder path
    const allRoms = db.getRoms({});
    const romsToDelete = allRoms.filter(rom => rom.path.startsWith(folderPath));

    console.log(`[Delete] Found ${romsToDelete.length} ROMs to remove`);

    let deleted = 0;
    for (const rom of romsToDelete) {
      db.deleteRom(rom.id);
      deleted++;
    }

    console.log(`[Delete] Successfully removed ${deleted} ROMs`);
    return { success: true, count: deleted };
  } catch (error) {
    console.error('[Delete] Error deleting ROMs by folder:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-indexed-folders', async () => {
  try {
    const allRoms = db.getRoms({});
    const folders = new Map();

    // Extract unique folder paths and count ROMs
    for (const rom of allRoms) {
      const folderPath = path.dirname(rom.path);

      if (!folders.has(folderPath)) {
        folders.set(folderPath, { path: folderPath, count: 0, size: 0 });
      }

      const folder = folders.get(folderPath);
      folder.count++;
      folder.size += rom.size || 0;
    }

    // Convert to array and sort by count
    return Array.from(folders.values()).sort((a, b) => b.count - a.count);
  } catch (error) {
    console.error('[Folders] Error getting indexed folders:', error);
    return [];
  }
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

ipcMain.handle('get-device-status', async () => {
  try {
    const profiles = config.getSyncProfiles();
    const deviceStatus = [];

    for (const profile of profiles) {
      if (!profile.enabled) continue;

      let connected = false;
      if (profile.basePath) {
        try {
          await fs.access(profile.basePath);
          connected = true;
          console.log(`[Device] ${profile.name || profile.id} is connected at ${profile.basePath}`);
        } catch (error) {
          console.log(`[Device] ${profile.name || profile.id} is disconnected (path not accessible)`);
        }
      }

      deviceStatus.push({
        id: profile.id,
        name: profile.name || profile.id,
        path: profile.basePath,
        connected,
        enabled: profile.enabled
      });
    }

    return deviceStatus;
  } catch (error) {
    console.error('[Device] Error checking device status:', error);
    return [];
  }
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

// Sync History Handlers
ipcMain.handle('get-sync-history', async (event, limit, profileId) => {
  return db.getSyncHistory(limit, profileId);
});

ipcMain.handle('get-last-sync', async (event, profileId) => {
  return db.getLastSync(profileId);
});

ipcMain.handle('get-sync-stats', async (event, profileId) => {
  return db.getSyncStats(profileId);
});

ipcMain.handle('clear-sync-history', async (event, olderThanDays) => {
  return db.clearSyncHistory(olderThanDays);
});

// File System Handlers
ipcMain.handle('show-item-in-folder', async (event, filePath) => {
  try {
    await fs.access(filePath);
    shell.showItemInFolder(filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('open-path', async (event, folderPath) => {
  try {
    await fs.access(folderPath);
    await shell.openPath(folderPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-saves', async (event, romId) => {
  return db.getSaves(romId);
});

ipcMain.handle('delete-save', async (event, saveId) => {
  try {
    const save = db.db.prepare('SELECT * FROM saves WHERE id = ?').get(saveId);

    if (save && save.localPath) {
      // Delete the physical file
      try {
        await fs.unlink(save.localPath);
      } catch (error) {
        console.error('Error deleting save file:', error);
      }
    }

    // Delete from database
    db.deleteSave(saveId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
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
