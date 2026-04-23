FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
	&& apt-get install -y --no-install-recommends git ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

# Copy only workspace manifests first so dependency install can be cached.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml /app/
COPY patches /app/patches
COPY apps/search/package.json /app/apps/search/package.json

# Install only dependencies required by the search service.
RUN pnpm install --frozen-lockfile --filter @diffkit/search

# Copy search service sources after dependencies.
COPY apps/search /app/apps/search

EXPOSE 8910

CMD ["pnpm", "--filter", "@diffkit/search", "start"]
