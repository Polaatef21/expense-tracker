import { useState } from 'react';

// A card holding a chart, with a "View as table" toggle so every value is
// readable without relying on color or hovering (accessibility).
export function ChartCard({ title, subtitle, table, children, className = '' }) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={`card chart-card ${className}`}>
      <header className="card__header">
        <div>
          <h2 className="card__title">{title}</h2>
          {subtitle && <p className="card__subtitle">{subtitle}</p>}
        </div>
        {table && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            aria-pressed={showTable}
            onClick={() => setShowTable((s) => !s)}
          >
            {showTable ? 'View as chart' : 'View as table'}
          </button>
        )}
      </header>
      {showTable ? <div className="chart-card__table">{table}</div> : children}
    </section>
  );
}
