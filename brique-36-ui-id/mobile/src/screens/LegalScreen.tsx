import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Linking } from 'react-native';

const LEGAL_DOCS = [
  { id: 'cgu', title: 'Conditions Générales d\'Utilisation', icon: '📄' },
  { id: 'privacy', title: 'Politique de Confidentialité', icon: '🔒' },
  { id: 'legal', title: 'Mentions Légales', icon: '⚖️' },
  { id: 'cookies', title: 'Politique des Cookies', icon: '🍪' },
  { id: 'data_protection', title: 'Protection des Données', icon: '🛡️' },
];

export default function LegalScreen() {
  const handleOpenDocument = async (docId: string) => {
    const url = `https://id.molam.sn/legal/${docId}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      Linking.openURL(url);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Documents légaux</Text>
        <Text style={styles.subtitle}>
          Consultez nos politiques et conditions d'utilisation
        </Text>
      </View>

      {LEGAL_DOCS.map((doc) => (
        <TouchableOpacity
          key={doc.id}
          style={styles.docCard}
          onPress={() => handleOpenDocument(doc.id)}
        >
          <Text style={styles.docIcon}>{doc.icon}</Text>
          <View style={styles.docContent}>
            <Text style={styles.docTitle}>{doc.title}</Text>
            <Text style={styles.docAction}>Appuyer pour ouvrir →</Text>
          </View>
        </TouchableOpacity>
      ))}

      <View style={styles.contact}>
        <Text style={styles.contactTitle}>Besoin d'aide ?</Text>
        <Text style={styles.contactText}>
          Contactez-nous à{' '}
          <Text
            style={styles.contactLink}
            onPress={() => Linking.openURL('mailto:legal@molam.sn')}
          >
            legal@molam.sn
          </Text>
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#212529',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6c757d',
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  docIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  docContent: {
    flex: 1,
  },
  docTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 4,
  },
  docAction: {
    fontSize: 14,
    color: '#0066cc',
  },
  contact: {
    margin: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    color: '#6c757d',
  },
  contactLink: {
    color: '#0066cc',
    textDecorationLine: 'underline',
  },
});
