FROM node:20-slim

WORKDIR /app

COPY server/package.json server/package-lock.json ./

RUN npm ci && npm cache clean --force

COPY server/. .

RUN npm run build

RUN npm prune --omit=dev

ENV NODE_ENV=production

EXPOSE 10000

CMD ["sh", "-c", "npm run migrate && npm start"]
