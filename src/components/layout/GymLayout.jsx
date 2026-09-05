import { Outlet, useLocation } from 'react-router-dom';
import { useRef, useEffect, useState } from 'react';
import { useNavigation } from '../../contexts/NavigationContext';

import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import MoreDrawer from './MoreDrawer';
import AppHeader from './AppHeader';

export default function GymLayout() {
  const location = useLocation();
  const { saveScroll, getScroll } = useNavigation();
  const mainRef = useRef(null);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // Save scroll before route change
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return undefined;

    const handleScroll = () => {
      saveScroll(location.pathname + location.search, main.scrollTop);
    };

    main.addEventListener('scroll', handleScroll, { passive: true });
    return () => main.removeEventListener('scroll', handleScroll);
  }, [location.pathname, location.search, saveScroll]);

  // Restore scroll and verify the session on route change
  useEffect(() => {
    const main = mainRef.current;
    let timer;
    if (main) {
      const saved = getScroll(location.pathname + location.search);
      timer = setTimeout(() => {
        main.scrollTo({ top: saved, behavior: 'instant' });
      }, 50);
    }

    // Proactive suspension check on navigation; the api interceptor handles
    // the redirect if the gym has been deactivated.
    import('../../lib/api').then(({ default: api }) => {
      api.get('/auth/verify').catch(() => {});
    });

    return () => clearTimeout(timer);
  }, [location.pathname, location.search, getScroll]);

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />

      <div className="flex flex-col grow min-w-0 h-screen">
        <AppHeader homePath="/dashboard" settingsPath="/settings" />

        <main ref={mainRef} className="grow overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>

        <BottomNav onMoreClick={() => setIsMoreOpen(true)} />
        <MoreDrawer isOpen={isMoreOpen} onClose={() => setIsMoreOpen(false)} />
      </div>
    </div>
  );
}
