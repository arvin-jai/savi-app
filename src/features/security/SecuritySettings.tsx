/**
 * The Settings pane for the screen lock. Replaces the "Security & PIN — Not yet"
 * placeholder that stood in for it.
 *
 * Reads its state from the keychain on mount rather than from `LockProvider`,
 * and writes back through `refresh()`. The provider is the authority on whether
 * the app is *currently* locked; the keychain is the authority on what is
 * configured, and this screen edits the latter.
 */

import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { GlassSheet } from '@/components/glass/GlassSheet';
import { Button } from '@/components/ui/Button';
import { Divider } from '@/components/ui/feedback';
import { Text } from '@/components/ui/Text';
import { space } from '@/theme/tokens';

import { useLock } from './LockProvider';
import { SetPin } from './SetPin';
import {
  biometricLabel,
  clearPin,
  hasPin,
  isBiometricAvailable,
  isBiometricEnabled,
  isLockSupported,
  promptBiometric,
  setBiometricEnabled,
} from './store';

/** Everything this pane reads out of the keychain, in one round trip. */
type LockState = {
  pinOn: boolean;
  bioOn: boolean;
  bioAvailable: boolean;
  label: string;
};

const UNREAD: LockState = {
  pinOn: false,
  bioOn: false,
  bioAvailable: false,
  label: 'biometrics',
};

async function readLockState(): Promise<LockState> {
  const [pinOn, bioOn, bioAvailable, label] = await Promise.all([
    hasPin(),
    isBiometricEnabled(),
    isBiometricAvailable(),
    biometricLabel(),
  ]);
  return { pinOn, bioOn, bioAvailable, label };
}

export function SecuritySettings() {
  const { refresh, lockNow } = useLock();

  const [{ pinOn, bioOn, bioAvailable, label }, setState] = useState<LockState>(UNREAD);
  const [busy, setBusy] = useState(false);
  // Bumped after any write, to re-read the keychain rather than guessing what
  // it now holds.
  const [reloadKey, setReloadKey] = useState(0);

  const [settingPin, setSettingPin] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // The guard matters: every path here can navigate away (a sheet closes and
  // the screen pops) while the keychain read is still outstanding, and setting
  // state on an unmounted component is a warning at best and a leak at worst.
  useEffect(() => {
    let active = true;
    readLockState().then((s) => {
      if (active) setState(s);
    });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  if (!isLockSupported()) {
    return (
      <Text variant="caption" tone="secondary">
        A screen lock needs the phone&apos;s keychain, so it is only available in the Savi app —
        not on the web. Your data is protected by your account either way.
      </Text>
    );
  }

  async function toggleBiometric() {
    setBusy(true);
    try {
      if (bioOn) {
        await setBiometricEnabled(false);
      } else if (await promptBiometric(`Use ${label} to unlock Savi`)) {
        // Proven before recorded — see SetPin for why this order matters.
        await setBiometricEnabled(true);
      }
      reload();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removePin() {
    setBusy(true);
    try {
      await clearPin();
      reload();
      await refresh();
      setConfirmRemove(false);
    } finally {
      setBusy(false);
    }
  }

  async function afterSet() {
    setSettingPin(false);
    reload();
    await refresh();
  }

  return (
    <View style={{ gap: space[3] }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="body">PIN lock</Text>
        <Text variant="bodySm" tone={pinOn ? 'income' : 'secondary'}>
          {pinOn ? 'On' : 'Off'}
        </Text>
      </View>

      <Text variant="caption" tone="secondary">
        Savi asks for your PIN when you open it, and again if it has been in the background for
        more than 30 seconds. It locks this app on this phone — your data lives in your account,
        so forgetting the PIN costs you a sign-in, not your records.
      </Text>

      {pinOn ? (
        <>
          <View style={{ flexDirection: 'row', gap: space[2], flexWrap: 'wrap' }}>
            <Button label="Change PIN" size="sm" variant="secondary" onPress={() => setSettingPin(true)} />
            <Button label="Lock now" size="sm" variant="secondary" onPress={lockNow} />
            <Button label="Turn off" size="sm" variant="ghost" onPress={() => setConfirmRemove(true)} />
          </View>

          <Divider />

          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <View style={{ flex: 1, minWidth: 0, paddingRight: space[3] }}>
              <Text variant="body">Unlock with {label}</Text>
              <Text variant="caption" tone="secondary">
                {bioAvailable
                  ? 'Your PIN stays as the backup.'
                  : `This phone has no ${label} set up yet — add one in your phone's settings first.`}
              </Text>
            </View>
            <Button
              label={bioOn ? 'On' : 'Off'}
              size="sm"
              variant={bioOn ? 'primary' : 'secondary'}
              disabled={!bioAvailable || busy}
              onPress={toggleBiometric}
            />
          </View>
        </>
      ) : (
        <Button label="Set up a PIN" size="sm" onPress={() => setSettingPin(true)} />
      )}

      <GlassSheet
        visible={settingPin}
        onClose={() => setSettingPin(false)}
        title={pinOn ? 'Change your PIN' : 'Set up a PIN'}
      >
        <SetPin onDone={afterSet} onCancel={() => setSettingPin(false)} />
      </GlassSheet>

      {/* D§59: turning off a lock is destructive enough to confirm. It cannot
          be undone by an undo toast — the digest is gone. */}
      <GlassSheet
        visible={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        title="Turn off the PIN?"
        footer={
          <Button label="Turn off" variant="danger" block loading={busy} onPress={removePin} />
        }
      >
        <Text variant="body" tone="secondary">
          Savi will open straight to your dashboard, and anyone holding this phone unlocked can
          see your money. {bioOn ? `${label} unlock turns off with it.` : ''}
        </Text>
      </GlassSheet>
    </View>
  );
}
