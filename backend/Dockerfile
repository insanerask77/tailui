FROM node:20-alpine AS build
WORKDIR /app
# build tools needed for better-sqlite3 native addon
RUN apk add --no-cache python3 make g++
COPY package*.json ./
# C++20 required by node v8 headers on alpine
RUN CXXFLAGS="-std=c++20" npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --production

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache libstdc++
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
EXPOSE 3001
CMD ["node", "dist/index.js"]
