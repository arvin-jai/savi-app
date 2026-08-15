/**
 * Balance sparkline for the dashboard hero (design handoff 2a).
 *
 * A line plus a soft area fill, no axes, no gridlines, no labels — D§38 says
 * charts are minimalist and D§26 says money comes before charts. This one earns
 * its place by sitting *inside* the Available card, giving the single biggest
 * number on the screen a direction without competing with it.
 *
 * Deliberately not a chart library. It is one `<Path>` and one filled `<Path>`;
 * pulling in a charting dependency for that would add weight, a theming
 * surface, and an animation model nobody asked for.
 *
 * The series is normalised by `normalisePoints`, which draws a flat line
 * through the middle rather than dividing by zero — so a new user with no
 * movement gets a calm horizontal line, not an empty box or a NaN path.
 */

import { View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { normalisePoints, type TrendPoint } from '@/features/transactions/trend';
import { brand, brandRole } from '@/theme/tokens';

/** viewBox units. The SVG scales to its container, so these are ratios. */
const W = 300;
const H = 66;
/** Keeps the 2.5-wide stroke from clipping at the extremes. */
const PAD = 3;

export function Sparkline({
  points,
  height = 66,
  /** Screen readers get the trend in words; the line is decoration. */
  accessibilityLabel,
}: {
  points: TrendPoint[];
  height?: number;
  accessibilityLabel?: string;
}) {
  // Two points are the minimum that can describe a direction. One is a dot
  // pretending to be a trend.
  if (points.length < 2) return null;

  const normalised = normalisePoints(points);
  const step = W / (normalised.length - 1);

  const coords = normalised.map((v, i) => {
    const x = i * step;
    // SVG y grows downward, so the highest value sits at the smallest y.
    const y = PAD + (1 - v) * (H - PAD * 2);
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });

  const line = `M${coords.join(' L')}`;
  const area = `${line} L${W} ${H} L0 ${H} Z`;

  return (
    <View
      style={{ height }}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
    >
      {/*
        Both the `width` prop AND the style width are needed, and neither is
        redundant:
          - native   reads the `width="100%"` prop
          - RN Web   renders a real <svg>, where the prop becomes an ATTRIBUTE.
                     An SVG with a percentage width attribute and no CSS width
                     falls back to intrinsic sizing — this rendered 40px wide
                     inside a 341px card until the style was added.
      */}
      <Svg
          width="100%"
          height={height}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          style={{ width: '100%' }}
        >
          <Defs>
            <LinearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={brand[500]} stopOpacity="0.28" />
              <Stop offset="1" stopColor={brand[500]} stopOpacity="0" />
            </LinearGradient>
          </Defs>

          <Path d={area} fill="url(#sparkFill)" />
          <Path
            d={line}
            fill="none"
            stroke={brandRole.action}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            // `preserveAspectRatio="none"` stretches the viewBox to the
            // container, which would stretch the stroke with it. This keeps the
            // line an even weight at any card width.
            vectorEffect="non-scaling-stroke"
          />
        </Svg>
    </View>
  );
}
