FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
ARG PNPM_VERSION=9.12.3

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        build-essential \
        ca-certificates \
        curl \
        git \
        jq \
        less \
        openssh-client \
        procps \
        python-is-python3 \
        python3 \
        python3-pip \
        python3-venv \
        unzip \
        wget \
        xz-utils \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable \
    && corepack prepare "pnpm@${PNPM_VERSION}" --activate

WORKDIR /workspace

ENV PYTHONUNBUFFERED=1

CMD ["/bin/sh", "-c", "trap : TERM INT; while true; do sleep 3600; done"]
