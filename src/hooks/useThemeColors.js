import { useState, useEffect, useCallback } from 'react';

/**
 * Read the live design tokens so canvas-rendered UI (Chart.js) can follow the
 * theme.
 *
 * The dashboard's chart palette was a set of module-scope constants
 * (`const C_TEAL = '#38bdf8'`, tooltip `backgroundColor: '#1a2630'`, axis ticks
 * `color: '#8ea2b5'`). SVG and DOM elements pick up CSS variables for free;
 * a canvas cannot. So switching to light mode left the charts dark-tuned —
 * grey axis labels on a white card — and none of the ten accent presets ever
 * reached them.
 *
 * `lib/theme.js` applies presets by writing inline custom properties on
 * `<html>` and toggles modes with a class on the same element, so observing
 * those two attributes catches every theme change.
 */
const TOKENS = {
  accent: '--accent-primary',
  accentSoft: '--accent-light',
  success: '--status-active',
  warning: '--status-warning',
  danger: '--status-danger',
  info: '--status-info',
  surface: '--bg-primary',
  surface2: '--bg-secondary',
  surface3: '--bg-tertiary',
  heading: '--text-primary',
  body: '--text-secondary',
  muted: '--text-muted',
  line: '--border-color',
};

function readTokens() {
  if (typeof window === 'undefined') return {};
  const styles = getComputedStyle(document.documentElement);
  const out = {};
  for (const [key, prop] of Object.entries(TOKENS)) {
    out[key] = styles.getPropertyValue(prop).trim();
  }
  return out;
}

export function useThemeColors() {
  const [colors, setColors] = useState(readTokens);

  const refresh = useCallback(() => setColors(readTokens()), []);

  useEffect(() => {
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    // Also follow the OS setting, for viewers who never touched the toggle.
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', refresh);

    return () => {
      observer.disconnect();
      media.removeEventListener('change', refresh);
    };
  }, [refresh]);

  return colors;
}

/** `#38bdf8` + 0.85 → `rgba(56, 189, 248, 0.85)`. Passes non-hex values through. */
export function alpha(color, amount) {
  if (!color?.startsWith('#')) return color;
  const hex = color.slice(1);
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const int = parseInt(full, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${amount})`;
}
