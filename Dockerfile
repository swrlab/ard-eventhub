# select bun
FROM oven/bun:1-alpine

# Create app directory
WORKDIR /web/app

# Copy app source
COPY . .

# Expose port
EXPOSE 80

# Run app
CMD [ "bun", "run", "ingest" ]
