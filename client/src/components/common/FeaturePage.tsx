import type { ReactNode } from 'react';

export default function FeaturePage({ title, eyebrow = 'RESEARCH WORKSPACE', description, children }: { title: string; eyebrow?: string; description: string; children?: ReactNode }) {
  return <section className="panel large-panel feature-page"><div className="section-kicker">{eyebrow}</div><h2>{title}</h2><p>{description}</p>{children}</section>;
}
