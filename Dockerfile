# Load desired node pckg
FROM node:16.15-alpine

# Add python
RUN apk add g++ make python3

# Create app directory
WORKDIR /web/app

# Copy app source
COPY . .

# Install node dependencies with clean slate
# Also download tokens
RUN rm -rf node_modules && \
	yarn

# Expose port
EXPOSE 80

# Run app
CMD [ "yarn", "ingest:cloud" ]
