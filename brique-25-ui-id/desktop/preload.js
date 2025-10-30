// desktop/preload.js
// Molam ID Management - Electron Preload Script

const { contextBridge, ipcRenderer } = require('electron');

// Expose secure API to renderer process
contextBridge.exposeInMainWorld('electron', {
  platform: process.platform,
  storeToken: (key, value) => ipcRenderer.invoke('store-token', { key, value }),
  retrieveToken: (key) => ipcRenderer.invoke('retrieve-token', key),
  deleteToken: (key) => ipcRenderer.invoke('delete-token', key)
});
