FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies for native compilation (better-sqlite3)
RUN apk add --no-cache python3 make g++

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src/ ./src/
RUN npm run build

# Prune devDependencies to keep only production dependencies
RUN npm prune --omit=dev

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Install runtime libraries for native C++ addons
RUN apk add --no-cache libstdc++

# Copy production dependencies, compiled dist, and static assets
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package*.json ./
COPY public/ ./public/

# Ensure non-root node user owns the app directory for SQLite WAL and local reports
RUN mkdir -p /app/reports && chown -R node:node /app

USER node

EXPOSE 3000
CMD ["node", "dist/index.js"]
