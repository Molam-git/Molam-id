import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function SignupScreen({ navigation }: any) {
  const { signup } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSignup = async () => {
    // Validation
    if (!formData.firstName || !formData.lastName || !formData.phone || !formData.password) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    if (formData.password.length < 8) {
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    setLoading(true);
    try {
      await signup({
        phone: formData.phone,
        email: formData.email || undefined,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
      });
      // Navigation automatique via AuthContext
    } catch (error: any) {
      Alert.alert('Erreur d\'inscription', error.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Créer un compte</Text>
            <Text style={styles.subtitle}>
              Rejoignez l'écosystème Molam
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Name Row */}
            <View style={styles.row}>
              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={styles.label}>Prénom *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Votre prénom"
                  placeholderTextColor="#6c757d"
                  value={formData.firstName}
                  onChangeText={(value) => handleChange('firstName', value)}
                  autoComplete="name-given"
                />
              </View>

              <View style={[styles.formGroup, styles.halfWidth]}>
                <Text style={styles.label}>Nom *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Votre nom"
                  placeholderTextColor="#6c757d"
                  value={formData.lastName}
                  onChangeText={(value) => handleChange('lastName', value)}
                  autoComplete="name-family"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Numéro de téléphone *</Text>
              <TextInput
                style={styles.input}
                placeholder="+221 XX XXX XX XX"
                placeholderTextColor="#6c757d"
                value={formData.phone}
                onChangeText={(value) => handleChange('phone', value)}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Email (optionnel)</Text>
              <TextInput
                style={styles.input}
                placeholder="email@example.com"
                placeholderTextColor="#6c757d"
                value={formData.email}
                onChangeText={(value) => handleChange('email', value)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Mot de passe *</Text>
              <TextInput
                style={styles.input}
                placeholder="Minimum 8 caractères"
                placeholderTextColor="#6c757d"
                value={formData.password}
                onChangeText={(value) => handleChange('password', value)}
                secureTextEntry
                autoComplete="password-new"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Confirmer le mot de passe *</Text>
              <TextInput
                style={styles.input}
                placeholder="Répétez le mot de passe"
                placeholderTextColor="#6c757d"
                value={formData.confirmPassword}
                onChangeText={(value) => handleChange('confirmPassword', value)}
                secureTextEntry
                autoComplete="password-new"
              />
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Créer mon compte</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Déjà un compte ?{' '}
              <Text
                style={styles.link}
                onPress={() => navigation.navigate('Login')}
              >
                Se connecter
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingVertical: 32,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#212529',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6c757d',
    textAlign: 'center',
  },
  form: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  formGroup: {
    marginBottom: 16,
  },
  halfWidth: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#212529',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dee2e6',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    color: '#212529',
  },
  button: {
    backgroundColor: '#0066cc',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#dee2e6',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#6c757d',
  },
  link: {
    color: '#0066cc',
    fontWeight: '500',
  },
});
