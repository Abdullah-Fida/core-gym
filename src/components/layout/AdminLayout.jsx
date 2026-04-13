import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, AlertTriangle, CreditCard, LogOut, MessageSquare, Menu, X, Sun, Moon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { toggleMode, getActiveMode } from '../../lib/theme';
import BottomNav from './BottomNav';
import MoreDrawer from './MoreDrawer';
import './layout.css';
import '../../styles/admin.css';

export default function AdminLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [mode, setMode] = useState(getActiveMode());

  const handleToggleMode = () => {
    const nextMode = toggleMode();
    setMode(nextMode);
  };

  return (
    <div className="admin-layout">
      {/* Desktop Sidebar */}
      <aside className={`admin-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-logo" onClick={() => navigate('/admin/dashboard')}>
          <div className="logo-glitch-container">
            <div className="logo-icon-premium">CG</div>
          </div>
          <div className="logo-text">
            <div className="brand-name">CORE <span>GYM</span></div>
            <div className="admin-badge-premium">
              <div className="dot"></div>
              SUPER ADMIN
            </div>
          </div>
        </div>

        <div className="admin-nav-section">
          <div className="admin-nav-section-title">Overview</div>
          <NavLink to="/admin/dashboard" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={20} /> Dashboard
          </NavLink>
          <NavLink to="/admin/gyms" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <Building2 size={20} /> All Gyms
          </NavLink>
        </div>

        <div className="admin-nav-section">
          <div className="admin-nav-section-title">Management</div>
          <NavLink to="/admin/alerts" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <AlertTriangle size={20} /> Alerts
          </NavLink>
          <NavLink to="/admin/subscriptions" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
            <CreditCard size={20} /> Subscriptions
          </NavLink>
        </div>

        <div className="admin-sidebar-footer">
          <button
            className="btn btn-secondary btn-block btn-sm admin-sidebar-logout"
            onClick={() => { logout(); navigate('/login'); }}
          >
            <LogOut size={16} style={{ marginRight: 8 }} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="admin-main">
        {/* Mobile Header */}
        <header className="admin-topbar">
          <div className="admin-header-left">
            <button className="sidebar-toggle" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            
            <div className="admin-header-logo-container" onClick={() => navigate('/admin/dashboard')}>
              <div className="logo-icon-premium-sm">CG</div>
              <div className="brand-name">CORE <span>GYM</span></div>
            </div>
          </div>

          <div className="admin-header-actions">
             <button className="mode-toggle" onClick={handleToggleMode} title="Toggle Theme">
                {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
             </button>
             <button className="btn btn-icon desktop-only" onClick={() => { logout(); navigate('/login'); }} title="Logout">
               <LogOut size={18} />
             </button>
          </div>
        </header>

        <main className="admin-content-scroller">
          <div className="admin-container">
            <Outlet />
          </div>
        </main>

        <BottomNav onMoreClick={() => setIsMoreOpen(true)} />
        <MoreDrawer isOpen={isMoreOpen} onClose={() => setIsMoreOpen(false)} />
      </div>
    </div>
  );
}
