import { GraphCanvas } from '../graph/GraphCanvas';

export interface CitationData { nodes: { id: string; title: string; year?: number; citationsInLibrary: number }[]; edges: { from: string; to: string }[] }

export function CitationGraph({ data, selectedId, onSelect }: { data: CitationData; selectedId: string | null; onSelect: (id: string | null) => void }) {
  return (
    <GraphCanvas ariaLabel="Citation network between papers in the project. Arrows point from the citing paper to the cited paper." selectedId={selectedId} onSelect={onSelect} height={480}
      nodes={data.nodes.map((n) => ({ id: n.id, label: `${n.title}${n.year ? ` (${n.year})` : ''}`, color: n.citationsInLibrary > 0 ? '#f0d070' : '#60b0d2', radius: 6 + Math.min(8, n.citationsInLibrary * 2) }))}
      edges={data.edges.map((e, i) => ({ id: `${i}`, source: e.from, target: e.to, directed: true }))} />
  );
}
