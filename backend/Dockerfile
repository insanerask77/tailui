FROM node:20-bookworm-slim AS build
WORKDIR /app
# build-essential provides g++/make; python3 needed by node-gyp
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential python3 \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
# C++20 required by v8 headers in Node 20+
RUN CXXFLAGS="-std=c++20" npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --production

FROM node:20-bookworm-slim
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
EXPOSE 3001
CMD ["node", "dist/index.js"]
