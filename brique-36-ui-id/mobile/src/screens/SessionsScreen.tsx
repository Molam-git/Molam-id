import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function SessionsScreen() {
  const { client } = useAuth();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const data = await client.listMySessions();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (sessionId: string) => {
    Alert.alert(
      'Révoquer la session',
      'Êtes-vous sûr de vouloir révoquer cette session ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Révoquer',
          style: 'destructive',
          onPress: async () => {
            try {
              await client.revokeSession(sessionId);
              Alert.alert('Succès', 'Session révoquée');
              loadSessions();
            } catch (error: any) {
              Alert.alert('Erreur', error.message);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sessions actives</Text>
        <Text style={styles.subtitle}>
          Gérez les appareils connectés à votre compte
        </Text>
      </View>

      {sessions.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Aucune session active</Text>
        </View>
      ) : (
        sessions.map((session) => (
          <View
            key={session.id}
            style={[styles.sessionCard, session.is_current && styles.currentSession]}
          >
            <View style={styles.sessionHeader}>
              <Text style={styles.sessionTitle}>
                {session.channel === 'mobile' ? '📱 Mobile' :
                 session.channel === 'web' ? '🌐 Web' :
                 session.channel === 'ussd' ? '📞 USSD' : session.channel}
              </Text>
              {session.is_current && (
                <View style={styles.currentBadge}>
                  <Text style={styles.currentBadgeText}>Actuelle</Text>
                </View>
              )}
            </View>

            <Text style={styles.sessionDetails}>
              {session.geo_country && `${session.geo_country} • `}
              {new Date(session.last_seen_at).toLocaleDateString('fr-FR')}
            </Text>

            {session.anomalies > 0 && (
              <Text style={styles.anomalyText}>
                ⚠️ {session.anomalies} anomalie(s) détectée(s)
              </Text>
            )}

            {!session.is_current && (
              <TouchableOpacity
                style={styles.revokeButton}
                onPress={() => handleRevoke(session.id)}
              >
                <Text style={styles.revokeButtonText}>Révoquer</Text>
              </TouchableOpacity>
            )}
          </View>
        ))
      )}

      <View style={styles.tips}>
        <Text style={styles.tipsTitle}>Conseils de sécurité</Text>
        <Text style={styles.tipsText}>
          • Révoquez les sessions que vous ne reconnaissez pas{'\n'}
          • Vérifiez régulièrement vos sessions actives{'\n'}
          • Déconnectez-vous des appareils partagés
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
  loadingText: {
    textAlign: 'center',
    padding: 24,
    fontSize: 16,
    color: '#6c757d',
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6c757d',
  },
  sessionCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  currentSession: {
    borderColor: '#0066cc',
    backgroundColor: '#f0f7ff',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212529',
  },
  currentBadge: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  currentBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  sessionDetails: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 8,
  },
  anomalyText: {
    fontSize: 14,
    color: '#ffc107',
    marginBottom: 8,
  },
  revokeButton: {
    backgroundColor: '#dc3545',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  revokeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  tips: {
    margin: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 8,
  },
  tipsText: {
    fontSize: 14,
    color: '#6c757d',
    lineHeight: 22,
  },
});
