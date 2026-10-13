import { Bar } from 'react-chartjs-2';
import { groupCategories } from '../../utils/chartData.js';
import { formatMoney, formatMoneyCompact } from '../../utils/format.js';
import { useChartTheme } from './chartTheme.js';

// One series = one color, so no legend box: the card title names it.
export function CategoryBreakdownChart({ rows }) {
  const theme = useChartTheme();
  const grouped = groupCategories(rows);
  const total = grouped.reduce((sum, r) => sum + r.total, 0);

  const data = {
    labels: grouped.map((r) => r.name),
    datasets: [
      {
        label: 'Spending',
        data: grouped.map((r) => r.total),
        backgroundColor: theme.series[0],
        hoverBackgroundColor: theme.series[0],
        borderRadius: 4,
        borderSkipped: 'start',
        maxBarThickness: 24,
        categoryPercentage: 0.8,
        barPercentage: 0.9,
      },
    ],
  };

  const options = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: theme.text,
        titleColor: theme.surface,
        bodyColor: theme.surface,
        padding: 10,
        cornerRadius: 6,
        callbacks: {
          label: (ctx) => ` ${formatMoney(ctx.parsed.x)} · ${((ctx.parsed.x / total) * 100).toFixed(1)}% of spending`,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: theme.grid },
        border: { display: false },
        ticks: { color: theme.muted, font: theme.font, maxTicksLimit: 5, callback: (value) => formatMoneyCompact(value) },
      },
      y: {
        grid: { display: false },
        border: { color: theme.axis },
        ticks: { color: theme.textSecondary, font: theme.font },
      },
    },
  };

  return (
    <div className="chart" style={{ height: `${Math.max(180, grouped.length * 40 + 40)}px` }}>
      <Bar data={data} options={options} role="img" aria-label="Spending by category" />
    </div>
  );
}

export function CategoryBreakdownTable({ rows }) {
  const total = rows.reduce((sum, r) => sum + Number(r.total), 0);
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col" className="num">Transactions</th>
            <th scope="col" className="num">Total</th>
            <th scope="col" className="num">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.categoryId}>
              <th scope="row">{r.name}</th>
              <td className="num">{r.count}</td>
              <td className="num">{formatMoney(r.total)}</td>
              <td className="num">{total > 0 ? `${((Number(r.total) / total) * 100).toFixed(1)}%` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
