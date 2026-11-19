export interface LNode { id: string; x: number; y: number; vx: number; vy: number }
export interface LEdge { source: string; target: string }

/** Deterministic force directed layout (repulsion, springs, gravity). Runs once per graph change. */
export function layout(ids: string[], edges: LEdge[], width = 900, height = 600, iterations = 260): Map<string, { x: number; y: number }> {
  const n = ids.length;
  const nodes: LNode[] = ids.map((id, i) => {
    const a = (i / Math.max(1, n)) * Math.PI * 2;
    return { id, x: width / 2 + Math.cos(a) * width * 0.3, y: height / 2 + Math.sin(a) * height * 0.3, vx: 0, vy: 0 };
  });
  const idx = new Map(nodes.map((nd, i) => [nd.id, i]));
  const links = edges.map((e) => [idx.get(e.source), idx.get(e.target)] as const).filter((l): l is readonly [number, number] => l[0] !== undefined && l[1] !== undefined);
  const k = Math.sqrt((width * height) / Math.max(1, n)) * 0.7;
  for (let it = 0; it < iterations; it++) {
    const cool = 1 - it / iterations;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
      let d2 = dx * dx + dy * dy; if (d2 < 1) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 1; }
      const d = Math.sqrt(d2); const f = ((k * k) / d2) * 0.9;
      nodes[i].vx += (dx / d) * f; nodes[i].vy += (dy / d) * f; nodes[j].vx -= (dx / d) * f; nodes[j].vy -= (dy / d) * f;
    }
    for (const [a, b] of links) {
      const dx = nodes[b].x - nodes[a].x, dy = nodes[b].y - nodes[a].y; const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - k * 0.8) * 0.04;
      nodes[a].vx += (dx / d) * f; nodes[a].vy += (dy / d) * f; nodes[b].vx -= (dx / d) * f; nodes[b].vy -= (dy / d) * f;
    }
    for (const nd of nodes) {
      nd.vx += (width / 2 - nd.x) * 0.004; nd.vy += (height / 2 - nd.y) * 0.004;
      const step = 12 * cool + 0.5; const sp = Math.hypot(nd.vx, nd.vy) || 1; const m = Math.min(step, sp);
      nd.x += (nd.vx / sp) * m; nd.y += (nd.vy / sp) * m; nd.vx *= 0.5; nd.vy *= 0.5;
    }
  }
  return new Map(nodes.map((nd) => [nd.id, { x: nd.x, y: nd.y }]));
}
