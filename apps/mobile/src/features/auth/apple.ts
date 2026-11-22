import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { authApi } from '@/lib/auth-api';

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

/**
 * Native Sign in with Apple. A random nonce is generated per attempt; Apple
 * embeds its SHA-256 in the identity token and the API checks it, so a token
 * captured from another attempt can't be replayed.
 * Returns null if the user cancelled.
 */
export async function signInWithApple() {
  const rawNonce = Crypto.randomUUID() + Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  try {
    const cred = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashed,
    });
    if (!cred.identityToken) throw new Error('Apple did not return an identity token');
    const fullName = cred.fullName ? AppleAuthentication.formatFullName(cred.fullName) : undefined;
    return authApi.apple(cred.identityToken, rawNonce, fullName || undefined);
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
    throw e;
  }
}
