FROM node:20-slim AS base

# Installer les dépendances système nécessaires pour bcrypt
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer et rebuilder les modules natifs
RUN npm ci && npm rebuild bcrypt --build-from-source

# Copier le code source
COPY . .

# Exposer le port
EXPOSE 3000

# Commande par défaut
CMD ["npm", "start"]