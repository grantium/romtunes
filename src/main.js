const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const Database = require('./database');

let mainWindow;
let db;

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

app.whenReady().then(() => {
  db = new Database();
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
            system: detectSystem(ext),
            dateAdded: new Date().toISOString()
          });
        }
      }
    }

    return roms;
  }

  function detectSystem(extension) {
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
    return systemMap[extension] || 'Unknown';
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
  return db.updateRom(id, updates);
});

ipcMain.handle('get-stats', async () => {
  return db.getStats();
});
