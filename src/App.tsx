/**
 * App — tiny hash router.
 *   #/settings   → Lark connection settings
 *   #/tuvanview  → STT queue-board cho khu vực Tư vấn (đứng riêng, xem QueueBoardPage)
 *   #/kythuatview→ STT queue-board cho khu vực Kỹ thuật (đứng riêng, xem QueueBoardPage)
 *   anything else → the dashboard.
 */
import { useEffect, useState } from 'react';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import QueueBoardPage from './pages/QueueBoardPage';

type Route = 'settings' | 'dashboard' | 'tuvanview' | 'kythuatview';

function useHashRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const path = hash.replace(/^#\/?/, '');
  if (path.startsWith('settings')) return 'settings';
  if (path.startsWith('tuvanview')) return 'tuvanview';
  if (path.startsWith('kythuatview')) return 'kythuatview';
  return 'dashboard';
}

export default function App() {
  const route = useHashRoute();
  if (route === 'settings') return <SettingsPage />;
  if (route === 'tuvanview') return <QueueBoardPage cluster="consult" />;
  if (route === 'kythuatview') return <QueueBoardPage cluster="kythuat" />;
  return <DashboardPage />;
}
