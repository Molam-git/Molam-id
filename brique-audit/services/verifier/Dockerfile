FROM node:20-alpine
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci --only=production
COPY src ./src
COPY shared/ ./shared/

CMD ["node","src/verify.js"]
