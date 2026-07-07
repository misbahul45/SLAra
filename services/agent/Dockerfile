FROM node:22-alpine
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
# Install dependensi (termasuk devDependencies untuk hot-reload)
RUN pnpm install --frozen-lockfile

# Source code akan di-mount dari host
EXPOSE 3000

# Asumsi kamu menggunakan tsx atau ts-node-dev di script "dev" pada package.json
CMD ["pnpm", "run", "dev"]