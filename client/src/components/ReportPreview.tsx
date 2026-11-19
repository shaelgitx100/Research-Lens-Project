import { Markdown } from '../utils/markdown';

export function ReportPreview({ content }: { content: string }) {
  return <article className="card printArea mx-auto max-w-4xl p-6 md:p-10"><Markdown source={content} /></article>;
}
