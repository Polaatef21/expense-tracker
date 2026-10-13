import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { categoriesApi } from '../api/categories.js';
import { transactionsApi } from '../api/transactions.js';
import { ExportButtons } from '../components/ExportButtons.jsx';
import { Pagination } from '../components/Pagination.jsx';
import { TransactionFilters } from '../components/TransactionFilters.jsx';
import { TransactionForm } from '../components/TransactionForm.jsx';
import { Amount, TransactionTable } from '../components/TransactionTable.jsx';
import { Alert } from '../components/ui/Alert.jsx';
import { Button } from '../components/ui/Button.jsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { PageLoader } from '../components/ui/Spinner.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { formatDate, formatMoney } from '../utils/format.js';

const PAGE_SIZE = 20;
const FILTER_KEYS = ['startDate', 'endDate', 'type', 'categoryId'];

export function TransactionsPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(null); // null | 'new' | transaction
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  // Filters live in the URL: refresh, back/forward and bookmarks keep them
  const query = params.toString();
  const filters = useMemo(
    () => Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) ?? ''])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query],
  );
  const page = Math.max(1, Number(params.get('page')) || 1);

  const list = useApi((signal) => transactionsApi.list({ ...filters, page, pageSize: PAGE_SIZE }, signal), [filters, page]);
  const categories = useApi((signal) => categoriesApi.list(signal), []);

  // "Add transaction" links elsewhere open the form via ?new=1
  useEffect(() => {
    if (params.get('new') === '1') {
      setEditing('new');
      const next = new URLSearchParams(params);
      next.delete('new');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  function applyFilters(draft) {
    const next = {};
    for (const key of FILTER_KEYS) if (draft[key]) next[key] = draft[key];
    setParams(next); // back to page 1
  }

  function changePage(nextPage) {
    const next = new URLSearchParams(params);
    next.set('page', String(nextPage));
    setParams(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save(payload) {
    if (editing === 'new') {
      await transactionsApi.create(payload);
      toast.success('Transaction added');
    } else {
      await transactionsApi.update(editing.id, payload);
      toast.success('Transaction updated');
    }
    setEditing(null);
    list.reload();
    categories.reload(); // usage counts changed
  }

  async function confirmDelete() {
    setDeleteBusy(true);
    try {
      await transactionsApi.remove(deleting.id);
      toast.success('Transaction deleted');
      setDeleting(null);
      // Deleting the last row of a page: step back a page
      if (list.data?.data.length === 1 && page > 1) changePage(page - 1);
      else list.reload();
      categories.reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleteBusy(false);
    }
  }

  const data = list.data;
  const hasFilters = FILTER_KEYS.some((key) => filters[key]);

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1 className="page__title">Transactions</h1>
          <p className="page__subtitle">Add, edit, filter and export your income and expenses.</p>
        </div>
        <div className="page__actions">
          <Button onClick={() => setEditing('new')} disabled={!categories.data}>
            + Add transaction
          </Button>
        </div>
      </header>

      <section className="card">
        <TransactionFilters value={filters} categories={categories.data ?? []} onApply={applyFilters} />
      </section>

      {list.error && (
        <Alert
          variant="error"
          title="Couldn't load transactions"
          action={
            <button type="button" className="btn btn--secondary btn--sm" onClick={list.reload}>
              Retry
            </button>
          }
        >
          {list.error.message}
        </Alert>
      )}

      <section className="card">
        <header className="card__header card__header--wrap">
          {data ? (
            <dl className="summary-bar">
              <div>
                <dt>Transactions</dt>
                <dd>{data.summary.count}</dd>
              </div>
              <div>
                <dt>Income</dt>
                <dd><Amount type="income" value={data.summary.income} /></dd>
              </div>
              <div>
                <dt>Expenses</dt>
                <dd><Amount type="expense" value={data.summary.expense} /></dd>
              </div>
              <div>
                <dt>Net</dt>
                <dd className={Number(data.summary.net) < 0 ? 'is-negative' : ''}>{formatMoney(data.summary.net)}</dd>
              </div>
            </dl>
          ) : (
            <span />
          )}
          <ExportButtons filters={filters} disabled={!data || data.summary.count === 0} />
        </header>

        {!data && list.loading && <PageLoader label="Loading transactions…" />}

        {data && data.data.length === 0 && (
          <EmptyState
            title={hasFilters ? 'No transactions match these filters' : 'No transactions yet'}
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={() => applyFilters({})}>
                  Clear filters
                </Button>
              ) : (
                <Button onClick={() => setEditing('new')}>Add your first transaction</Button>
              )
            }
          >
            {hasFilters ? 'Try a wider date range or a different category.' : 'Record income or an expense to get started.'}
          </EmptyState>
        )}

        {data && data.data.length > 0 && (
          <div className={list.loading ? 'is-refreshing' : ''} aria-busy={list.loading}>
            <TransactionTable transactions={data.data} onEdit={setEditing} onDelete={setDeleting} />
            <Pagination {...data.pagination} onChange={changePage} />
          </div>
        )}
      </section>

      <Modal open={editing !== null} title={editing === 'new' ? 'Add transaction' : 'Edit transaction'} onClose={() => setEditing(null)}>
        {editing !== null && categories.data && (
          <TransactionForm
            key={editing === 'new' ? 'new' : editing.id}
            transaction={editing === 'new' ? null : editing}
            categories={categories.data}
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete transaction?"
        loading={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      >
        {deleting && (
          <p>
            This permanently deletes the {deleting.type} of <strong>{formatMoney(deleting.amount)}</strong> in{' '}
            <strong>{deleting.category.name}</strong> on {formatDate(deleting.date)}.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
