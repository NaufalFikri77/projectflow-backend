FROM oven/bun:1.4.2 AS base
WORKDIR /app

COPY package.json bun.lock* ./
COPY prisma ./prisma
RUN bun install --frozen-lockfile --production
RUN bunx prisma generate

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Expose port
EXPOSE 3001

# Start the server
CMD ["sh", "-c", "bun run db:deploy && bun run src/server.ts"]
