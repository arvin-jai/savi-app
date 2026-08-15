/**
 * M0 FEASIBILITY SPIKE — see docs/BUILD-PLAN.md#m0--feasibility-spike
 *
 * Answers three questions that no document can close:
 *
 *   R5  Does backdrop blur hold 60fps in a scrolling list on mid-range Android?
 *   R6  Does `boxShadow` render a tinted shadow on Android in this SDK, or is it
 *       `elevation`-only?
 *   R3  Is the no-blur fallback acceptable to look at?
 *
 * HOW TO USE
 *   1. Run on a MID-RANGE PHYSICAL ANDROID DEVICE. An emulator's GPU tells you
 *      nothing about real blur cost — its answer is not valid for R5.
 *   2. Toggle BLUR on. Scroll hard, continuously, for ~10 seconds.
 *   3. Read the FPS counter — specifically the "min" figure, not the average.
 *      A list that averages 55 but drops to 20 on every fling feels broken.
 *   4. Toggle BLUR off. Repeat. Compare, and look at whether the fallback is
 *      actually acceptable (R3).
 *   5. Look at the two shadow swatches at the top for R6.
 *
 * VERDICT THRESHOLD
 *   Blur is affordable in lists only if min FPS stays at/above ~55 with it on.
 *   Anything less and A6 stands: fallback is the baseline, blur is reserved for
 *   the nav, modals, sheets, and the dashboard hero.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/AmbientBackground';
import { GlassCard } from '@/components/glass/GlassCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import { formatMoney } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import { radius, space, type as typeScale } from '@/theme/tokens';

const ROW_COUNT = 50;

const MERCHANTS = [
  'Jollibee', 'Grab', 'Meralco', 'Shopee', 'Globe', 'Watsons',
  'SM Supermarket', 'Angkas', 'Netflix', 'Mercury Drug',
];

type Row = { id: string; name: string; amountMinor: number; meta: string };

const ROWS: Row[] = Array.from({ length: ROW_COUNT }, (_, i) => ({
  id: String(i),
  name: MERCHANTS[i % MERCHANTS.length],
  amountMinor: -((i * 3719) % 480000 + 5000),
  meta: i % 3 === 0 ? 'Today · Need' : i % 3 === 1 ? 'Yesterday · Want' : 'Aug 11 · Bill',
}));

/**
 * Frame-rate sampler. Uses requestAnimationFrame deltas — the same clock the
 * renderer runs on, so a dropped frame shows up as a long delta rather than
 * being averaged away.
 */
