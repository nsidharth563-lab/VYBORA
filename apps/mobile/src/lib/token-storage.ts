import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'vybora.refreshToken.v1';

/**
 * The refresh token is the long-lived credential, so on iOS/Android it lives
 * in the Keychain / Android Keystore (expo-secure-store), never AsyncStorage.
 * Access tokens are kept in memory only.
 *
 * Web (development preview only) has no secure enclave; it falls back to
 * browser storage. A production web client will use httpOnly cookies instead.
 */
export const tokenStorage = {
  async get(): Promise<string | null> {
    if (Platform.OS === 'web') return AsyncStorage.getItem(KEY);
    return SecureStore.getItemAsync(KEY);
  },
  async set(token: string): Promise<void> {
    if (Platform.OS === 'web') return AsyncStorage.setItem(KEY, token);
    await SecureStore.setItemAsync(KEY, token, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY });
  },
  async clear(): Promise<void> {
    if (Platform.OS === 'web') return AsyncStorage.removeItem(KEY);
    await SecureStore.deleteItemAsync(KEY);
  },
};
