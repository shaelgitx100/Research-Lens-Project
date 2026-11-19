export function BarChart({ items, color = 'rgb(var(--accent))' }: { items: { label: string; value: number }[]; color?: string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="text-sm text-muted">No data available.</p>;
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.label} className="text-sm">
          <div className="mb-0.5 flex justify-between gap-2"><span className="truncate">{i.label}</span><span className="text-muted">{i.value}</span></div>
          <div className="h-1.5 rounded bg-raised"><div className="h-full rounded" style={{ width: `${(i.value / max) * 100}%`, background: color }} /></div>
        </li>
      ))}
    </ul>
  );
}
export const TopicChart = BarChart;

export function ResearchTimeline({ data }: { data: { year: number; count: number }[] }) {
  if (!data.length) return <p className="text-sm text-muted">No publication years are stored for these papers.</p>;
  const years: { year: number; count: number }[] = [];
  const min = data[0].year, max = data[data.length - 1].year;
  for (let y = min; y <= max; y++) years.push({ year: y, count: data.find((d) => d.year === y)?.count || 0 });
  const top = Math.max(1, ...years.map((y) => y.count));
  const W = 560, H = 180, pad = 24, bw = Math.min(40, (W - pad * 2) / years.length - 6);
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[420px] w-full" role="img" aria-label="Publications per year">
        {[0, 0.5, 1].map((t) => <line key={t} x1={pad} x2={W - pad} y1={H - pad - t * (H - pad * 2)} y2={H - pad - t * (H - pad * 2)} stroke="rgb(var(--line))" strokeDasharray="3 4" />)}
        {years.map((y, i) => {
          const x = pad + ((W - pad * 2) / years.length) * (i + 0.5) - bw / 2; const h = (y.count / top) * (H - pad * 2);
          return (
            <g key={y.year}>
              <rect x={x} y={H - pad - h} width={bw} height={h} rx="2" fill="rgb(var(--accent))" opacity="0.85"><title>{`${y.year}: ${y.count}`}</title></rect>
              <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="10" fill="rgb(var(--muted))">{y.year}</text>
              {y.count > 0 && <text x={x + bw / 2} y={H - pad - h - 4} textAnchor="middle" fontSize="10" fill="rgb(var(--ink))">{y.count}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function RadarChart({ dims }: { dims: { label: string; score: number }[] }) {
  const S = 220, c = S / 2, r = 78, n = dims.length;
  const pt = (i: number, v: number) => { const a = (Math.PI * 2 * i) / n - Math.PI / 2; return [c + Math.cos(a) * r * v, c + Math.sin(a) * r * v]; };
  const poly = dims.map((d, i) => pt(i, d.score).join(',')).join(' ');
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto w-full max-w-[260px]" role="img" aria-label="Scorecard radar chart">
      {[0.25, 0.5, 0.75, 1].map((t) => <polygon key={t} points={dims.map((_, i) => pt(i, t).join(',')).join(' ')} fill="none" stroke="rgb(var(--line))" />)}
      <polygon points={poly} fill="rgb(var(--accent) / 0.25)" stroke="rgb(var(--accent))" strokeWidth="1.5" />
      {dims.map((d, i) => { const [x, y] = pt(i, 1.2); return <text key={d.label} x={x} y={y} fontSize="8" textAnchor="middle" fill="rgb(var(--muted))">{d.label.split(' ')[0]}</text>; })}
    </svg>
  );
}
