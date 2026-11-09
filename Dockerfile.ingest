# Ingest image. Dependencies install here so a macOS node_modules is never copied in.
FROM oven/bun:1-alpine

WORKDIR /web/app

COPY package.json bun.lock .npmrc bunfig.toml ./
RUN bun install --frozen-lockfile --production

COPY . .

EXPOSE 80

# Run via package script so Bun injects npm_package_version for @frytg/logger
CMD ["bun", "run", "start"]
