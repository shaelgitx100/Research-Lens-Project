export default function Loader({ label = 'Loading', inline = false }: { label?: string; inline?: boolean }) {
  return <div className={inline ? 'loader loader-inline' : 'loader'} role="status" aria-live="polite"><span className="loader-spinner" aria-hidden="true"/><span>{label}</span></div>;
}
