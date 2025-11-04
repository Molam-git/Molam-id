/**
 * Storage abstraction pour React Native Web
 * Utilise AsyncStorage sur mobile et localStorage sur web
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

class StorageAdapter {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      // Web: utiliser localStorage
      return localStorage.getItem(key);
    } else {
      // Mobile: utiliser AsyncStorage
      return await AsyncStorage.getItem(key);
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      // Web: utiliser localStorage
      localStorage.setItem(key, value);
    } else {
      // Mobile: utiliser AsyncStorage
      await AsyncStorage.setItem(key, value);
    }
  }

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      // Web: utiliser localStorage
      localStorage.removeItem(key);
    } else {
      // Mobile: utiliser AsyncStorage
      await AsyncStorage.removeItem(key);
    }
  }
}

export const storage = new StorageAdapter();
