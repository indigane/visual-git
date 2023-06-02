# Start from the official Ubuntu image
FROM ubuntu:latest

USER root

# Update and install dependencies in a single layer
RUN apt-get update && \
    apt-get install -y sudo curl git build-essential && \
    curl -sL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get clean

# Create a non-root user 'user' with sudo privileges
RUN useradd --create-home --uid 1000 --shell /bin/bash user && \
    usermod --append --groups sudo user

# Switch to the just created user
USER user

# Create app directory
WORKDIR /home/user/app
