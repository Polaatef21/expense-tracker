import { formatMoney } from '../utils/format.js';

// tone: 'neutral' | 'auto' (green when positive, red with a minus sign when negative)
export function StatCard({ label, value, caption, tone = 'neutral', hero = false }) {
  const n = Number(value);
  const toneClass = tone === 'auto' ? (n < 0 ? 'is-negative' : n > 0 ? 'is-positive' : '') : '';
  return (
    <section className={`stat-card ${hero ? 'stat-card--hero' : ''}`} aria-label={label}>
      <h2 className="stat-card__label">{label}</h2>
      <p className={`stat-card__value ${toneClass}`}>{formatMoney(value)}</p>
      {caption && <p className="stat-card__caption">{caption}</p>}
    </section>
  );
}
