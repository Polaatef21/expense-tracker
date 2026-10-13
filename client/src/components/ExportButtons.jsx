import { useState } from 'react';
import { transactionsApi } from '../api/transactions.js';
import { useToast } from '../context/ToastContext.jsx';
import { Button } from './ui/Button.jsx';

// Exports exactly the currently applied filters (the server re-checks ownership).
export function ExportButtons({ filters, disabled }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null);

  async function run(format) {
    setBusy(format);
    try {
      const name = await transactionsApi.exportFile(format, filters);
      toast.success(`Downloaded ${name}`);
    } catch (err) {
      toast.error(err.message || 'Export failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="export-buttons" role="group" aria-label="Export">
      <Button variant="secondary" size="sm" onClick={() => run('csv')} loading={busy === 'csv'} disabled={disabled || !!busy}>
        Export CSV
      </Button>
      <Button variant="secondary" size="sm" onClick={() => run('xlsx')} loading={busy === 'xlsx'} disabled={disabled || !!busy}>
        Export Excel
      </Button>
    </div>
  );
}
