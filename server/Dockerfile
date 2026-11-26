# API do À Mesa (Express + Prisma + Socket.IO)
FROM node:24-bookworm-slim

# O Prisma precisa do OpenSSL para falar com o PostgreSQL
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependências primeiro (aproveita a cache do Docker quando só muda o código)
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && mkdir -p uploads && chown -R node:node /app

# Não correr como root
USER node
EXPOSE 4000

# Aplica as migrações, os dados de exemplo (idempotente) e arranca a API
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/index.js"]
