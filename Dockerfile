FROM node:16-bullseye

ENV SSH_USER="frostybot"
ENV SSH_PASS="__frostybot123__"
ENV SSH_PORT=22
ENV FROSTYBOT_PORT=80
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update -y \
    && apt-get install -y --no-install-recommends \
        sudo jq wget sqlite3 git openssh-server python3 build-essential ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/local/frostybot-js

COPY package.json ./
RUN npm install --unsafe-perm --no-audit --no-fund

COPY . .
RUN sed -i 's/\r$//' ./entrypoint.sh ./frostybot ./scripts/* \
    && chmod +x ./entrypoint.sh ./frostybot \
    && find ./scripts -type f -exec chmod +x {} \; \
    && ln -sf /usr/local/frostybot-js/frostybot /usr/bin/frostybot \
    && mkdir -p /var/run/sshd ./log ./database

EXPOSE 22 80
ENTRYPOINT ["./entrypoint.sh"]
