// mobile/src/screens/IdManagerScreen.tsx
// Molam ID Management - React Native Mobile App

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Button,
  FlatList,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator
} from 'react-native';
import axios from 'axios';

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

export default function IdManagerScreen() {
  const [me, setMe] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const api = axios.create({
    baseURL: API_BASE,
    headers: {
      Authorization: `Bearer ${global.accessToken}` // Retrieved from secure storage
    }
  });

  const fetchData = async () => {
    try {
      const [meRes, sessionsRes, devicesRes] = await Promise.all([
        api.get('/api/id/me'),
        api.get('/api/id/security/sessions'),
        api.get('/api/id/security/devices')
      ]);

      setMe(meRes.data);
      setSessions(sessionsRes.data.sessions || []);
      setDevices(devicesRes.data.devices || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const revokeSession = async (sessionId: string) => {
    try {
      await api.post(`/api/id/security/sessions/${sessionId}/revoke`);
      fetchData();
    } catch (error) {
      console.error('Error revoking session:', error);
    }
  };

  const revokeDevice = async (deviceId: string) => {
    try {
      await api.post(`/api/id/security/devices/${deviceId}/revoke`);
      fetchData();
    } catch (error) {
      console.error('Error revoking device:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Profile Section */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <Text style={styles.displayName}>{me?.display_name}</Text>
        <Text style={styles.detail}>{me?.email || '—'} | {me?.phone || '—'}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {me?.user_type === 'internal' ? 'Internal' : 'External'}
          </Text>
        </View>
      </View>

      {/* Sessions Section */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Active Sessions ({sessions.length})</Text>
        {sessions.map((session) => (
          <View key={session.id} style={styles.item}>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>
                {session.device_type?.toUpperCase()} - {session.device_id}
              </Text>
              <Text style={styles.itemDetail}>
                {session.ip_address} • {new Date(session.created_at).toLocaleString()}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => revokeSession(session.id)}
              style={styles.revokeButton}
            >
              <Text style={styles.revokeButtonText}>Revoke</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Devices Section */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Devices ({devices.length})</Text>
        {devices.map((device) => (
          <View key={device.id} style={styles.item}>
            <View style={styles.itemContent}>
              <Text style={styles.itemTitle}>
                {device.device_name || device.device_type?.toUpperCase()}
              </Text>
              <Text style={styles.itemDetail}>
                {device.is_trusted ? 'Trusted' : 'Untrusted'} •
                Last seen {new Date(device.last_seen_at).toLocaleString()}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => revokeDevice(device.device_id)}
              style={styles.revokeButton}
            >
              <Text style={styles.revokeButtonText}>Revoke</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f7f9',
    padding: 16
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f6f7f9'
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280'
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12
  },
  displayName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4
  },
  detail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12
  },
  badgeText: {
    fontSize: 12,
    color: '#1e40af',
    fontWeight: '600'
  },
  item: {
    flexDirection: 'row',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    marginVertical: 6
  },
  itemContent: {
    flex: 1
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4
  },
  itemDetail: {
    fontSize: 12,
    color: '#6b7280'
  },
  revokeButton: {
    justifyContent: 'center',
    paddingHorizontal: 12
  },
  revokeButtonText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600'
  }
});
