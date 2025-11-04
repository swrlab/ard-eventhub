# select bun
FROM oven/bun:1-alpine as base

# Create app directory
WORKDIR /web/app

# Copy app source
COPY . .

# Install dependencies
RUN bun install --frozen-lockfile --production

# Expose port
EXPOSE 80

# Run app
CMD [ "bun", "run", "ingest:cloud" ]
