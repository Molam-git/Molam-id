// mobile/src/HomeScreen.tsx
// React Native home screen with multilingual support

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal
} from 'react-native';
import { useI18n } from './I18nProvider';
import type { Language } from '../../sdk/molam-i18n';

export default function HomeScreen() {
  const { t, lang, changeLanguage, isLoading, dir } = useI18n();
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  const languages: Array<{ code: Language; label: string }> = [
    { code: 'fr', label: 'Français' },
    { code: 'en', label: 'English' },
    { code: 'wo', label: 'Wolof' },
    { code: 'ar', label: 'العربية' },
    { code: 'es', label: 'Español' }
  ];

  const modules = [
    { key: 'pay', color: '#10B981' },
    { key: 'eats', color: '#F97316' },
    { key: 'shop', color: '#A855F7' },
    { key: 'talk', color: '#3B82F6' },
    { key: 'ads', color: '#EAB308' },
    { key: 'free', color: '#EC4899' }
  ];

  const handleLanguageChange = async (newLang: Language) => {
    setShowLanguagePicker(false);
    await changeLanguage(newLang);
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { direction: dir }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Language Switcher Button */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.languageButton}
          onPress={() => setShowLanguagePicker(true)}
        >
          <Text style={styles.languageButtonText}>
            {languages.find((l) => l.code === lang)?.label} ▼
          </Text>
        </TouchableOpacity>
      </View>

      {/* Logo */}
      <View style={styles.logoContainer}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>M</Text>
        </View>
      </View>

      {/* Welcome Title */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{t('home.welcome')}</Text>
        <Text style={styles.subtitle}>{t('home.tagline')}</Text>
      </View>

      {/* Modules Grid */}
      <View style={styles.modulesGrid}>
        {modules.map((module) => (
          <TouchableOpacity
            key={module.key}
            style={[styles.moduleCard, { backgroundColor: module.color }]}
            activeOpacity={0.8}
          >
            <Text style={styles.moduleText}>{t(`modules.${module.key}`)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Auth Buttons */}
      <View style={styles.authContainer}>
        <TouchableOpacity style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>{t('auth.login.submit')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>{t('auth.signup.title')}</Text>
        </TouchableOpacity>
      </View>

      {/* Forgot Password */}
      <TouchableOpacity style={styles.forgotPassword}>
        <Text style={styles.forgotPasswordText}>{t('auth.forgot_password')}</Text>
      </TouchableOpacity>

      {/* Language Picker Modal */}
      <Modal
        visible={showLanguagePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLanguagePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('settings.language')}</Text>
              <TouchableOpacity
                onPress={() => setShowLanguagePicker(false)}
                style={styles.modalClose}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {languages.map((language) => (
              <TouchableOpacity
                key={language.code}
                style={[
                  styles.languageOption,
                  lang === language.code && styles.languageOptionActive
                ]}
                onPress={() => handleLanguageChange(language.code)}
              >
                <Text
                  style={[
                    styles.languageOptionText,
                    lang === language.code && styles.languageOptionTextActive
                  ]}
                >
                  {language.label}
                </Text>
                {lang === language.code && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#064E3B'
  },
  contentContainer: {
    padding: 20,
    alignItems: 'center'
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#064E3B'
  },
  loadingText: {
    marginTop: 16,
    color: '#FFFFFF',
    fontSize: 16
  },
  header: {
    width: '100%',
    alignItems: 'flex-end',
    marginBottom: 20
  },
  languageButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)'
  },
  languageButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600'
  },
  logoContainer: {
    marginVertical: 32
  },
  logo: {
    width: 96,
    height: 96,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)'
  },
  logoText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF'
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 32
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 18,
    color: '#D1FAE5',
    textAlign: 'center'
  },
  modulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 32
  },
  moduleCard: {
    width: '45%',
    aspectRatio: 1.5,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5
  },
  moduleText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold'
  },
  authContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 16
  },
  primaryButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3
  },
  primaryButtonText: {
    color: '#064E3B',
    fontSize: 16,
    fontWeight: '600'
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)'
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600'
  },
  forgotPassword: {
    padding: 12
  },
  forgotPasswordText: {
    color: '#D1FAE5',
    textDecorationLine: 'underline'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '70%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827'
  },
  modalClose: {
    padding: 4
  },
  modalCloseText: {
    fontSize: 24,
    color: '#6B7280'
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8
  },
  languageOptionActive: {
    backgroundColor: '#D1FAE5'
  },
  languageOptionText: {
    fontSize: 16,
    color: '#374151'
  },
  languageOptionTextActive: {
    fontWeight: '600',
    color: '#065F46'
  },
  checkmark: {
    fontSize: 20,
    color: '#10B981',
    fontWeight: 'bold'
  }
});
