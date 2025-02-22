const { BrowserAI } = require('@browserai/browserai');

// IPC handlers for main process communication
const { ipcRenderer } = require('electron');

class UIGenerator {
  constructor() {
    this.browserAI = new BrowserAI();
    this.modelLoaded = false;
    this.root = document.getElementById('root');
  }

  async initialize() {
    try {
      await this.browserAI.loadModel('llama-3.2-1b-instruct');
      this.modelLoaded = true;
      console.log('BrowserAI model loaded successfully');
    } catch (error) {
      console.error('Failed to load BrowserAI model:', error);
      throw error;
    }
  }

  async generateUIFromAST(ast) {
    if (!this.modelLoaded) {
      throw new Error('Model not loaded');
    }

    // Process each section recursively
    const processSection = async (section) => {
      const components = [];

      // Generate UI for section content
      for (const item of section.content) {
        switch (item.type) {
          case 'paragraph':
            components.push({
              type: 'text',
              content: item.content
            });
            break;

          case 'list':
            components.push({
              type: 'list',
              ordered: item.ordered,
              items: item.items.map(listItem => ({
                type: 'list-item',
                content: listItem.content,
                checked: listItem.checked
              }))
            });
            break;

          case 'code':
            components.push({
              type: 'code',
              language: item.lang,
              content: item.content
            });
            break;
        }
      }

      // Generate UI suggestions using BrowserAI
      const prompt = `Given this section with title "${section.title}" and content components ${JSON.stringify(components)}, suggest interactive UI elements that would best represent this content. Consider the following guidelines:
      1. For lists with checkboxes, suggest a task list component
      2. For code blocks, suggest a code editor with syntax highlighting
      3. For regular text, suggest appropriate text display or input components
      4. Consider the section's level (${section.level}) when suggesting layout and hierarchy
      
      Output a JSON object with this structure:
      {
        "type": "component_type",
        "props": {
          // Component-specific properties
        },
        "children": [],
        "interactions": [
          {
            "type": "event_type",
            "handler": "description of what should happen"
          }
        ]
      }`;

      try {
        const response = await this.browserAI.generateText(prompt, {
          temperature: 0.7,
          maxTokens: 1000
        });
        const uiSuggestion = JSON.parse(response);

        // Process child sections recursively
        const childComponents = await Promise.all(
          section.children.map(child => processSection(child))
        );

        return {
          type: 'section',
          title: section.title,
          level: section.level,
          components: [...components],
          suggestedUI: uiSuggestion,
          children: childComponents
        };
      } catch (error) {
        console.error('Failed to generate UI for section:', section.title, error);
        return {
          type: 'section',
          title: section.title,
          level: section.level,
          components: [...components],
          error: error.message,
          children: []
        };
      }
    };

    // Process the entire document
    const processedSections = await Promise.all(
      ast.sections.map(section => processSection(section))
    );

    return {
      type: 'document',
      sections: processedSections
    };
  }

  renderUI(uiDescription) {
    // Clear existing content
    this.root.innerHTML = '';

    const renderSection = (section) => {
      const sectionEl = document.createElement('div');
      sectionEl.className = `section level-${section.level}`;

      // Render title
      const titleEl = document.createElement(`h${section.level || 1}`);
      titleEl.textContent = section.title;
      sectionEl.appendChild(titleEl);

      // Render components
      section.components.forEach(component => {
        const componentEl = document.createElement('div');
        componentEl.className = `component ${component.type}`;

        switch (component.type) {
          case 'text':
            componentEl.textContent = component.content;
            break;

          case 'list':
            const listEl = document.createElement(component.ordered ? 'ol' : 'ul');
            component.items.forEach(item => {
              const li = document.createElement('li');
              if (item.checked !== null) {
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = item.checked;
                li.appendChild(checkbox);
              }
              li.appendChild(document.createTextNode(item.content));
              listEl.appendChild(li);
            });
            componentEl.appendChild(listEl);
            break;

          case 'code':
            const pre = document.createElement('pre');
            const code = document.createElement('code');
            if (component.language) {
              code.className = `language-${component.language}`;
            }
            code.textContent = component.content;
            pre.appendChild(code);
            componentEl.appendChild(pre);
            break;
        }

        sectionEl.appendChild(componentEl);
      });

      // Render suggested UI if available
      if (section.suggestedUI && !section.error) {
        const suggestedEl = document.createElement('div');
        suggestedEl.className = 'suggested-ui';
        const pre = document.createElement('pre');
        pre.textContent = JSON.stringify(section.suggestedUI, null, 2);
        suggestedEl.appendChild(pre);
        sectionEl.appendChild(suggestedEl);
      }

      // Render error if any
      if (section.error) {
        const errorEl = document.createElement('div');
        errorEl.className = 'error';
        errorEl.textContent = `Failed to generate UI: ${section.error}`;
        sectionEl.appendChild(errorEl);
      }

      // Render children
      section.children.forEach(child => {
        sectionEl.appendChild(renderSection(child));
      });

      return sectionEl;
    };

    // Render all sections
    uiDescription.sections.forEach(section => {
      this.root.appendChild(renderSection(section));
    });
  }
}

// Initialize UI generator
const uiGenerator = new UIGenerator();

// Handle markdown AST from main process
ipcRenderer.on('process-markdown', async (event, ast) => {
  try {
    const uiDescription = await uiGenerator.generateUIFromAST(ast);
    uiGenerator.renderUI(uiDescription);
    ipcRenderer.send('ui-generated', uiDescription);
  } catch (error) {
    console.error('Failed to process markdown AST:', error);
    ipcRenderer.send('ui-generation-error', error.message);
  }
});

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  uiGenerator.initialize().catch(console.error);
});
