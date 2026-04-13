import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const NavigationContext = createContext();

export function NavigationProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Track the last visited sub-route for each main tab
  // 5 tabs: dashboard, members, payments, notifications, more
  const [tabStacks, setTabStacks] = useState({
    dashboard: '/dashboard',
    members: '/members',
    unpaid: '/payments/pending',
    notifications: '/notifications',
    more: '/settings' // Default to settings for the "More" bucket
  });

  const [lastTab, setLastTab] = useState('dashboard');
  const scrollPositions = useRef({});

  // Determine which tab the current URL belongs to
  const getTabFromPath = useCallback((path) => {
    if (path.startsWith('/dashboard')) return 'dashboard';
    if (path.startsWith('/members')) return 'members';
    if (path.startsWith('/payments/pending')) return 'unpaid';
    if (path.startsWith('/notifications')) return 'notifications';
    // Everything else (staff, expenses, revenue, settings) goes to 'more'
    return 'more';
  }, []);

  // Sync current path to tab stacks
  useEffect(() => {
    const tab = getTabFromPath(location.pathname);
    setTabStacks(prev => ({
      ...prev,
      [tab]: location.pathname + location.search
    }));
    setLastTab(tab);
  }, [location.pathname, location.search, getTabFromPath]);

  // Scroll management
  const saveScroll = useCallback((path, scrollY) => {
    scrollPositions.current[path] = scrollY;
  }, []);

  const getScroll = useCallback((path) => {
    return scrollPositions.current[path] || 0;
  }, []);

  const switchTab = useCallback((targetTab) => {
    const currentTab = getTabFromPath(location.pathname);
    
    if (currentTab === targetTab) {
      // If clicking current tab again, reset to base route
      const baseRoutes = {
        dashboard: '/dashboard',
        members: '/members',
        unpaid: '/payments/pending',
        notifications: '/notifications',
        more: '/settings'
      };
      navigate(baseRoutes[targetTab]);
    } else {
      const targetPath = tabStacks[targetTab];
      navigate(targetPath);
    }
  }, [tabStacks, navigate, location.pathname, getTabFromPath]);

  return (
    <NavigationContext.Provider value={{ 
      tabStacks, 
      lastTab, 
      switchTab, 
      saveScroll, 
      getScroll,
      currentTab: getTabFromPath(location.pathname)
    }}>
      {children}
    </NavigationContext.Provider>
  );
}

export const useNavigation = () => useContext(NavigationContext);
