# Start from the official Ubuntu image
FROM ubuntu:latest

# Install curl, git, and other dependencies
RUN apt update && \
    apt install -y curl git build-essential

# Install Node.js
RUN curl -sL https://deb.nodesource.com/setup_20.x | bash -
RUN apt install -y nodejs

# Verify Node.js and npm were installed correctly
RUN node -v
RUN npm -v

# Create app directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm install

# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY . .

# Your app binds to port 3000 so you'll use the EXPOSE instruction to have it mapped by the docker daemon
EXPOSE 3000

