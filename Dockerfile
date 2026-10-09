FROM node:20-slim

WORKDIR /app

COPY server/package.json server/package-lock.json ./

# Install dev dependencies because TypeScript is required for the build
RUN npm ci && npm cache clean --force

COPY server/. .

# Build TypeScript
RUN npm run build

# Remove development dependencies after the build
RUN npm prune --omit=dev

ENV NODE_ENV=production

EXPOSE 10000

# Run migrations, then start the server
CMD ["sh", "-c", "npm run migrate && npm start"]
