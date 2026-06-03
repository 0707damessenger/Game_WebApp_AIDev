const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  
  onToggleVisibility: (callback) => {
    ipcRenderer.on('toggle-visibility', callback);
  }
});