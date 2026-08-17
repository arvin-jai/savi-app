/**
 * Settings (D§67).
 *
 * v0.1 covers Profile, Appearance, Currency, Data, and About. Notifications
 * arrive with v0.3 and Security with account management — both are listed as
 * unavailable rather than hidden, so the shape of the app is honest.
 */

import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/AmbientBackground';
import { GlassCard } from '@/components/glass/GlassCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Divider, Toast } from '@/components/ui/feedback';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { useAccounts } from '@/features/accounts/api';
import { AiSettings } from '@/features/ai/AiSettings';
import { useAuth } from '@/features/auth/AuthProvider';
import { useBills } from '@/features/bills/api';
import { useProfile } from '@/features/insights/api';
import { NotificationSettings } from '@/features/notifications/NotificationSettings';
import { SecuritySettings } from '@/features/security/SecuritySettings';
import { useTransactions } from '@/features/transactions/api';
import { useTheme, type ThemePreference } from '@/theme/ThemeProvider';
import { layout, space } from '@/theme/tokens';
import { useBreakpoint, useScrollBottomInset } from '@/theme/useBreakpoint';

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export default function Settings() {
  const { pagePadding } = useBreakpoint();
  const bottomInset = useScrollBottomInset();
  const theme = useTheme();
  const { signOut } = useAuth();
  const { data: profile } = useProfile();
  const { data: accounts = [] } = useAccounts();
  const { data: bills = [] } = useBills();
  const { data: transactions = [] } = useTransactions();

  const [toast, setToast] = useState<string | null>(null);

  return (
    <View style={{ flex: 1 }}>
      <AmbientBackground />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={{
            padding: pagePadding,
            gap: space[5],
            paddingBottom: bottomInset,
            width: '100%',
            maxWidth: layout.maxContentWidth,
            alignSelf: 'center',
          }}
        >
          <ScreenHeader title="Settings" />

          {/* Profile lived here and no longer does. It is reached by tapping
              your own card at the top of More, which is where a person looks
              for their own name — having it in both places meant two routes to
              one form and a Settings screen that opened on something most
              people never change. */}

          {/* ── Appearance ──────────────────────────────────────────── */}
          <Section title="Appearance">
            <View style={{ flexDirection: 'row', gap: space[2] }}>
              {THEME_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  label={opt.label}
                  size="sm"
                  variant={theme.preference === opt.value ? 'primary' : 'secondary'}
                  onPress={() => theme.setPreference(opt.value)}
                />
              ))}
            </View>
            <Text variant="caption" tone="secondary">
              Dark mode is a first-class design in Savi, not an inversion — every colour is
              chosen for the theme it appears in.
            </Text>
          </Section>

          {/* ── Currency ────────────────────────────────────────────── */}
          <Section title="Currency">
            <Text variant="body">{profile?.currency ?? 'PHP'} — Philippine peso (₱)</Text>
            <Text variant="caption" tone="secondary">
              Savi is single-currency for now. Supporting more needs exchange rates and a
              chosen display currency, otherwise your available money can&apos;t be added up
              correctly.
            </Text>
          </Section>

          {/* ── Data ────────────────────────────────────────────────── */}
          <Section title="Your data">
            <Row label="Accounts" value={String(accounts.length)} />
            <Divider />
            <Row label="Bills" value={String(bills.length)} />
            <Divider />
            <Row label="Transactions" value={String(transactions.length)} />
            <Text variant="caption" tone="secondary">
              Your financial data is stored in your own account and is only readable by you.
            </Text>
          </Section>

          {/* ── Notifications (P§26) ────────────────────────────────── */}
          <Section title="Notifications">
            <NotificationSettings />
          </Section>

          {/* ── Ask Savi (AI-BOUNDARY §3, §4) ───────────────────────── */}
          <Section title="Ask Savi">
            <AiSettings />
          </Section>

          {/* ── Screen lock ─────────────────────────────────────────── */}
          <Section title="Security">
            <SecuritySettings />
          </Section>

          {/* ── Not yet ─────────────────────────────────────────────── */}
          <Section title="Coming later">
            <Row label="Export data" value="Not yet" muted />
          </Section>

          {/* ── About ───────────────────────────────────────────────── */}
          <Section title="About Savi">
            <Text variant="body" weight="500">
              Spend smarter. Plan easier. Live better.
            </Text>
            <Text variant="caption" tone="secondary">
              Savi v0.6 — money, calendar, tasks, reminders, budgets, goals, and Ask Savi.
            </Text>
          </Section>

          <Button label="Sign out" variant="ghost" block onPress={signOut} />
        </ScrollView>
      </SafeAreaView>

      <Toast visible={!!toast} message={toast ?? ''} onDismiss={() => setToast(null)} />
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space[2] }}>
      <Text variant="label" tone="secondary">
        {title}
      </Text>
      <GlassCard padding="lg" style={{ gap: space[3] }}>
        {children}
      </GlassCard>
    </View>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text variant="body" tone={muted ? 'secondary' : 'primary'}>
        {label}
      </Text>
      <Text variant="bodySm" tone="secondary">
        {value}
      </Text>
    </View>
  );
}
