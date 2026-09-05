import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

/**
 * Register the Chart.js pieces this app uses, once.
 *
 * Registration used to live at the top of DashboardPage, which meant any other
 * chart only worked if the user had already visited the dashboard in that
 * session. Opening a member's profile directly — from a link, a bookmark, or a
 * refresh — threw "category is not a registered scale" and blanked the page.
 *
 * Importing this module is the whole API; ES modules run it at most once.
 */
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

export default ChartJS;
