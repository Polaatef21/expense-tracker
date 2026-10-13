import {
  BarController,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import { useMemo } from 'react';
import { useColorScheme } from '../../hooks/useColorScheme.js';

// Register only the Chart.js pieces we use (keeps the bundle smaller)
ChartJS.register(BarController, BarElement, CategoryScale, LinearScale, LineController, LineElement, PointElement, Tooltip, Legend);

// Chart colors come from CSS custom properties (see styles/global.css), so the
// light and dark palettes live in one place. Re-read when the theme changes.
export function useChartTheme() {
  const scheme = useColorScheme();
  return useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    const v = (name) => css.getPropertyValue(name).trim();
    return {
      scheme,
      surface: v('--surface'),
      text: v('--text'),
      textSecondary: v('--text-2'),
      muted: v('--muted'),
      grid: v('--grid'),
      axis: v('--axis'),
      series: [v('--series-1'), v('--series-2'), v('--series-3')],
      font: { family: v('--font-sans') || 'system-ui, sans-serif', size: 12 },
    };
  }, [scheme]);
}
