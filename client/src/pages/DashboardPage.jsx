import { Link, useSearchParams } from 'react-router-dom';
import { dashboardApi } from '../api/dashboard.js';
import { transactionsApi } from '../api/transactions.js';
import {
  CategoryBreakdownChart,
  CategoryBreakdownTable,
} from '../components/charts/CategoryBreakdownChart.jsx';
import { ChartCard } from '../components/charts/ChartCard.jsx';
import { MonthlyTrendChart, MonthlyTrendTable } from '../components/charts/MonthlyTrendChart.jsx';
import { PeriodSelector } from '../components/PeriodSelector.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { TransactionTable } from '../components/TransactionTable.jsx';
import { Alert } from '../components/ui/Alert.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';
import { PageLoader } from '../components/ui/Spinner.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { PERIODS, periodRange } from '../utils/dates.js';
import { formatDate } from '../utils/format.js';

const DEFAULT_PERIOD = 'last-6-months';

function describePeriod(period, range) {
  if (period === 'custom' && range.startDate) return `${formatDate(range.startDate)} – ${formatDate(range.endDate)}`;
  return PERIODS.find((p) => p.id === period)?.label ?? 'All time';
}

export function DashboardPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();

  // The selected period lives in the URL, so refresh/back/share keep it
  const period = PERIODS.some((p) => p.id === params.get('period')) ? params.get('period') : DEFAULT_PERIOD;
  const custom = { startDate: params.get('start') ?? '', endDate: params.get('end') ?? '' };
  const range = periodRange(period, new Date(), custom);

  const summary = useApi((signal) => dashboardApi.summary(range, signal), [range.startDate, range.endDate]);
  const recent = useApi((signal) => transactionsApi.list({ pageSize: 5 }, signal), []);

  function changePeriod({ period: next, startDate, endDate }) {
    const nextParams = { period: next };
    if (next === 'custom' && startDate && endDate) Object.assign(nextParams, { start: startDate, end: endDate });
    setParams(nextParams);
  }

  const data = summary.data;
  const periodLabel = describePeriod(period, range);

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1 className="page__title">Dashboard</h1>
          <p className="page__subtitle">Hi {user.name.split(' ')[0]}, here is your money at a glance.</p>
        </div>
        <div className="page__actions">
          <PeriodSelector period={period} startDate={custom.startDate} endDate={custom.endDate} onChange={changePeriod} />
          <Link to="/transactions?new=1" className="btn btn--primary btn--md">
            + Add transaction
          </Link>
        </div>
      </header>

      {summary.error && (
        <Alert
          variant="error"
          title="Couldn't load the dashboard"
          action={
            <button type="button" className="btn btn--secondary btn--sm" onClick={summary.reload}>
              Retry
            </button>
          }
        >
          {summary.error.message}
        </Alert>
      )}

      {!data && summary.loading && <PageLoader label="Loading dashboard…" />}

      {data && (
        <div className={summary.loading ? 'is-refreshing' : ''} aria-busy={summary.loading}>
          <div className="stat-grid">
            <StatCard label="Current balance" value={data.currentBalance} caption="All time, income minus expenses" tone="auto" hero />
            <StatCard label="Income" value={data.totals.income} caption={periodLabel} />
            <StatCard label="Expenses" value={data.totals.expense} caption={periodLabel} />
            <StatCard
              label="Net"
              value={data.totals.net}
              caption={`${periodLabel} · ${data.totals.count} transaction${data.totals.count === 1 ? '' : 's'}`}
              tone="auto"
            />
          </div>

          {data.totals.count === 0 ? (
            <section className="card">
              <EmptyState
                title={Number(data.currentBalance) === 0 && !recent.data?.data.length ? 'No transactions yet' : 'Nothing in this period'}
                action={
                  <Link to="/transactions?new=1" className="btn btn--primary btn--md">
                    Add a transaction
                  </Link>
                }
              >
                {recent.data?.data.length
                  ? 'Choose a different period, or add a transaction for these dates.'
                  : 'Add your first income or expense to see totals and charts here.'}
              </EmptyState>
            </section>
          ) : (
            <div className="chart-grid">
              <ChartCard
                className="chart-grid__wide"
                title="Monthly trend"
                subtitle={`Income, expenses and net per month · ${periodLabel}`}
                table={<MonthlyTrendTable monthly={data.monthly} />}
              >
                <MonthlyTrendChart monthly={data.monthly} />
              </ChartCard>

              <ChartCard
                title="Spending by category"
                subtitle={periodLabel}
                table={data.expenseByCategory.length > 0 && <CategoryBreakdownTable rows={data.expenseByCategory} />}
              >
                {data.expenseByCategory.length > 0 ? (
                  <CategoryBreakdownChart rows={data.expenseByCategory} />
                ) : (
                  <p className="muted card__empty">No expenses in this period.</p>
                )}
              </ChartCard>

              <section className="card">
                <header className="card__header">
                  <div>
                    <h2 className="card__title">Income sources</h2>
                    <p className="card__subtitle">{periodLabel}</p>
                  </div>
                </header>
                {data.incomeByCategory.length > 0 ? (
                  <CategoryBreakdownTable rows={data.incomeByCategory} />
                ) : (
                  <p className="muted card__empty">No income in this period.</p>
                )}
              </section>
            </div>
          )}
        </div>
      )}

      <section className="card">
        <header className="card__header">
          <h2 className="card__title">Recent transactions</h2>
          <Link to="/transactions" className="btn btn--ghost btn--sm">
            View all →
          </Link>
        </header>
        {recent.loading && !recent.data && <PageLoader label="Loading…" />}
        {recent.error && <Alert variant="error">{recent.error.message}</Alert>}
        {recent.data &&
          (recent.data.data.length > 0 ? (
            <TransactionTable transactions={recent.data.data} compact />
          ) : (
            <p className="muted card__empty">Your latest transactions will appear here.</p>
          ))}
      </section>
    </div>
  );
}
