export function Spinner({ size = 'md', label }) {
  return (
    <span className={`spinner spinner--${size}`} role={label ? 'status' : undefined} aria-label={label}>
      <span className="spinner__circle" aria-hidden="true" />
    </span>
  );
}

export function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="page-loader">
      <Spinner label={label} />
      <span>{label}</span>
    </div>
  );
}
