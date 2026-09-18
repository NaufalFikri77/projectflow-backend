FROM oven/bun:1.2 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production

# Copy prisma schema and generate client
COPY prisma ./prisma
RUN bunx prisma generate

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Expose port
EXPOSE 3001

# Start the server
CMD ["sh", "-c", "bun run db:deploy && bun run src/server.ts"]
