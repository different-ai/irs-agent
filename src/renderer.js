const { BrowserAI } = require('@browserai/browserai');

async function main() {
  const browserAI = new BrowserAI();
  try {
    await browserAI.loadModel('llama-3.2-1b-instruct');
    console.log('BrowserAI model loaded successfully');
  } catch (error) {
    console.error('Failed to load BrowserAI model:', error);
  }
}

main().catch(console.error);
