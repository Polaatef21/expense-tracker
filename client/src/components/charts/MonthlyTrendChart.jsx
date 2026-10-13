import { Chart } from 'react-chartjs-2';
import { formatMoney, formatMoneyCompact, formatMonth } from '../../utils/format.js';
import { useChartTheme } from './chartTheme.js';

// Income and expense columns per month, with net as a line — all on ONE
// money axis (same unit), so there is no misleading second scale.
export function MonthlyTrendChart({ monthly }) {
  const theme = useChartTheme();
  const [incomeColor, expenseColor, netColor] = theme.series;

  const bar = (label, key, color) => ({
    type: 'bar',
    label,
    data: monthly.map((m) => Number(m[key])),
    backgroundColor: color,
    hoverBackgroundColor: color,
    borderRadius: 4,
    borderSkipped: 'start', // rounded at the data end, square at the baseline
    maxBarThickness: 24,
    categoryPercentage: 0.7,
    barPercentage: 0.9,
    order: 2,
  });

  const data = {
    labels: monthly.map((m) => formatMonth(m.month)),
    datasets: [
      bar('Income', 'income', incomeColor),
      bar('Expenses', 'expense', expenseColor),
      {
        type: 'line',
        label: 'Net',
        data: monthly.map((m) => Number(m.net)),
        borderColor: netColor,
        backgroundColor: netColor,
        borderWidth: 2,
        borderCapStyle: 'round',
        borderJoinStyle: 'round',
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBorderColor: theme.surface,
        pointBorderWidth: 2,
        order: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false }, // hover a month: see all three values
    animation: { duration: 300 },
    font: theme.font,
    plugins: {
      legend: {
        position: 'top',
        align: 'start',
        labels: {
          color: theme.textSecondary,
          usePointStyle: true,
          pointStyle: 'rectRounded',
          boxWidth: 10,
          boxHeight: 10,
          font: theme.font,
          // `order` controls drawing (line on top); keep the legend in dataset order
          sort: (a, b) => a.datasetIndex - b.datasetIndex,
        },
      },
      tooltip: {
        itemSort: (a, b) => a.datasetIndex - b.datasetIndex,
        backgroundColor: theme.text,
        titleColor: theme.surface,
        bodyColor: theme.surface,
        padding: 10,
        cornerRadius: 6,
        boxPadding: 4,
        callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatMoney(ctx.parsed.y)}` },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { color: theme.axis },
        ticks: { color: theme.muted, font: theme.font, maxRotation: 0, autoSkip: true },
      },
      y: {
        beginAtZero: true,
        grid: { color: theme.grid },
        border: { display: false },
        ticks: { color: theme.muted, font: theme.font, maxTicksLimit: 6, callback: (value) => formatMoneyCompact(value) },
      },
    },
  };

  return (
    <div className="chart chart--tall">
      <Chart
        type="bar"
        data={data}
        options={options}
        role="img"
        aria-label={`Monthly income, expenses and net for ${monthly.length} months`}
      />
    </div>
  );
}

export function MonthlyTrendTable({ monthly }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col" className="num">Income</th>
            <th scope="col" className="num">Expenses</th>
            <th scope="col" className="num">Net</th>
          </tr>
        </thead>
        <tbody>
          {monthly.map((m) => (
            <tr key={m.month}>
              <th scope="row">{formatMonth(m.month)}</th>
              <td className="num">{formatMoney(m.income)}</td>
              <td className="num">{formatMoney(m.expense)}</td>
              <td className="num">{formatMoney(m.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
