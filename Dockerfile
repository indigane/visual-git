FROM ubuntu:focal-20201106

USER root
ENV USER=root

RUN apt-get update \
    && apt-get install -y sudo curl git \
    && curl -sL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --uid 1000 --shell /bin/bash vision && \
    usermod --append --groups sudo vision

COPY frontend /home/vision/frontend
COPY backend /home/vision/backend

RUN chown -R vision:vision /home/vision

USER vision
ENV USER=vision HOME=/home/vision
WORKDIR /home/vision/repo
CMD node $HOME/backend/index.js

