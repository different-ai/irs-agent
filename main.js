const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs/promises');
const path = require('path');
const { unified } = require('unified');
const remarkParse = require('remark-parse');
const { fromMarkdown } = require('mdast-util-from-markdown');
const { toString } = require('mdast-util-to-string');

// Enable WebGPU for local LLM processing
app.commandLine.appendSwitch('enable-unsafe-webgpu', 'true');

class MarkdownProcessor {
  constructor(window) {
    this.window = window;
    this.processor = unified().use(remarkParse);
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

  parseMarkdownToAST(content) {
    try {
      // Parse markdown into AST
      const ast = fromMarkdown(content);
      return this.processAST(ast);
    } catch (error) {
      console.error('Failed to parse markdown:', error);
      throw error;
    }
  }

  processAST(ast) {
    const sections = [];
    let currentSection = null;

    // Helper to create a new section
    const createSection = (title = '', level = 0) => ({
      title,
      level,
      content: [],
      children: [],
      metadata: {},
      type: 'section'
    });

    // Process each node in the AST
    const processNode = (node) => {
      switch (node.type) {
        case 'heading':
          const title = toString(node);
          const level = node.depth;
          
          // Create new section
          const newSection = createSection(title, level);
          
          // Find parent section based on heading level
          if (level === 1 || !currentSection) {
            sections.push(newSection);
          } else if (level > currentSection.level) {
            currentSection.children.push(newSection);
          } else {
            // Find appropriate parent
            let parent = sections[sections.length - 1];
            while (parent.children.length > 0 && parent.children[parent.children.length - 1].level >= level) {
              parent = parent.children[parent.children.length - 1];
            }
            parent.children.push(newSection);
          }
          
          currentSection = newSection;
          break;

        case 'list':
          if (currentSection) {
            currentSection.content.push({
              type: 'list',
              ordered: node.ordered,
              items: node.children.map(item => ({
                type: 'list-item',
                content: toString(item),
                checked: item.checked
              }))
            });
          }
          break;

        case 'paragraph':
          if (currentSection) {
            currentSection.content.push({
              type: 'paragraph',
              content: toString(node)
            });
          }
          break;

        case 'code':
          if (currentSection) {
            currentSection.content.push({
              type: 'code',
              lang: node.lang,
              content: node.value
            });
          }
          break;

        // Add more node types as needed
      }

      // Process child nodes if they exist
      if (node.children) {
        node.children.forEach(processNode);
      }
    };

    // Start processing from root
    ast.children.forEach(processNode);

    return {
      type: 'document',
      sections: sections
    };
  }

  async processMarkdown(content) {
    try {
      const ast = this.parseMarkdownToAST(content);
      this.window.webContents.send('process-markdown', ast);
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
