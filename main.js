const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs/promises');
const unified = require('unified');
const remarkParse = require('remark-parse');
const remarkStringify = require('remark-stringify');
const path = require('path');

// Enable WebGPU
app.commandLine.appendSwitch('enable-unsafe-webgpu', 'true');

async function createWindow() {
  const window = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: true
    },
  });

  window.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
