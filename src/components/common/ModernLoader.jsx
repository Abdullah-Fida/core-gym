import React from 'react';
import { Dumbbell } from 'lucide-react';
import '../../styles/loading.css';

/**
 * ModernLoader - A premium loading component
 * @param {string} type - 'bar', 'morph', or 'pulse'
 * @param {string} text - Optional text to show below
 * @param {number} size - Optional size for the icon
 */
export function ModernLoader({ type = 'bar', text = 'Loading...', size = 32 }) {
  if (type === 'bar') {
    return (
      <div className="premium-loader-wrapper" style={{ width: '100%', padding: '20px 0' }}>
        <div className="loading-bar-container">
          <div className="loading-bar-fill"></div>
        </div>
        {text && <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>{text}</span>}
      </div>
    );
  }

  // Both morph and pulse now use the premium fitness loader for a consistent "wow" factor
  return (
    <div className="premium-loader-wrapper">
      <div className="fitness-loader">
        <div className="loader-ring"></div>
        <div className="loader-ring-inner"></div>
        <div className="loader-icon-center">
          <Dumbbell size={size} />
        </div>
      </div>
      {text && (
        <span style={{ 
          fontSize: '12px', 
          fontWeight: 800, 
          textTransform: 'uppercase', 
          letterSpacing: '2px', 
          color: 'var(--text-primary)',
          marginTop: '8px',
          background: 'linear-gradient(90deg, var(--text-muted), var(--text-primary), var(--text-muted))',
          backgroundSize: '200% 100%',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          animation: 'shimmer 2s linear infinite'
        }}>
          {text}
        </span>
      )}
    </div>
  );
}

export function FullScreenLoader() {
  return (
    <div style={{ 
      position: 'fixed', 
      inset: 0, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'rgba(5, 10, 15, 0.95)',
      backdropFilter: 'blur(10px)',
      zIndex: 9999
    }}>
      <ModernLoader type="pulse" size={48} text="Core Gym is Loading..." />
    </div>
  );
}
