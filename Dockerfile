FROM oven/bun:1

WORKDIR /app

COPY package.json package-lock.json ./
RUN bun install

COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./tsconfig.json

RUN bunx prisma generate
RUN bun run build

EXPOSE 10000

CMD ["sh", "-c", "bun run db:deploy && bun run start"]
