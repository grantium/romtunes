const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ROM Operations
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectFiles: () => ipcRenderer.invoke('select-files'),
  scanRoms: (folderPath) => ipcRenderer.invoke('scan-roms', folderPath),
  importFiles: (filePaths) => ipcRenderer.invoke('import-files', filePaths),
  getRoms: (filters) => ipcRenderer.invoke('get-roms', filters),
  getSystems: () => ipcRenderer.invoke('get-systems'),
  deleteRom: (id) => ipcRenderer.invoke('delete-rom', id),
  updateRom: (id, updates) => ipcRenderer.invoke('update-rom', id, updates),
  getStats: () => ipcRenderer.invoke('get-stats'),

  // Config Operations
  getConfig: (key) => ipcRenderer.invoke('get-config', key),
  setConfig: (key, value) => ipcRenderer.invoke('set-config', key, value),
  getSyncProfiles: () => ipcRenderer.invoke('get-sync-profiles'),
  updateSyncProfile: (profileId, updates) => ipcRenderer.invoke('update-sync-profile', profileId, updates),
  addSystemMapping: (profileId, system, folder) => ipcRenderer.invoke('add-system-mapping', profileId, system, folder),

  // Artwork Operations
  selectImage: () => ipcRenderer.invoke('select-image'),
  importArtwork: (romId, artworkType, sourcePath) => ipcRenderer.invoke('import-artwork', romId, artworkType, sourcePath),
  deleteArtwork: (romId, artworkType) => ipcRenderer.invoke('delete-artwork', romId, artworkType),
  getArtworkPath: (romId, artworkType) => ipcRenderer.invoke('get-artwork-path', romId, artworkType),

  // Sync Operations
  syncRoms: (profileId, romIds, options) => ipcRenderer.invoke('sync-roms', profileId, romIds, options),
  syncArtwork: (profileId, romIds, artworkTypes) => ipcRenderer.invoke('sync-artwork', profileId, romIds, artworkTypes),
  verifySync: (profileId) => ipcRenderer.invoke('verify-sync', profileId),
  getSyncStatus: () => ipcRenderer.invoke('get-sync-status'),
  scanDeviceForRoms: (profileId) => ipcRenderer.invoke('scan-device-for-roms', profileId),
  importFromDevice: (profileId, romPaths) => ipcRenderer.invoke('import-from-device', profileId, romPaths),

  // Scraper Operations
  scrapeRom: (romId, artworkTypes) => ipcRenderer.invoke('scrape-rom', romId, artworkTypes),
  bulkScrape: (romIds, artworkTypes) => ipcRenderer.invoke('bulk-scrape', romIds, artworkTypes),
  testScraperCredentials: () => ipcRenderer.invoke('test-scraper-credentials'),

  // File System Operations
  showItemInFolder: (filePath) => ipcRenderer.invoke('show-item-in-folder', filePath),
  openPath: (folderPath) => ipcRenderer.invoke('open-path', folderPath),
  getSaves: (romId) => ipcRenderer.invoke('get-saves', romId),
  deleteSave: (saveId) => ipcRenderer.invoke('delete-save', saveId),

  // Event Listeners
  onSyncProgress: (callback) => ipcRenderer.on('sync-progress', (event, data) => callback(data)),
  removeSyncProgressListener: () => ipcRenderer.removeAllListeners('sync-progress'),
  onScrapeProgress: (callback) => ipcRenderer.on('scrape-progress', (event, data) => callback(data)),
  removeScrapeProgressListener: () => ipcRenderer.removeAllListeners('scrape-progress')
});
