FROM node:20-alpine
WORKDIR /usr/src/app
COPY indexer/package*.json ./
RUN npm ci --only=production
COPY indexer/src ./src
# Copier audit-writer entier
COPY audit-writer ./audit-writer
COPY shared/ ./shared/
CMD ["node","src/indexer.js"]
