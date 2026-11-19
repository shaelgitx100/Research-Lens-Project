import { ReactNode } from 'react';

/** Small markdown subset rendered as React elements. No raw HTML is ever injected. */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s)]+)/g;
  let last = 0; let i = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0]; const k = `${keyBase}${i++}`;
    if (t.startsWith('**')) out.push(<strong key={k}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('`')) out.push(<code key={k} className="rounded bg-raised px-1 text-[0.9em]">{t.slice(1, -1)}</code>);
    else if (t.startsWith('[')) { const mm = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/.exec(t)!; out.push(<a key={k} className="link" href={mm[2]} target="_blank" rel="noopener noreferrer">{mm[1]}</a>); }
    else out.push(<a key={k} className="link break-all" href={t} target="_blank" rel="noopener noreferrer">{t}</a>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source }: { source: string }) {
  const lines = source.split('\n');
  const nodes: ReactNode[] = [];
  let i = 0; let k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = h[1].length; const cls = ['text-2xl mt-2 mb-3', 'text-xl mt-6 mb-2 border-b border-line pb-1', 'text-base mt-4 mb-1 font-semibold', 'text-sm mt-3 mb-1 font-semibold'][lvl - 1];
      nodes.push(<div key={k++} role="heading" aria-level={lvl} className={`font-serif ${cls}`}>{inline(h[2], `h${k}`)}</div>); i++; continue;
    }
    if (line.startsWith('>')) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) buf.push(lines[i++].replace(/^>\s?/, ''));
      nodes.push(<blockquote key={k++} className="my-2 border-l-2 border-accent/60 bg-raised/50 px-3 py-1.5 text-sm text-muted">{inline(buf.join(' '), `q${k}`)}</blockquote>); continue;
    }
    if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++].split('|').slice(1, -1).map((c) => c.trim()));
      nodes.push(
        <div key={k++} className="my-3 overflow-x-auto"><table className="w-full text-left text-sm">
          <thead><tr>{rows[0].map((c, j) => <th key={j} className="border-b border-line px-2 py-1.5 font-semibold">{inline(c, `th${j}`)}</th>)}</tr></thead>
          <tbody>{rows.slice(1).map((r, a) => <tr key={a}>{r.map((c, j) => <td key={j} className="border-b border-line/60 px-2 py-1.5 align-top">{inline(c, `td${a}${j}`)}</td>)}</tr>)}</tbody>
        </table></div>
      ); continue;
    }
    if (/^\*\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\./.test(line); const items: string[] = [];
      while (i < lines.length && (ordered ? /^\d+\.\s+/.test(lines[i]) : /^\*\s+/.test(lines[i]))) {
        let item = lines[i++].replace(/^(\*|\d+\.)\s+/, '');
        while (i < lines.length && /^\s{2,}\S/.test(lines[i])) item += ' ' + lines[i++].trim();
        items.push(item);
      }
      const Tag = ordered ? 'ol' : 'ul';
      nodes.push(<Tag key={k++} className={`my-2 space-y-1 pl-5 text-sm ${ordered ? 'list-decimal' : 'list-disc'}`}>{items.map((t, j) => <li key={j}>{inline(t, `li${k}${j}`)}</li>)}</Tag>); continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#|>|\||\*\s|\d+\.\s)/.test(lines[i])) buf.push(lines[i++]);
    nodes.push(<p key={k++} className="my-2 text-sm leading-relaxed">{inline(buf.join(' '), `p${k}`)}</p>);
  }
  return <div>{nodes}</div>;
}
