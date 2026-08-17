/**
 * Screen-lock persistence — the I/O half of `pin.ts`.
 *
 * Everything here talks to the platform keychain (`expo-secure-store`), never
 * to `AsyncStorage`. That is not paranoia about the digest: it is that
 * AsyncStorage on Android is a world-readable-by-the-app SQLite file with no
 * hardware backing, and a value that decides whether the app opens belongs
 * behind the same door as a credential even when it is not one.
 *
 * **Web has no keychain.** `expo-secure-store` is unavailable there, so the
 * lock is simply off on web — reported honestly by `isLockSupported()` rather
 * than half-working. The web build already runs behind a browser session on a
 * machine the user is sitting at; a JS-side lock there would be theatre.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { digestStringAsync, CryptoDigestAlgorithm, randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';

const KEY_HASH = 'savi.lock.pinHash';
const KEY_SALT = 'savi.lock.pinSalt';
const KEY_BIOMETRIC = 'savi.lock.biometric';

/** The keychain only exists on the two native platforms. */
export function isLockSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

async function hash(pin: string, salt: string): Promise<string> {
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

export async function hasPin(): Promise<boolean> {
  if (!isLockSupported()) return false;
  return (await SecureStore.getItemAsync(KEY_HASH)) !== null;
}

/**
 * Store a PIN. The salt is generated per PIN, so re-setting the same digits
 * produces a different digest and two users' identical PINs never collide.
 */
export async function setPin(pin: string): Promise<void> {
  if (!isLockSupported()) return;
  const salt = randomUUID();
  await SecureStore.setItemAsync(KEY_SALT, salt);
  await SecureStore.setItemAsync(KEY_HASH, await hash(pin, salt));
}

export async function verifyPin(pin: string): Promise<boolean> {
  if (!isLockSupported()) return true;

  const [stored, salt] = await Promise.all([
    SecureStore.getItemAsync(KEY_HASH),
    SecureStore.getItemAsync(KEY_SALT),
  ]);
  // No PIN set means nothing to fail against. The caller should not have asked,
  // but returning false here would lock a user out of an unlocked app.
  if (!stored || !salt) return true;

  return (await hash(pin, salt)) === stored;
}

/** Removes the PIN and the biometric preference with it — see below. */
export async function clearPin(): Promise<void> {
  if (!isLockSupported()) return;
  await SecureStore.deleteItemAsync(KEY_HASH);
  await SecureStore.deleteItemAsync(KEY_SALT);
  await SecureStore.deleteItemAsync(KEY_BIOMETRIC);
}

/**
 * Whether the device can do biometrics *and* the user has actually enrolled a
 * face or finger.
 *
 * Both halves are needed. `hasHardwareAsync` alone is the mistake that ships an
 * "Unlock with fingerprint" button on a phone with a sensor and no fingerprint
 * saved, which then fails every time with a message about device settings —
 * the M9 permission bug in a different costume.
 */
export async function isBiometricAvailable(): Promise<boolean> {
  if (!isLockSupported()) return false;
  try {
    const [hardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hardware && enrolled;
  } catch {
    return false;
  }
}

/** What the device actually offers, for copy that says "Face ID" not "biometrics". */
export async function biometricLabel(): Promise<string> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return Platform.OS === 'ios' ? 'Face ID' : 'face unlock';
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return Platform.OS === 'ios' ? 'Touch ID' : 'your fingerprint';
    }
  } catch {
    // fall through
  }
  return 'biometrics';
}

/**
 * Biometrics is a preference *on top of* a PIN, never instead of one.
 *
 * A face or finger can fail for reasons the user cannot fix in the moment —
 * wet hands, a mask, a sensor that has decided today is not the day. Without a
 * PIN behind it the only recovery is signing out, which on this app means
 * re-authenticating against Supabase to read your own bills. So `setPin` is a
 * precondition, and `clearPin` takes this with it.
 */
export async function isBiometricEnabled(): Promise<boolean> {
  if (!isLockSupported()) return false;
  return (await SecureStore.getItemAsync(KEY_BIOMETRIC)) === 'true';
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  if (!isLockSupported()) return;
  if (enabled) await SecureStore.setItemAsync(KEY_BIOMETRIC, 'true');
  else await SecureStore.deleteItemAsync(KEY_BIOMETRIC);
}

/**
 * Prompt for a face/finger. Resolves false on cancel, failure, or anything
 * thrown — a biometric prompt that explodes must fall back to the PIN pad,
 * never leave the user staring at a spinner.
 */
export async function promptBiometric(reason = 'Unlock Savi'): Promise<boolean> {
  if (!isLockSupported()) return false;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      // Savi's own PIN pad is the fallback, not the system passcode sheet —
      // one recovery path the user has already been taught, not two.
      disableDeviceFallback: true,
      cancelLabel: 'Use PIN',
    });
    return result.success;
  } catch {
    return false;
  }
}
