FROM node:20-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --only=production
COPY src ./src
COPY shared/ ./shared/
ENV NODE_ENV=production
CMD ["node","src/index.js"]
