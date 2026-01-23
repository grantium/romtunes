const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ROM Operations
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  scanRoms: (folderPath) => ipcRenderer.invoke('scan-roms', folderPath),
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
  syncRoms: (profileId, romIds) => ipcRenderer.invoke('sync-roms', profileId, romIds),
  syncArtwork: (profileId, romIds, artworkTypes) => ipcRenderer.invoke('sync-artwork', profileId, romIds, artworkTypes),
  verifySync: (profileId) => ipcRenderer.invoke('verify-sync', profileId),
  getSyncStatus: () => ipcRenderer.invoke('get-sync-status'),

  // Event Listeners
  onSyncProgress: (callback) => ipcRenderer.on('sync-progress', (event, data) => callback(data)),
  removeSyncProgressListener: () => ipcRenderer.removeAllListeners('sync-progress')
});
