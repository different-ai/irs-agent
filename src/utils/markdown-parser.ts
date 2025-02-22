import { unified } from 'unified';
import remarkParse from 'remark-parse';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { toString } from 'mdast-util-to-string';

export interface MarkdownNode {
  type: string;
  content?: string;
  children?: MarkdownNode[];
  metadata?: Record<string, any>;
  depth?: number;
  ordered?: boolean;
  checked?: boolean;
  lang?: string;
}

export async function parseMarkdown(content: string): Promise<MarkdownNode[]> {
  const ast = fromMarkdown(content);
  return processNodes(ast.children);
}

function processNodes(nodes: any[]): MarkdownNode[] {
  return nodes.map(node => {
    const baseNode: MarkdownNode = {
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
