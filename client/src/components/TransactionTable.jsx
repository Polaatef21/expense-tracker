import { capitalize, formatDate, formatMoney } from '../utils/format.js';

export function Amount({ type, value }) {
  const signed = type === 'income' ? Number(value) : -Number(value);
  return <span className={`amount amount--${type}`}>{formatMoney(signed, { signed: true })}</span>;
}

// A table on wide screens; each row becomes a card on phones (see .table--responsive).
export function TransactionTable({ transactions, onEdit, onDelete, compact = false }) {
  return (
    <div className="table-wrap">
      <table className="table table--responsive">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Description</th>
            <th scope="col">Category</th>
            <th scope="col">Type</th>
            <th scope="col" className="num">
              Amount
            </th>
            {!compact && (
              <th scope="col">
                <span className="visually-hidden">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id}>
              <td data-label="Date" className="nowrap">
                {formatDate(t.date)}
              </td>
              <td data-label="Description" className={t.description ? '' : 'muted'}>
                {t.description ?? '—'}
              </td>
              <td data-label="Category">{t.category.name}</td>
              <td data-label="Type">
                <span className={`badge badge--${t.type}`}>{capitalize(t.type)}</span>
              </td>
              <td data-label="Amount" className="num">
                <Amount type={t.type} value={t.amount} />
              </td>
              {!compact && (
                <td className="row-actions">
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => onEdit(t)}>
                    Edit<span className="visually-hidden"> transaction from {formatDate(t.date)}</span>
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm btn--danger-text" onClick={() => onDelete(t)}>
                    Delete<span className="visually-hidden"> transaction from {formatDate(t.date)}</span>
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
