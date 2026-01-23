const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  scanRoms: (folderPath) => ipcRenderer.invoke('scan-roms', folderPath),
  getRoms: (filters) => ipcRenderer.invoke('get-roms', filters),
  getSystems: () => ipcRenderer.invoke('get-systems'),
  deleteRom: (id) => ipcRenderer.invoke('delete-rom', id),
  updateRom: (id, updates) => ipcRenderer.invoke('update-rom', id, updates),
  getStats: () => ipcRenderer.invoke('get-stats')
});
