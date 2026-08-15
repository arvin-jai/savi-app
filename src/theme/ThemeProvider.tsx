/**
 * Theme is app-global state, owned here and read from context.
 *
 * D§55 originally gave GlassCard a `theme: light | dark | system` prop. That was
 * removed (A14): a per-instance override lets any card be pinned to the wrong
 * theme, which is the exact inconsistency the component exists to prevent.
 * Components read the theme; they never take it as a prop.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import {
  color,
  glass,
  semantic,
  category,
  shadow,
  shadowDark,
  type CategoryName,
  type GlassLevel,
  type SemanticName,
  type ThemeName,
} from './tokens';

/** What the user chose. 'system' follows the OS. */
export type ThemePreference = ThemeName | 'system';

export type Theme = {
  /** The resolved theme — never 'system'. */
  name: ThemeName;
  isDark: boolean;
  color: (typeof color)[ThemeName];
  glass: (typeof glass)[ThemeName];
  shadow: typeof shadow | typeof shadowDark;
  /** Semantic color resolved for this theme's text usage (A2). */
  semanticText: (name: SemanticName) => string;
  /** Semantic fill — dots, charts, progress. Never text (A2). */
  semanticFill: (name: SemanticName) => string;
  /** Category color resolved for this theme (A12). Dots and chips only. */
  categoryColor: (name: CategoryName) => string;
  /**
   * The solid composite for a glass level (A4). Use this as the contrast
   * reference for any text placed on glass, and as the surface when blur is
   * unavailable.
   */
  glassFallback: (level: GlassLevel) => string;
};

type ThemeContextValue = Theme & {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'savi.theme-preference';

function isPreference(v: unknown): v is ThemePreference {
  return v === 'light' || v === 'dark' || v === 'system';
}

export function ThemeProvider({
  children,
  initialPreference = 'system',
}: {
  children: ReactNode;
  initialPreference?: ThemePreference;
}) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);

  // Restore the saved choice. Starting from 'system' and correcting once the
  // read resolves means a user who picked Light can see one dark frame at
  // launch — acceptable, and far cheaper than blocking the whole app on a
  // disk read. A splash-gated variant would be the fix if it ever shows.
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (active && isPreference(saved)) setPreferenceState(saved);
      })
      .catch(() => {
        // A failed read is not worth surfacing: the system default is a
        // perfectly good fallback and there is nothing the user could do.
      });
    return () => {
      active = false;
    };
  }, []);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  const name: ThemeName =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<ThemeContextValue>(() => {
    const isDark = name === 'dark';

    return {
      name,
      isDark,
      preference,
      setPreference,
      color: color[name],
      glass: glass[name],
      shadow: isDark ? shadowDark : shadow,
      semanticText: (s) => (isDark ? semantic[s].textDark : semantic[s].textLight),
      semanticFill: (s) => semantic[s].fill,
      categoryColor: (c) => (isDark ? category[c].dark : category[c].light),
      glassFallback: (level) => glass[name][level].fallback,
    };
  }, [name, preference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>. Wrap the app root.');
  }
  return ctx;
}
