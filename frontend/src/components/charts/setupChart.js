/**
 * @file setupChart.js
 * Centralized Chart.js setup registering elements, scales, plugins, and annotation extensions.
 */

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';

let isRegistered = false;

export function registerCharts() {
  if (isRegistered) return;

  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    annotationPlugin
  );

  // Global clinical theme defaults
  ChartJS.defaults.font.family =
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ChartJS.defaults.font.size = 11;
  ChartJS.defaults.color = '#94a3b8';
  ChartJS.defaults.responsive = true;
  ChartJS.defaults.maintainAspectRatio = false;
  ChartJS.defaults.plugins.legend.labels.usePointStyle = true;
  ChartJS.defaults.plugins.legend.labels.boxWidth = 8;
  ChartJS.defaults.plugins.legend.labels.boxHeight = 8;

  isRegistered = true;
}

registerCharts();

export default ChartJS;
