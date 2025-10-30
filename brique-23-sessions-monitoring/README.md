# Brique 23 — Monitoring des sessions actives

**Molam ID - Real-time Session Monitoring with Anomaly Detection**

Version: 1.0.0

## Overview

Brique 23 provides comprehensive session monitoring and management with Apple-like UX:

- **Real-time tracking** - Monitor active sessions across all devices (iOS, Android, Web, Desktop, USSD, API)
- **Anomaly detection** - Detect suspicious patterns (multi-country, excessive sessions)
- **User control** - "My Connected Devices" screen with one-click disconnect
- **Admin tools** - Bulk session termination and monitoring
- **SIRA integration** - Security alerts for suspicious activities

## Features

### 🔍 Session Tracking

Track sessions with rich metadata:
- Device type, OS version, app version
- IP address, geolocation (country, city)
- User agent, last activity timestamp
- Risk score (0-100)

### 🚨 Anomaly Detection

Automatic detection of:
- **Excessive sessions** - More than 5 active sessions → High severity
- **Multi-country** - 3+ countries in 10 minutes → Critical severity
- **Unknown devices** - First-time device access
- **Suspicious patterns** - Rapid IP changes, unusual activity

### 👤 User Experience (Apple-like)

Simple, clear interface:
```
Mes appareils connectés

📱 iPhone 14 Pro
   Paris, France
   Actif il y a 2 min
   [Déconnexion]

💻 Chrome (Mac)
   Dakar, Senegal
   Actif il y a 15 min
   [Déconnexion]
```

### 👨‍💼 Admin Controls

- List all sessions by user/tenant/module
- Bulk termination (by user, tenant, module, or all)
- Session analytics and monitoring
- Audit trail of all terminations

## API Reference

### Base URL
```
https://api.molam.id/v1
```

### User Endpoints

#### List My Sessions
**GET** `/sessions/active`

**Response**:
```json
{
  "sessions": [
    {
      "id": "...",
      "device_type": "ios",
      "os_version": "17.2",
      "ip_address": "41.82.123.45",
      "geo_country": "SN",
      "geo_city": "Dakar",
      "last_seen": "2025-01-15T10:30:00Z",
      "created_at": "2025-01-14T08:00:00Z"
    }
  ],
  "count": 2
}
```

#### Terminate Session
**POST** `/sessions/:id/terminate`

**Response**:
```json
{
  "status": "terminated",
  "session_id": "..."
}
```

### Admin Endpoints

#### List User Sessions
**GET** `/admin/sessions?user_id=<uuid>`

Requires: `id.admin.session.read`

#### Bulk Terminate
**POST** `/admin/sessions/terminate`

Requires: `id.admin.session.terminate`

**Body**:
```json
{
  "user_id": "...",
  "tenant_id": "...",
  "module_scope": "pay",
  "all": false
}
```

## Database Schema

### molam_sessions_active
```sql
CREATE TABLE molam_sessions_active (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  module_scope TEXT NOT NULL,
  device_id TEXT NOT NULL,
  device_type TEXT NOT NULL,
  os_version TEXT,
  app_version TEXT,
  ip_address INET NOT NULL,
  geo_country TEXT,
  geo_city TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  terminated_reason TEXT,
  risk_score SMALLINT DEFAULT 0
);
```

### molam_session_anomalies
```sql
CREATE TABLE molam_session_anomalies (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL,
  user_id UUID NOT NULL,
  anomaly_type TEXT NOT NULL,
  details JSONB NOT NULL,
  severity TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Installation

```bash
cd brique-23-sessions-monitoring
npm install
npm run build
npm run structure-test
npm start
```

## Device Types

- **ios** - iPhone, iPad
- **android** - Android phones, tablets
- **web** - Browser sessions
- **desktop** - Desktop apps (Windows, Mac, Linux)
- **ussd** - USSD sessions
- **api** - API/machine-to-machine

## Anomaly Types

| Type | Description | Severity |
|------|-------------|----------|
| `excessive_sessions` | More than 5 active sessions | High |
| `multi_country` | 3+ countries in 10 minutes | Critical |
| `unknown_device` | First-time device | Medium |
| `rapid_ip_change` | IP changes too frequently | High |

## Security

- **JWT authentication** required
- **Device fingerprinting** for tracking
- **Permission-based access**:
  - Users: own sessions only
  - Admins: tenant sessions
  - Superadmins: all sessions
- **Audit trail** for all terminations
- **SIRA integration** for alerts

## Examples

### List My Sessions (User)
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://api.molam.id/v1/sessions/active
```

### Disconnect Device (User)
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  https://api.molam.id/v1/sessions/$SESSION_ID/terminate
```

### Admin: Terminate All User Sessions
```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<uuid>"}' \
  https://api.molam.id/v1/admin/sessions/terminate
```

## Observability

### Prometheus Metrics
```
id_sessions_active_total{tenant,module}
id_sessions_terminated_total{reason}
id_sessions_anomalies_detected_total{pattern}
```

## License

Proprietary - Molam Corporation
