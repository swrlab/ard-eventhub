# select bun
FROM oven/bun:1-alpine

# Create app directory
WORKDIR /web/app

# Copy app source
COPY . .

# Expose port
EXPOSE 80

# Run via package script so Bun injects npm_package_version for @frytg/logger
CMD [ "bun", "run", "start" ]
