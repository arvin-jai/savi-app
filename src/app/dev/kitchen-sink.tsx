/**
 * Kitchen sink — M1's definition of done.
 *
 * Every primitive, every state, both themes. This route stays in the repo
 * permanently: it is how every later component gets reviewed, and how a
 * regression in a token gets noticed before it reaches a screen.
 *
 * The contrast section is the important one. It renders each semantic color
 * BOTH as text and as a fill, side by side, so using a fill value as text —
 * the v1.0 defect that failed WCAG AA on four colors — is visible rather than
 * theoretical.
 */

import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/AmbientBackground';
import { InsightCard } from '@/components/domain/InsightCard';
import { GlassCard } from '@/components/glass/GlassCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button, Fab } from '@/components/ui/Button';
import { Celebration } from '@/components/ui/Celebration';
import { Badge, Divider, EmptyState, Skeleton, StatusPill, Toast } from '@/components/ui/feedback';
import { Input, MoneyInput } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import type { Insight } from '@/features/insights/rules';
import { formatMoney } from '@/lib/money';
import { useTheme } from '@/theme/ThemeProvider';
import {
  category,
  glass,
  radius,
  semantic,
  space,
  type as typeScale,
  type CategoryName,
  type GlassLevel,
  type SemanticName,
  type TypeName,
} from '@/theme/tokens';

const SEMANTICS: SemanticName[] = ['income', 'expense', 'bill', 'danger', 'info'];
const CATEGORIES = Object.keys(category) as CategoryName[];
const TYPE_NAMES = Object.keys(typeScale) as TypeName[];
const GLASS_LEVELS: GlassLevel[] = ['subtle', 'default', 'elevated'];

const INSIGHT_TONES: Insight[] = [
  {
    id: 'ks-calm',
    headline: 'Internet (₱1,699) is due today.',
    action: { label: 'View bills', href: '/bills' },
    tone: 'calm',
  },
  {
    id: 'ks-attention',
    headline: 'Your upcoming bills are ₱2,400 more than your current balance.',
    detail: 'Paying everything on time would need a top-up or moving a bill.',
    action: { label: 'Review bills', href: '/bills' },
    tone: 'attention',
  },
  {
    id: 'ks-positive',
    headline: 'You spent ₱1,200 less on food than last month.',
    tone: 'positive',
  },
];

