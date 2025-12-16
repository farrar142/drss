# ===== Dependencies Stage =====
FROM node:24-alpine AS deps

WORKDIR /usr/src/app

# Install dependencies only
COPY package*.json ./
RUN npm ci --only=production=false

# ===== Build Stage =====
FROM node:24-alpine AS builder

WORKDIR /usr/src/app

# Copy dependencies from deps stage
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY . .

# Set environment for production build
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN npm run build

# ===== Production Stage =====
FROM node:24-alpine AS production

WORKDIR /usr/src/app

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
  adduser --system --uid 1001 nextjs

# Copy only necessary files from builder
COPY --from=builder /usr/src/app/public ./public
COPY --from=builder /usr/src/app/.next/standalone ./
COPY --from=builder /usr/src/app/.next/static ./.next/static

# Set correct ownership
RUN chown -R nextjs:nodejs /usr/src/app
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

EXPOSE 3000

CMD ["node", "server.js"]
