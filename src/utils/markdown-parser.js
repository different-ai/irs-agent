const { unified } = require('unified');
const remarkParse = require('remark-parse');
const { fromMarkdown } = require('mdast-util-from-markdown');
const { toString } = require('mdast-util-to-string');

/**
 * @typedef {Object} MarkdownNode
 * @property {string} type
 * @property {string} [content]
 * @property {MarkdownNode[]} [children]
 * @property {Object.<string, any>} [metadata]
 * @property {number} [depth]
 * @property {boolean} [ordered]
 * @property {boolean} [checked]
 * @property {string} [lang]
 */

/**
 * Parse markdown content into a structured AST
 * @param {string} content 
 * @returns {Promise<MarkdownNode[]>}
 */
async function parseMarkdown(content) {
  const ast = fromMarkdown(content);
  return processNodes(ast.children);
}

/**
 * Process AST nodes recursively
 * @param {any[]} nodes 
 * @returns {MarkdownNode[]}
 */
function processNodes(nodes) {
  return nodes.map(node => {
    const baseNode = {
      type: node.type,
    };

    switch (node.type) {
      case 'heading':
        return {
          ...baseNode,
          content: toString(node),
          depth: node.depth,
        };

      case 'paragraph':
        return {
          ...baseNode,
          content: toString(node),
        };

      case 'list':
        return {
          ...baseNode,
          ordered: node.ordered,
          children: processNodes(node.children),
        };

      case 'listItem':
        return {
          ...baseNode,
          content: toString(node),
          checked: node.checked,
          children: node.children ? processNodes(node.children) : undefined,
        };

      case 'code':
        return {
          ...baseNode,
          content: node.value,
          lang: node.lang,
        };

      default:
        if (node.children) {
          return {
            ...baseNode,
            children: processNodes(node.children),
          };
        }
        return baseNode;
    }
  });
}

module.exports = {
  parseMarkdown
};
