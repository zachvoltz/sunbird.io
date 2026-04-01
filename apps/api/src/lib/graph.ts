/** Detect cycles in a directed graph using Kahn's algorithm (BFS topological sort). */
export function hasCycle(edges: { fromNodeId: string; toNodeId: string }[]): boolean {
  const nodes = new Set<string>();
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const e of edges) {
    nodes.add(e.fromNodeId);
    nodes.add(e.toNodeId);
    if (!adj.has(e.fromNodeId)) adj.set(e.fromNodeId, []);
    adj.get(e.fromNodeId)!.push(e.toNodeId);
    inDegree.set(e.toNodeId, (inDegree.get(e.toNodeId) ?? 0) + 1);
    if (!inDegree.has(e.fromNodeId)) inDegree.set(e.fromNodeId, 0);
  }

  const queue: string[] = [];
  for (const node of nodes) {
    if ((inDegree.get(node) ?? 0) === 0) queue.push(node);
  }

  let visited = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    visited++;
    for (const neighbor of adj.get(current) ?? []) {
      const deg = inDegree.get(neighbor)! - 1;
      inDegree.set(neighbor, deg);
      if (deg === 0) queue.push(neighbor);
    }
  }

  return visited < nodes.size;
}
