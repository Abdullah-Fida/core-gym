import React from 'react';
import { Dumbbell, Activity } from 'lucide-react';
import '../../styles/loading.css';

/**
 * ModernLoader - A premium fitness-themed loading component
 * @param {string} type - 'bar', 'fitness', or 'minimal'
 * @param {string} text - Optional text to show below
 */
export function ModernLoader({ type = 'fitness', text = 'Preparing Your Gym...' }) {
  if (type === 'bar') {
    return (
      <div className="premium-loader-container" style={{ width: '100%', padding: '20px 0' }}>
        <div className="loading-bar-container">
          <div className="loading-bar-fill"></div>
        </div>
        {text && <div className="shimmer-text" style={{ marginTop: 12 }}>{text}</div>}
      </div>
    );
  }

  return (
    <div className="fitness-loader-wrapper">
      <div className="orbital-container">
        <div className="orbital-ring"></div>
        <div className="orbital-ring"></div>
        <div className="central-icon">
          <Dumbbell size={32} color="var(--accent-primary)" strokeWidth={2.5} />
        </div>
      </div>
      {text && <div className="shimmer-text">{text}</div>}
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
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      backdropFilter: 'blur(10px)',
      zIndex: 9999
    }}>
      <ModernLoader text="GETTING THINGS READY..." />
    </div>
  );
}
