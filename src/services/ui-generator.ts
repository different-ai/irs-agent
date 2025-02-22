const { BrowserAI } = require('@browserai/browserai');
const { uiRecommendationSchema, astSchema } = require('../schemas/ui');

class UIGenerator {
  constructor() {
    this.browserAI = new BrowserAI();
    this.modelLoaded = false;
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

  async getUIRecommendations(markdown) {
    if (!this.modelLoaded) {
      throw new Error('Model not loaded');
    }

    const prompt = `
analyze this markdown document and suggest how to make it interactive. focus on:

1. identifying content patterns that could be interactive (e.g. tasks, dates, numbers)
2. suggesting appropriate ui components for each pattern
3. explaining why each interaction would be valuable

markdown content:

${markdown}

provide structured recommendations following this format:
1. list of patterns found and why they should be interactive
2. suggested component types for implementation
`;

    try {
      const response = await this.browserAI.generateText(prompt, {
        temperature: 0.7,
        maxTokens: 1000
      });
      
      // Parse and validate response
      const recommendations = JSON.parse(response);
      return uiRecommendationSchema.parse(recommendations);
    } catch (error) {
      console.error('Failed to generate UI recommendations:', error);
      throw error;
    }
  }

  async generateUIComponents(nodes, recommendations) {
    if (!this.modelLoaded) {
      throw new Error('Model not loaded');
    }

    const prompt = `
you are tasked with converting markdown content into interactive UI components.
the first AI has analyzed this content and made these recommendations:

${JSON.stringify(recommendations, null, 2)}

based on these recommendations, convert the following markdown nodes into appropriate UI components:

${nodes.map(node => JSON.stringify(node, null, 2)).join("\n\n")}

generate an AST of UI components that implements these recommendations while preserving the document's structure and meaning.
`;

    try {
      const response = await this.browserAI.generateText(prompt, {
        temperature: 0.7,
        maxTokens: 1000
      });
      
      // Parse and validate response
      const ast = JSON.parse(response);
      return astSchema.parse(ast);
    } catch (error) {
      console.error('Failed to generate UI components:', error);
      throw error;
    }
  }
}

module.exports = {
  UIGenerator
};
