const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const { parseMarkdown } = require('./src/utils/markdown-parser');

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
    try {
      const nodes = await parseMarkdown(content);
      this.window.webContents.send('process-markdown', {
        content,
        nodes
      });
    } catch (error) {
      console.error('Error processing markdown:', error);
      throw error;
    }
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
        dialog.showErrorBox('Error', `Failed to process markdown: ${error.message}`);
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
  ipcMain.on('ui-recommendations-generated', (event, recommendations) => {
    console.log('UI recommendations generated:', recommendations);
  });
  ipcMain.on('ui-components-generated', (event, components) => {
    console.log('UI components generated:', components);
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
