import { useEffect, useState } from 'react';
import { PERIODS } from '../utils/dates.js';
import { Button } from './ui/Button.jsx';

// Preset periods, or a custom range applied with a button.
export function PeriodSelector({ period, startDate = '', endDate = '', onChange }) {
  const [custom, setCustom] = useState({ startDate, endDate });
  const [error, setError] = useState(null);

  useEffect(() => setCustom({ startDate, endDate }), [startDate, endDate]);

  function applyCustom(e) {
    e.preventDefault();
    if (!custom.startDate || !custom.endDate) return setError('Choose both dates');
    if (custom.startDate > custom.endDate) return setError('Start must be before end');
    setError(null);
    onChange({ period: 'custom', ...custom });
  }

  return (
    <div className="period">
      <label className="period__label">
        <span className="visually-hidden">Period</span>
        <select
          className="input input--inline"
          value={period}
          onChange={(e) => onChange({ period: e.target.value, ...(e.target.value === 'custom' ? custom : {}) })}
        >
          {PERIODS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      {period === 'custom' && (
        <form className="period__custom" onSubmit={applyCustom}>
          <input
            className="input input--inline"
            type="date"
            aria-label="Start date"
            value={custom.startDate}
            onChange={(e) => setCustom((c) => ({ ...c, startDate: e.target.value }))}
          />
          <span aria-hidden="true">–</span>
          <input
            className="input input--inline"
            type="date"
            aria-label="End date"
            value={custom.endDate}
            onChange={(e) => setCustom((c) => ({ ...c, endDate: e.target.value }))}
          />
          <Button type="submit" size="sm">
            Apply
          </Button>
          {error && (
            <span className="field__error" role="alert">
              {error}
            </span>
          )}
        </form>
      )}
    </div>
  );
}
