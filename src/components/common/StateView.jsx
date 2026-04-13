import { AlertCircle, WifiOff, RefreshCcw, Search } from 'lucide-react';
import '../../styles/loading.css';

export function MemberSkeleton() {
  return (
    <div className="skeleton-member-card">
      <div className="skeleton skeleton-avatar"></div>
      <div className="skeleton-text-group">
        <div className="skeleton skeleton-title"></div>
        <div className="skeleton skeleton-subtitle"></div>
      </div>
      <div className="skeleton skeleton-badge"></div>
    </div>
  );
}

export function StateView({ type = 'error', title, description, onRetry }) {
  const isOffline = !navigator.onLine;

  const content = {
    error: {
      icon: <AlertCircle size={32} />,
      title: title || 'Something went wrong',
      description: description || 'We couldn\'t load the data. Please check your internet or try again.',
      className: 'status-view-error'
    },
    empty: {
      icon: <Search size={32} />,
      title: title || 'No results found',
      description: description || 'Try adjusting your filters or search terms.',
      className: 'status-view-empty'
    }
  };

  const current = isOffline ? {
    icon: <WifiOff size={32} />,
    title: 'No Connection',
    description: 'You are currently offline. Please check your internet.',
    className: 'status-view-error'
  } : content[type];

  return (
    <div className="status-view">
      <div className={`status-view-icon ${current.className}`} style={{ background: 'var(--bg-secondary)', borderRadius: 0 }}>
        {current.icon}
      </div>
      <h3 className="status-view-title">{current.title}</h3>
      <p className="status-view-desc">{current.description}</p>
      {onRetry && (
        <button className="btn-retry" onClick={onRetry}>
          <RefreshCcw size={16} /> Retry
        </button>
      )}
    </div>
  );
}
