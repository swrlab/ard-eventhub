# Load desired node pckg
FROM node:16.14.2-alpine

# Add python
RUN apk add g++ make python3

# Add rustup toolchain
RUN apk add rustup build-base
RUN rustup-init -y
ENV PATH "/root/.cargo/bin:$PATH"
ENV RUSTFLAGS="-C target-feature=-crt-static"

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
