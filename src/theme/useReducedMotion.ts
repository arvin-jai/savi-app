/**
 * Reduced motion (D§44, A15).
 *
 * A15's mapping: transforms and scale are removed, opacity fades are kept but
 * shortened to `fast`, and the skeleton shimmer becomes a static block. The
 * point is that motion stops conveying meaning — it never becomes the ONLY
 * signal, so removing it loses nothing.
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;

    // Web exposes this as a media query; native as an a11y setting. Both are
    // live — a user can toggle it while the app is open.
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !window.matchMedia) return;
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReduced(mq.matches);
      const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }

    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (active) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
