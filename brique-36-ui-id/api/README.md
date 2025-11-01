# Brique 36 - UI ID API

Backend API for Molam ID UI, serving legal documents and UI configuration.

## Features

- ✅ Versioned legal documents (CGU, Privacy Policy, Legal Notice, etc.)
- ✅ Multi-language support (FR, EN, WO, AR, ES, PT)
- ✅ Plain text and HTML content
- ✅ RESTful API
- ✅ Health checks
- ✅ Prometheus metrics

## Installation

```bash
npm install
```

## Configuration

Create `.env` file:

```env
PORT=3036
DATABASE_URL=postgresql://molam:molam_pass@localhost:5432/molam
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
NODE_ENV=development
```

## Running

```bash
# Development
npm run dev

# Production
npm start

# Build
npm run build
```

## API Endpoints

### Legal Documents

**Get latest version:**
```
GET /api/legal/:type/:lang
```

Example:
```bash
curl http://localhost:3036/api/legal/cgu/fr
```

**Get specific version:**
```
GET /api/legal/:type/:lang/:version
```

**List versions:**
```
GET /api/legal/:type/:lang/versions
```

**List document types:**
```
GET /api/legal/types
```

**List languages:**
```
GET /api/legal/languages
```

### Health & Metrics

- `GET /health` - Detailed health check
- `GET /healthz` - Simple health check
- `GET /livez` - Liveness probe
- `GET /metrics` - Prometheus metrics

## Document Types

- `cgu` - Terms and Conditions (CGU)
- `privacy` - Privacy Policy
- `legal` - Legal Notice
- `cookies` - Cookies Policy
- `data_protection` - Data Protection

## Supported Languages

- `fr` - Français
- `en` - English
- `wo` - Wolof
- `ar` - العربية (Arabic)
- `es` - Español
- `pt` - Português

## Docker

```bash
# Build
docker build -t molam/ui-id-api:latest .

# Run
docker run -p 3036:3036 --env-file .env molam/ui-id-api:latest
```

## License

MIT © Molam
