const { ipcRenderer } = require('electron');
const { UIGenerator } = require('./services/ui-generator');

class UIRenderer {
  constructor() {
    this.generator = new UIGenerator();
    this.root = document.getElementById('root');
  }

  async initialize() {
    try {
      await this.generator.initialize();
      console.log('UI Generator initialized successfully');
    } catch (error) {
      console.error('Failed to initialize UI Generator:', error);
      throw error;
    }
  }

  renderComponent(component) {
    const componentEl = document.createElement('div');
    componentEl.className = `component ${component.type}`;

    switch (component.type) {
      case 'text':
        const textEl = document.createElement(component.variant);
        textEl.textContent = component.content;
        componentEl.appendChild(textEl);
        break;

      case 'date':
      case 'number':
        const label = document.createElement('label');
        label.textContent = component.label;
        const input = document.createElement('input');
        input.type = component.type;
        input.value = component.value;
        label.appendChild(input);
        componentEl.appendChild(label);
        break;

      case 'checkbox':
        const checkLabel = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = component.checked;
        checkLabel.appendChild(checkbox);
        checkLabel.appendChild(document.createTextNode(component.label));
        componentEl.appendChild(checkLabel);
        break;

      case 'list':
        const listEl = document.createElement(component.variant === 'ordered' ? 'ol' : 'ul');
        component.items.forEach(item => {
          const li = document.createElement('li');
          if (item.checked !== undefined) {
            const itemCheck = document.createElement('input');
            itemCheck.type = 'checkbox';
            itemCheck.checked = item.checked;
            li.appendChild(itemCheck);
          }
          li.appendChild(document.createTextNode(item.content));
          listEl.appendChild(li);
        });
        componentEl.appendChild(listEl);
        break;
    }

    return componentEl;
  }

  renderUI(ast) {
    // Clear existing content
    this.root.innerHTML = '';

    // Render each component
    ast.ast.forEach(component => {
      this.root.appendChild(this.renderComponent(component));
    });
  }
}

// Initialize UI renderer
const renderer = new UIRenderer();

// Handle markdown content from main process
ipcRenderer.on('process-markdown', async (event, { content, nodes }) => {
  try {
    // Step 1: Get UI/UX recommendations
    console.log('Getting UI/UX recommendations...');
    const recommendations = await renderer.generator.getUIRecommendations(content);
    ipcRenderer.send('ui-recommendations-generated', recommendations);

    // Step 2: Generate concrete UI components
    console.log('Generating UI components...');
    const ast = await renderer.generator.generateUIComponents(nodes, recommendations);
    renderer.renderUI(ast);
    ipcRenderer.send('ui-components-generated', ast);
  } catch (error) {
    console.error('Failed to process markdown:', error);
    ipcRenderer.send('ui-generation-error', error.message);
  }
});

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  renderer.initialize().catch(console.error);
});
