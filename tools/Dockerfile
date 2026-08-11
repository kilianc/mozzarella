# tools/Dockerfile — pinned toolchain for mozzarella.
#
# Node and JS package managers are intentionally absent from the host. Every
# command that needs them runs inside this image. Build it with:
#
#   docker build -t mozzarella-tools tools/
#
# and run it via the `bin/tools` wrapper:
#
#   bin/tools npm ci
#   bin/tools npm test
#
# npm is the only package manager this project uses.
FROM node:22.23.2-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git \
 && rm -rf /var/lib/apt/lists/*

# The container runs as the host UID/GID, which has no home directory inside
# the image. Point every cache at a world-writable location.
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_CACHE=/tmp/npm-cache \
    HOME=/tmp

WORKDIR /work
