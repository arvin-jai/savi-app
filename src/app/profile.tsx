/**
 * Profile — reached by tapping your own card at the top of More.
 *
 * This used to be the first section of Settings, and having it in both places
 * meant two routes to one form. The card is where a person looks for their own
 * name, so the form moved to the card and Settings kept the things you change
 * *about the app* rather than about yourself.
 */

import { useState } from 'react';
import { View } from 'react-native';

import { PageShell } from '@/components/PageShell';
import { GlassCard } from '@/components/glass/GlassCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/feedback';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile } from '@/features/insights/api';
import { hapticError, hapticSuccess } from '@/lib/haptics';
import { qk } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { brandRole, radius, space } from '@/theme/tokens';

export default function Profile() {
  const qc = useQueryClient();
  const { user, signOut } = useAuth();
  const { data: profile } = useProfile();

  const serverName = profile?.display_name ?? '';

  const [displayName, setDisplayName] = useState(serverName);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  /**
   * Re-seed the field when the server value changes, adjusting state during
   * render rather than in an effect.
   *
   * It has to re-seed at all because `useProfile` is usually still in flight
   * when this mounts — `useState(serverName)` alone would pin the field to the
   * empty string it saw on the first render and the user would open their own
   * profile to a blank name. The effect version of this renders that blank
   * frame first and then corrects it; this one never shows it.
   */
  const [lastServerName, setLastServerName] = useState(serverName);
  if (serverName !== lastServerName) {
    setLastServerName(serverName);
    setDisplayName(serverName);
  }

  const initial = (profile?.display_name?.trim() || user?.email || '?').charAt(0).toUpperCase();
  const dirty = displayName.trim() !== serverName.trim();

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() || null })
      .eq('id', user.id);
    setSaving(false);

    if (error) {
      hapticError();
      setToast('Could not save that');
      return;
    }

    // The dashboard greeting and the More card both read this — without the
    // invalidation the name changes here and nowhere else until a cold start.
    await qc.invalidateQueries({ queryKey: qk.profile });
    hapticSuccess();
    setToast('Name updated');
  }

  return (
    <>
      <PageShell>
        <ScreenHeader title="Profile" />

        <GlassCard padding="lg" style={{ alignItems: 'center', gap: space[3] }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: radius.full,
              backgroundColor: brandRole.action,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text variant="h2" tone="onBrand">
              {initial}
            </Text>
          </View>
          <Text variant="bodySm" tone="secondary">
            {user?.email}
          </Text>
        </GlassCard>

        <GlassCard padding="lg" style={{ gap: space[3] }}>
          <Input
            label="Name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="What should Savi call you?"
            autoComplete="name"
            hint="Savi uses this to greet you on the dashboard."
          />
          <Button label="Save" size="sm" loading={saving} disabled={!dirty || saving} onPress={save} />
        </GlassCard>

        <GlassCard padding="lg" style={{ gap: space[3] }}>
          <Text variant="label" tone="secondary">
            Sign in
          </Text>
          <Text variant="caption" tone="secondary">
            Your email is how you sign in and how a password reset reaches you. Changing it
            isn&apos;t supported yet — it needs confirming on both addresses to be safe.
          </Text>
          <Button label="Sign out" variant="ghost" block onPress={signOut} />
        </GlassCard>
      </PageShell>

      <Toast visible={!!toast} message={toast ?? ''} onDismiss={() => setToast(null)} />
    </>
  );
}
