// mobile/src/screens/AdminConsoleScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = process.env.API_BASE || 'http://localhost:3001';

interface Employee {
  id: string;
  employee_id: string;
  display_name: string;
  email: string;
  department: string;
  position: string;
  is_active: boolean;
  roles: Array<{ role_name: string }>;
}

interface DepartmentStat {
  department: string;
  active_employees: number;
}

interface AuditLog {
  id: string;
  action: string;
  employee_id?: string;
  department?: string;
  created_at: string;
  context?: Record<string, any>;
}

export default function AdminConsoleScreen() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<DepartmentStat[]>([]);
  const [audit, setAudit] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('');

  const departments = [
    { value: '', label: 'All Departments' },
    { value: 'pay', label: 'Molam Pay' },
    { value: 'eats', label: 'Molam Eats' },
    { value: 'talk', label: 'Molam Talk' },
    { value: 'ads', label: 'Molam Ads' },
    { value: 'shop', label: 'Molam Shop' },
    { value: 'free', label: 'Molam Free' },
    { value: 'id', label: 'Molam ID' },
    { value: 'global', label: 'Global/Corporate' }
  ];

  useEffect(() => {
    fetchData();
  }, [filter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('access_token');
      const api = axios.create({
        baseURL: API_BASE,
        headers: { Authorization: `Bearer ${token}` }
      });

      const params = filter ? { department: filter } : {};
      const [empRes, auditRes, statsRes] = await Promise.all([
        api.get('/api/id/admin/employees', { params }),
        api.get('/api/id/admin/audit', { params: { ...params, limit: 30 } }),
        api.get('/api/id/admin/stats')
      ]);

      setEmployees(empRes.data.employees || []);
      setAudit(auditRes.data.audit || []);
      setStats(statsRes.data.stats || []);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getDepartmentColor = (dept: string): string => {
    const colors: Record<string, string> = {
      pay: '#34D399',
      eats: '#FB923C',
      talk: '#60A5FA',
      shop: '#A78BFA',
      ads: '#FBBF24',
      free: '#F472B6',
      id: '#9CA3AF',
      global: '#818CF8'
    };
    return colors[dept] || '#9CA3AF';
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading admin console...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Molam Admin Console</Text>
        <Text style={styles.subtitle}>Internal employee management</Text>
      </View>

      {/* Department Filter */}
      <View style={styles.filterContainer}>
        <Text style={styles.filterLabel}>Filter by Department:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {departments.map((dept) => (
            <TouchableOpacity
              key={dept.value}
              style={[
                styles.filterButton,
                filter === dept.value && styles.filterButtonActive
              ]}
              onPress={() => setFilter(dept.value)}
            >
              <Text style={[
                styles.filterButtonText,
                filter === dept.value && styles.filterButtonTextActive
              ]}>
                {dept.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Statistics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Department Statistics</Text>
        <View style={styles.statsGrid}>
          {stats.map((stat) => (
            <View key={stat.department} style={styles.statCard}>
              <View style={[styles.statBadge, { backgroundColor: getDepartmentColor(stat.department) }]}>
                <Text style={styles.statBadgeText}>{stat.department.toUpperCase()}</Text>
              </View>
              <Text style={styles.statValue}>{stat.active_employees}</Text>
              <Text style={styles.statLabel}>Active Employees</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Employees */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Employees ({employees.length})</Text>
        {employees.map((emp) => (
          <View key={emp.id} style={styles.employeeCard}>
            <View style={styles.employeeHeader}>
              <Text style={styles.employeeName}>{emp.display_name}</Text>
              <View style={[
                styles.statusBadge,
                { backgroundColor: emp.is_active ? '#D1FAE5' : '#FEE2E2' }
              ]}>
                <Text style={[
                  styles.statusText,
                  { color: emp.is_active ? '#065F46' : '#991B1B' }
                ]}>
                  {emp.is_active ? 'Active' : 'Inactive'}
                </Text>
              </View>
            </View>
            <Text style={styles.employeeEmail}>{emp.email}</Text>
            <View style={styles.employeeDetails}>
              <Text style={styles.employeeDetailLabel}>ID:</Text>
              <Text style={styles.employeeDetailValue}>{emp.employee_id}</Text>
            </View>
            <View style={styles.employeeDetails}>
              <Text style={styles.employeeDetailLabel}>Department:</Text>
              <View style={[styles.deptBadge, { backgroundColor: getDepartmentColor(emp.department) }]}>
                <Text style={styles.deptBadgeText}>{emp.department.toUpperCase()}</Text>
              </View>
            </View>
            <View style={styles.employeeDetails}>
              <Text style={styles.employeeDetailLabel}>Position:</Text>
              <Text style={styles.employeeDetailValue}>{emp.position}</Text>
            </View>
            {emp.roles && emp.roles.length > 0 && (
              <View style={styles.employeeDetails}>
                <Text style={styles.employeeDetailLabel}>Roles:</Text>
                <Text style={styles.employeeDetailValue}>
                  {emp.roles.map(r => r.role_name).join(', ')}
                </Text>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Audit Logs */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Audit Logs</Text>
        {audit.map((log) => (
          <View key={log.id} style={styles.auditCard}>
            <View style={styles.auditHeader}>
              <Text style={styles.auditAction}>{log.action}</Text>
              <Text style={styles.auditTime}>
                {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString()}
              </Text>
            </View>
            {log.employee_id && (
              <Text style={styles.auditDetail}>by {log.employee_id}</Text>
            )}
            {log.department && (
              <View style={[styles.auditDeptBadge, { backgroundColor: getDepartmentColor(log.department) }]}>
                <Text style={styles.auditDeptText}>{log.department}</Text>
              </View>
            )}
            {log.context && Object.keys(log.context).length > 0 && (
              <Text style={styles.auditContext}>{JSON.stringify(log.context)}</Text>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB'
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB'
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280'
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB'
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827'
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4
  },
  filterContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    marginTop: 8
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8
  },
  filterScroll: {
    flexDirection: 'row'
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 8
  },
  filterButtonActive: {
    backgroundColor: '#3B82F6'
  },
  filterButtonText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500'
  },
  filterButtonTextActive: {
    color: '#FFFFFF'
  },
  section: {
    padding: 16,
    marginTop: 8
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    margin: '1%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  statBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8
  },
  statBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold'
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827'
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2
  },
  employeeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  },
  employeeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  employeeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827'
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600'
  },
  employeeEmail: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8
  },
  employeeDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4
  },
  employeeDetailLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginRight: 8,
    width: 80
  },
  employeeDetailValue: {
    fontSize: 13,
    color: '#111827',
    flex: 1
  },
  deptBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12
  },
  deptBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold'
  },
  auditCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6'
  },
  auditHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  auditAction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1
  },
  auditTime: {
    fontSize: 11,
    color: '#9CA3AF'
  },
  auditDetail: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2
  },
  auditDeptBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4
  },
  auditDeptText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold'
  },
  auditContext: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
    fontFamily: 'monospace'
  }
});
