FROM node:20-alpine
WORKDIR /usr/src/app
COPY package.json ./
RUN npm install --only=production
COPY src ./src
CMD ["node","src/indexer.js"]