export default function KitchenSink() {
  const theme = useTheme();
  const [amount, setAmount] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <AmbientBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{ padding: space[4], paddingBottom: space[24], gap: space[6] }}
        >
          {/* ── Header + theme switch ────────────────────────────────── */}
          <View style={{ gap: space[3] }}>
            <ScreenHeader title="Kitchen sink" />
            <Text variant="bodySm" tone="secondary">
              Theme: {theme.name} · preference: {theme.preference}
            </Text>
            <View style={{ flexDirection: 'row', gap: space[2], flexWrap: 'wrap' }}>
              <Button label="Light" size="sm" variant="secondary" onPress={() => theme.setPreference('light')} />
              <Button label="Dark" size="sm" variant="secondary" onPress={() => theme.setPreference('dark')} />
              <Button label="System" size="sm" variant="ghost" onPress={() => theme.setPreference('system')} />
            </View>
          </View>

          {/* ── Buttons: every state ─────────────────────────────────── */}
          <Section title="Button — all states (A15)">
            <Row>
              <Button label="Primary" onPress={() => {}} />
              <Button label="Secondary" variant="secondary" onPress={() => {}} />
              <Button label="Ghost" variant="ghost" onPress={() => {}} />
              <Button label="Danger" variant="danger" onPress={() => {}} />
            </Row>
            <Row>
              <Button label="Disabled" disabled />
              <Button label="Loading" loading />
              <Button label="Small" size="sm" />
            </Row>
            <Text variant="micro" tone="secondary">
              Hover and focus are web-only — tab through to see the focus ring.
            </Text>
            <Button label="Block" block onPress={() => {}} />
          </Section>

          {/* ── Contrast: the v1.0 defect, made visible ──────────────── */}
          <Section title="Semantic colors — text vs fill (A2)">
            <Text variant="bodySm" tone="secondary">
              Left column is the text value; right is the fill. The fill values fail WCAG AA as
              text on this background — that is why they are separate tokens.
            </Text>
            {SEMANTICS.map((s) => (
              <View
                key={s}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 44 }}
              >
                <Text variant="label" style={{ width: 72 }} tone="secondary">
                  {s}
                </Text>
                <Text variant="body" weight="600" tone={s} style={{ width: 110 }}>
                  {formatMoney(3000000, { signDisplay: s === 'income' ? 'always' : 'negative' })}
                </Text>
                <View
                  style={{
                    width: 44,
                    height: 24,
                    borderRadius: radius.sm,
                    backgroundColor: theme.semanticFill(s),
                  }}
                />
                <Badge label={s} tone={s} />
              </View>
            ))}
          </Section>

          {/* ── Categories ───────────────────────────────────────────── */}
          <Section title="Category palette (A12)">
            <Text variant="bodySm" tone="secondary">
              Dots only — never an amount, never a card background. No value here duplicates a
              financial semantic.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
              {CATEGORIES.map((c) => (
                <View
                  key={c}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 44 }}
                >
                  <View
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: radius.full,
                      backgroundColor: theme.categoryColor(c),
                    }}
                  />
                  <Text variant="caption">{c}</Text>
                </View>
              ))}
            </View>
          </Section>

          {/* ── Glass: blur vs fallback ──────────────────────────────── */}
          <Section title="Glass levels — blur vs fallback (A4, A6)">
            <Text variant="bodySm" tone="secondary">
              Top row requests blur; bottom row is the solid fallback. The fallback is the
              baseline, not a degraded state — if it does not look deliberate, A6 has failed.
            </Text>
            {GLASS_LEVELS.map((level) => (
              <View key={level} style={{ gap: space[2] }}>
                <Text variant="label" tone="secondary">
                  {level} · fallback {glass[theme.name][level].fallback}
                </Text>
                <Row>
                  <GlassCard variant={level} blur padding="md" style={{ flex: 1, minWidth: 130 }}>
                    <Text variant="caption">blur requested</Text>
                  </GlassCard>
                  <GlassCard variant={level} padding="md" style={{ flex: 1, minWidth: 130 }}>
                    <Text variant="caption">fallback</Text>
                  </GlassCard>
                </Row>
              </View>
            ))}
          </Section>

          {/* ── Savi Insight ─────────────────────────────────────────── */}
          <Section title="Savi Insight — the glow (D§31, D§65)">
            <Text variant="bodySm" tone="secondary">
              Each card must show exactly ONE drop shadow. Two stacked shadows read as a
              hard grey frame around the card — that is the regression to watch for.
            </Text>
            {INSIGHT_TONES.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </Section>

          {/* ── Type scale ───────────────────────────────────────────── */}
          <Section title="Type scale (A9)">
            {TYPE_NAMES.map((t) => (
              <View key={t} style={{ flexDirection: 'row', alignItems: 'baseline', gap: space[3] }}>
                <Text variant="micro" tone="secondary" style={{ width: 72 }}>
                  {t}
                </Text>
                <Text variant={t}>Savi</Text>
                <Text variant="micro" tone="secondary">
                  {typeScale[t].size}/{typeScale[t].lineHeight}/{typeScale[t].weight}
                </Text>
              </View>
            ))}
          </Section>

          {/* ── Money formatting ─────────────────────────────────────── */}
          <Section title="Money (formatMoney)">
            {[
              ['balance', formatMoney(2450000)],
              ['decimals', formatMoney(169950)],
              ['grouped', formatMoney(123456789)],
              ['income row', formatMoney(3000000, { signDisplay: 'always' })],
              ['expense row', formatMoney(-25000, { signDisplay: 'always' })],
              ['compact', formatMoney(3000000, { compact: true })],
              ['compact M', formatMoney(123456789, { compact: true })],
              ['zero', formatMoney(0)],
            ].map(([label, value]) => (
              <View key={label} style={{ flexDirection: 'row', gap: space[3] }}>
                <Text variant="micro" tone="secondary" style={{ width: 90 }}>
                  {label}
                </Text>
                <Text variant="body" weight="600">
                  {value}
                </Text>
              </View>
            ))}
          </Section>

          {/* ── Inputs ───────────────────────────────────────────────── */}
          <Section title="Inputs (D§36, D§37)">
            <Input label="Description" placeholder="What was it?" hint="Savi will guess the category" />
            <Input label="With error" placeholder="Required" error="Enter a description" />
            <Input label="Disabled" placeholder="Not editable" disabled />
            <Input
              label="Password"
              placeholder="At least 6 characters"
              secureTextEntry
              hint="The eye reveals it — every secureTextEntry field gets one by default"
            />
            <MoneyInput value={amount} onChangeText={setAmount} />
          </Section>

          {/* ── Status + feedback ────────────────────────────────────── */}
          <Section title="Status, skeleton, empty, toast">
            <Row>
              <StatusPill label="On track" tone="income" />
              <StatusPill label="Due soon" tone="bill" />
              <StatusPill label="Overdue" tone="danger" />
            </Row>
            <Text variant="micro" tone="secondary">
              D§44: colour plus a label, never colour alone.
            </Text>

            <Divider />

            <View style={{ gap: space[2] }}>
              <Skeleton width="60%" height={20} />
              <Skeleton width="90%" />
              <Skeleton width="40%" />
            </View>

            <Divider />

            <EmptyState
              title="No bills yet"
              body="Add your recurring bills and Savi will remind you before they're due."
              action={<Button label="Add a bill" onPress={() => {}} />}
            />

            <Button label="Show toast" variant="secondary" onPress={() => setToastVisible(true)} />

            <Divider />

            <Text variant="micro" tone="secondary">
              The milestone surface, not a nicer toast — see Celebration.tsx on when each is
              the right one.
            </Text>
            <Button
              label="Show celebration"
              variant="secondary"
              onPress={() => setCelebrating(true)}
            />
          </Section>

          {/* ── FAB ──────────────────────────────────────────────────── */}
          <Section title="FAB (D§23)">
            <Fab onPress={() => {}}>
              <Text variant="h3" tone="onBrand">
                +
              </Text>
            </Fab>
          </Section>
        </ScrollView>

        <Toast
          visible={toastVisible}
          message="Marked Internet as paid"
          actionLabel="Undo"
          onAction={() => setToastVisible(false)}
          onDismiss={() => setToastVisible(false)}
        />

        <Celebration
          visible={celebrating}
          title="You're all paid up 🎉"
          body="₱1,450.00 was the last of it."
          onDismiss={() => setCelebrating(false)}
        />
      </SafeAreaView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <GlassCard variant="default" padding="lg" style={{ gap: space[3] }}>
      <Text variant="h4">{title}</Text>
      {children}
    </GlassCard>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2], alignItems: 'center' }}>
      {children}
    </View>
  );
}
