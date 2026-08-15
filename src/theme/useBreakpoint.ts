/**
 * Breakpoints (D§45).
 *
 *   mobile   320–767   one column, bottom nav, FAB
 *   tablet   768–1023   two-column cards, expanded nav
 *   desktop  1024+      sidebar, multi-column dashboard
 *
 * Driven by `useWindowDimensions`, which updates on rotation and on browser
 * resize — a media query would only cover the web half.
 */

import { useWindowDimensions } from 'react-native';

import { layout, space } from './tokens';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

export type BreakpointInfo = {
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  /** True where the sidebar replaces the bottom nav. */
  useSidebar: boolean;
  /** Horizontal page padding for this width (D§17). */
  pagePadding: number;
  /** Column count for card grids. */
  columns: number;
  width: number;
};

export function useBreakpoint(): BreakpointInfo {
  const { width } = useWindowDimensions();

  const breakpoint: Breakpoint =
    width >= layout.breakpointDesktop
      ? 'desktop'
      : width >= layout.breakpointTablet
        ? 'tablet'
        : 'mobile';

  const isDesktop = breakpoint === 'desktop';
  const isTablet = breakpoint === 'tablet';

  return {
    breakpoint,
    isMobile: breakpoint === 'mobile',
    isTablet,
    isDesktop,
    // The sidebar needs real horizontal room; a tablet in portrait does not
    // have it, so tablets keep the bottom nav and just gain a second column.
    useSidebar: isDesktop,
    pagePadding: isDesktop
      ? layout.pagePaddingDesktop
      : isTablet
        ? layout.pagePaddingTablet
        : layout.pagePaddingMobile,
    columns: isDesktop ? 3 : isTablet ? 2 : 1,
    width,
  };
}

/**
 * Bottom inset for scrollable content.
 *
 * With the sidebar there is no floating bottom bar to clear, so reserving
 * ~110px of empty space at the bottom of every desktop page would just be a
 * hole. See A15 for the mobile value.
 */
export function useScrollBottomInset(): number {
  const { useSidebar } = useBreakpoint();
  return useSidebar ? space[8] : layout.scrollBottomInset;
}
