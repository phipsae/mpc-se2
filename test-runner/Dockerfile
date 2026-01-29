# Use Node.js LTS
FROM node:20-slim

# Install dependencies for Foundry
RUN apt-get update && apt-get install -y \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Foundry
RUN curl -L https://foundry.paradigm.xyz | bash
ENV PATH="/root/.foundry/bin:${PATH}"
RUN foundryup

# Set working directory
WORKDIR /app

# Pre-install Foundry dependencies (forge-std and OpenZeppelin)
# These will be symlinked into each test project
RUN mkdir -p /app/forge-libs && cd /app/forge-libs && \
    git init && \
    forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts --no-git

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm install --production

# Copy server code
COPY server.js ./

# Create temp directory for test projects
RUN mkdir -p /tmp/forge-tests

# Expose port
EXPOSE 3001

# Set environment variables
ENV PORT=3001
ENV NODE_ENV=production

# Start the server
CMD ["node", "server.js"]
