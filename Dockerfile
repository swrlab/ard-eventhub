# select bun
FROM oven/bun:1 as bun

# Create app directory
WORKDIR /web/app

# Copy app source
COPY . .

# Install dependencies
RUN bun install

# Load desired node image
FROM node:20-alpine

# Create app directory
WORKDIR /web/app

# Copy compiled app source
COPY --from=bun /web/app /web/app

# Expose port
EXPOSE 80

# Run app
CMD [ "npm", "run", "ingest:cloud" ]
