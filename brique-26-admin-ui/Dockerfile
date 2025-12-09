FROM node:20-alpine as build

WORKDIR /app

# Copy web source
COPY web ./web

# Install dependencies in the web directory
WORKDIR /app/web
RUN npm install

# Build
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built files from the web directory
COPY --from=build /app/web/dist /usr/share/nginx/html

# Copy nginx config
COPY web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
