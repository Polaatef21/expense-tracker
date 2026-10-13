import { useEffect, useState } from 'react';
import { Button } from './ui/Button.jsx';
import { Field } from './ui/Field.jsx';

const EMPTY = { startDate: '', endDate: '', type: '', categoryId: '' };

// Edits a draft; the parent only receives filters when the user clicks Apply.
export function TransactionFilters({ value, categories, onApply }) {
  const [draft, setDraft] = useState({ ...EMPTY, ...value });
  const [error, setError] = useState(null);

  useEffect(() => setDraft({ ...EMPTY, ...value }), [value]);

  const visibleCategories = draft.type ? categories.filter((c) => c.type === draft.type) : categories;

  const set = (field) => (e) => {
    const next = { ...draft, [field]: e.target.value };
    // A type change can make the selected category invalid
    if (field === 'type' && next.categoryId) {
      const category = categories.find((c) => String(c.id) === next.categoryId);
      if (category && next.type && category.type !== next.type) next.categoryId = '';
    }
    setDraft(next);
    setError(null);
  };

  function apply(e) {
    e.preventDefault();
    if (draft.startDate && draft.endDate && draft.startDate > draft.endDate) {
      setError('The start date must be on or before the end date');
      return;
    }
    onApply(draft);
  }

  const hasFilters = Object.values(value).some(Boolean);

  return (
    <form className="filters" onSubmit={apply} aria-label="Filter transactions">
      <Field label="From" error={error}>
        {(props) => <input {...props} className="input" type="date" value={draft.startDate} onChange={set('startDate')} />}
      </Field>
      <Field label="To">
        {(props) => <input {...props} className="input" type="date" value={draft.endDate} onChange={set('endDate')} />}
      </Field>
      <Field label="Type">
        {(props) => (
          <select {...props} className="input" value={draft.type} onChange={set('type')}>
            <option value="">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        )}
      </Field>
      <Field label="Category">
        {(props) => (
          <select {...props} className="input" value={draft.categoryId} onChange={set('categoryId')}>
            <option value="">All categories</option>
            {visibleCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {draft.type ? '' : ` (${c.type})`}
              </option>
            ))}
          </select>
        )}
      </Field>
      <div className="filters__actions">
        <Button type="submit">Apply</Button>
        <Button variant="ghost" onClick={() => onApply(EMPTY)} disabled={!hasFilters}>
          Reset
        </Button>
      </div>
    </form>
  );
}
