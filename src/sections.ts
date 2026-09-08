import type { SectionNode } from './types';

export function updateAt(
  nodes: SectionNode[],
  path: number[],
  updater: (node: SectionNode) => SectionNode | null,
): SectionNode[] {
  const [head, ...rest] = path;
  const next: SectionNode[] = [];
  nodes.forEach((node, index) => {
    if (index !== head) {
      next.push(node);
      return;
    }
    if (rest.length === 0) {
      const updated = updater(node);
      if (updated !== null) {
        next.push(updated);
      }
      return;
    }
    if (Array.isArray(node)) {
      next.push(updateAt(node, rest, updater));
      return;
    }
    next.push(node);
  });
  return next;
}

export function appendAt(
  nodes: SectionNode[],
  parentPath: number[],
  item: SectionNode,
): SectionNode[] {
  if (parentPath.length === 0) {
    return [...nodes, item];
  }
  return updateAt(nodes, parentPath, (node) => {
    if (Array.isArray(node)) {
      return [...node, item];
    }
    return [node, item];
  });
}

export const emptyItem = (): SectionNode => ({ title: '', content: '' });
export const emptyGroup = (): SectionNode => [{ title: '', content: '' }];
