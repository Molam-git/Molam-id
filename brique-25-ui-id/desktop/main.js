// desktop/main.js
// Molam ID Management - Electron Desktop App

const { app, BrowserWindow, protocol, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f6f7f9',
    show: false
  });

  // Load the web UI
  const UI_URL = process.env.UI_URL || 'http://localhost:5173';
  mainWindow.loadURL(UI_URL);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers for secure credential storage
ipcMain.handle('store-token', async (event, { key, value }) => {
  // In production, use electron-store or keytar for secure storage
  return { success: true };
});

ipcMain.handle('retrieve-token', async (event, key) => {
  // In production, retrieve from secure storage
  return null;
});

ipcMain.handle('delete-token', async (event, key) => {
  // In production, delete from secure storage
  return { success: true };
});
