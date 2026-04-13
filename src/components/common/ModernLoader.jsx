import React from 'react';
import '../../styles/loading.css';

/**
 * ModernLoader - A premium loading component
 * @param {string} type - 'bar', 'morph', or 'pulse'
 * @param {string} text - Optional text to show below
 * @param {number} size - Optional size for morph/pulse
 */
export function ModernLoader({ type = 'bar', text = 'Loading...', size }) {
  if (type === 'bar') {
    return (
      <div className="premium-loader-container" style={{ width: '100%', padding: '20px 0' }}>
        <div className="loading-bar-container">
          <div className="loading-bar-fill"></div>
        </div>
        {text && <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)' }}>{text}</span>}
      </div>
    );
  }

  if (type === 'morph') {
    return (
      <div className="premium-loader-container">
        <div className="morph-shape" style={size ? { width: size, height: size } : {}}></div>
        {text && <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-primary)' }}>{text}</span>}
      </div>
    );
  }

  return (
    <div className="premium-loader-container">
      <div className="pulse-icon" style={size ? { fontSize: size } : { fontSize: '32px' }}>
        🏋️
      </div>
      {text && <span style={{ fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-primary)' }}>{text}</span>}
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
      background: 'white',
      zIndex: 9999
    }}>
      <ModernLoader type="morph" text="Preparing Core Gym..." />
    </div>
  );
}