function useFpsMeter(running: boolean) {
  const [fps, setFps] = useState(0);
  const [minFps, setMinFps] = useState(Infinity);
  const frames = useRef(0);
  const last = useRef(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;

    let cancelled = false;
    last.current = Date.now();
    frames.current = 0;

    const tick = () => {
      if (cancelled) return;
      frames.current += 1;
      const now = Date.now();
      const elapsed = now - last.current;

      if (elapsed >= 500) {
        const current = Math.round((frames.current * 1000) / elapsed);
        setFps(current);
        // Ignore the idle period before scrolling starts.
        if (current > 0) setMinFps((m) => Math.min(m, current));
        frames.current = 0;
        last.current = now;
      }
      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [running]);

  const reset = useCallback(() => {
    setMinFps(Infinity);
    setFps(0);
  }, []);

  return { fps, minFps: minFps === Infinity ? 0 : minFps, reset };
}

export default function GlassSpike() {
  const theme = useTheme();
  const [blurOn, setBlurOn] = useState(false);
  const { fps, minFps, reset } = useFpsMeter(true);

  const toggleBlur = (v: boolean) => {
    setBlurOn(v);
    reset();
  };

  const renderRow = useCallback(
    ({ item }: { item: Row }) => (
      <GlassCard
        variant="default"
        radius="xl"
        padding="md"
        blur={blurOn}
        // The spike is the ONLY place this should be set. See GlassCard.
        allowAndroidBlur={blurOn}
        style={{ marginBottom: space[3] }}
      >
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={{ ...typeScale.body, fontWeight: '500', color: theme.color.textPrimary }}>
              {item.name}
            </Text>
            <Text style={{ ...typeScale.caption, color: theme.color.textSecondary, marginTop: 2 }}>
              {item.meta}
            </Text>
          </View>
          <Text
            style={{
              ...typeScale.body,
              fontWeight: '600',
              color: theme.semanticText('expense'),
            }}
          >
            {formatMoney(item.amountMinor, { signDisplay: 'always' })}
          </Text>
        </View>
      </GlassCard>
    ),
    [blurOn, theme]
  );

  const verdict =
    minFps === 0 ? 'scroll to measure' : minFps >= 55 ? 'affordable' : 'NOT affordable in lists';

  return (
    <View style={{ flex: 1 }}>
      <AmbientBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* ── Instrument panel ────────────────────────────────────────── */}
        <View style={{ paddingHorizontal: space[4], paddingBottom: space[3] }}>
          <ScreenHeader title="M0 · Glass spike" />
          <Text style={{ ...typeScale.caption, color: theme.color.textSecondary }}>
            {Platform.OS} · {ROW_COUNT} cards · FlatList (worst case)
          </Text>

          <GlassCard variant="elevated" padding="md" style={{ marginTop: space[3] }}>
            <View style={styles.row}>
              <Text style={{ ...typeScale.label, color: theme.color.textPrimary }}>
                Backdrop blur
              </Text>
              <Switch value={blurOn} onValueChange={toggleBlur} />
            </View>

            <View style={[styles.row, { marginTop: space[3] }]}>
              <Stat label="FPS now" value={String(fps)} />
              <Stat label="FPS min" value={minFps === 0 ? '—' : String(minFps)} />
            </View>

            <Text
              style={{
                ...typeScale.caption,
                marginTop: space[3],
                color:
                  minFps === 0
                    ? theme.color.textSecondary
                    : minFps >= 55
                      ? theme.semanticText('income')
                      : theme.semanticText('danger'),
              }}
            >
              R5 verdict (blur {blurOn ? 'ON' : 'OFF'}): {verdict}
            </Text>

            <Pressable onPress={reset} style={{ marginTop: space[2] }}>
              <Text style={{ ...typeScale.caption, color: theme.color.brand }}>Reset min</Text>
            </Pressable>
          </GlassCard>

          {/* ── R6: shadow rendering ──────────────────────────────────── */}
          <View style={[styles.row, { marginTop: space[3], gap: space[3] }]}>
            <ShadowSwatch label="boxShadow (tinted)" mode="box" />
            <ShadowSwatch label="elevation (neutral)" mode="elevation" />
          </View>
          <Text
            style={{
              ...typeScale.micro,
              color: theme.color.textSecondary,
              marginTop: space[2],
            }}
          >
            R6: if the left swatch shows a soft BLUE-tinted shadow, boxShadow works and the
            tint holds on Android. If both look identically grey, Android is elevation-only.
          </Text>
        </View>

        {/* ── The actual test surface ─────────────────────────────────── */}
        <FlatList
          data={ROWS}
          renderItem={renderRow}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: space[10] }}
          // No windowing tricks — measure the honest worst case.
          removeClippedSubviews={false}
          initialNumToRender={ROW_COUNT}
        />
      </SafeAreaView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View>
      <Text style={{ ...typeScale.micro, color: theme.color.textSecondary }}>{label}</Text>
      <Text style={{ ...typeScale.h2, color: theme.color.textPrimary }}>{value}</Text>
    </View>
  );
}

function ShadowSwatch({ label, mode }: { label: string; mode: 'box' | 'elevation' }) {
  const theme = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <View
        style={[
          {
            height: 56,
            width: '100%',
            borderRadius: radius.lg,
            backgroundColor: theme.color.surface,
          },
          mode === 'box'
            ? { boxShadow: '0 8px 30px rgba(31,38,135,0.35)' }
            : { elevation: 8 },
        ]}
      />
      <Text
        style={{
          ...typeScale.micro,
          color: theme.color.textSecondary,
          marginTop: space[2],
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
