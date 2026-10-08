FROM node:20-slim

WORKDIR /app

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server/. .

RUN npm run build

ENV NODE_ENV=production

EXPOSE 10000

# Migrations are idempotent — safe to run on every container start
CMD ["sh", "-c", "npm run migrate && npm start"]
