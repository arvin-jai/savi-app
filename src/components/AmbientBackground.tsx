/**
 * Ambient background (D§11) — the layer glass sits on.
 *
 * D§10 Rule 1: never put glass over a completely flat background. The orbs are
 * what make a translucent surface read as translucent. Opacity stays 5–15% —
 * D§11 is explicit that the gradient must never dominate.
 *
 * Implemented as SVG radial gradients with an opacity falloff to transparent.
 *
 * An earlier version used plain Views with a large border-radius, on the theory
 * that a low-opacity circle is indistinguishable from a radial gradient. On
 * device that was visibly false: they rendered as hard-edged circles and read as
 * shapes sitting on the page rather than as light behind it. D§11 says "blurred
 * gradient orbs", and the falloff is the whole point — it is what separates
 * atmosphere from decoration (D§66: no strong background gradients).
 */

import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { useTheme } from '@/theme/ThemeProvider';
import { ambient } from '@/theme/tokens';

type Orb = {
  id: string;
  color: string;
  /** Fractions of the viewport, so the composition holds at any screen size. */
  cx: number;
  cy: number;
  r: number;
  opacity: number;
};

export function AmbientBackground() {
  const theme = useTheme();

  // Dark mode needs less: the orbs read stronger against a near-black ground,
  // and D§11's ceiling is about perceived intensity, not a raw alpha value.
  const scale = theme.isDark ? 0.65 : 1;

  const orbs: Orb[] = [
    { id: 'a', color: ambient.purple, cx: 0.12, cy: 0.04, r: 0.55, opacity: ambient.opacity * scale },
    { id: 'b', color: ambient.blue, cx: 0.95, cy: 0.16, r: 0.5, opacity: ambient.opacity * 0.85 * scale },
    { id: 'c', color: ambient.purple, cx: 0.3, cy: 0.95, r: 0.6, opacity: ambient.opacity * 0.6 * scale },
  ];

  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: theme.color.background }]}
      pointerEvents="none"
    >
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          {orbs.map((o) => (
            <RadialGradient key={o.id} id={`orb-${o.id}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={o.color} stopOpacity={o.opacity} />
              {/* Mid stop keeps the falloff from looking linear and banded. */}
              <Stop offset="55%" stopColor={o.color} stopOpacity={o.opacity * 0.45} />
              <Stop offset="100%" stopColor={o.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>

        {orbs.map((o) => (
          <Circle
            key={o.id}
            cx={`${o.cx * 100}%`}
            cy={`${o.cy * 100}%`}
            r={`${o.r * 100}%`}
            fill={`url(#orb-${o.id})`}
          />
        ))}
      </Svg>
    </View>
  );
}
