FROM node:20-alpine as build

WORKDIR /app

# Copy SDK dependency (needed for local dependency)
COPY brique-35-sdk-auth ./brique-35-sdk-auth

# Copy Web UI source
COPY brique-36-ui-id/web ./brique-36-ui-id/web

# Install dependencies in the web directory
WORKDIR /app/brique-36-ui-id/web
RUN npm install

# Build
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files from the web directory
COPY --from=build /app/brique-36-ui-id/web/dist /usr/share/nginx/html

# Copy nginx config
COPY brique-36-ui-id/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
