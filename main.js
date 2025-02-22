const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs/promises');
const path = require('path');

// Enable WebGPU for local LLM processing
app.commandLine.appendSwitch('enable-unsafe-webgpu', 'true');

class MarkdownProcessor {
  constructor(window) {
    this.window = window;
  }

  async readMarkdownFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return content;
    } catch (error) {
      console.error('Failed to read markdown file:', error);
      throw error;
    }
  }

  async processMarkdown(content) {
    // Send to renderer for UI generation
    this.window.webContents.send('process-markdown', content);
  }

  async handleFileOpen() {
    const result = await dialog.showOpenDialog(this.window, {
      properties: ['openFile'],
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      try {
        const content = await this.readMarkdownFile(result.filePaths[0]);
        await this.processMarkdown(content);
      } catch (error) {
        console.error('Error processing file:', error);
      }
    }
  }
}

async function createWindow() {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: true,
      webgl: true
    },
  });

  const processor = new MarkdownProcessor(window);

  // Set up IPC handlers
  ipcMain.on('open-file', () => processor.handleFileOpen());
  ipcMain.on('ui-generated', (event, uiDescription) => {
    console.log('UI generated:', uiDescription);
    // Handle UI updates here
  });
  ipcMain.on('ui-generation-error', (event, error) => {
    console.error('UI generation error:', error);
    dialog.showErrorBox('Error', `Failed to generate UI: ${error}`);
  });

  await window.loadFile('index.html');
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
