# Build from the repository root:
#   podman build -f trakdo.spa/Dockerfile -t trakdo-spa .
FROM node:22-alpine AS build
WORKDIR /src

COPY trakdo.spa/package*.json ./
RUN npm ci

COPY trakdo.spa/ ./
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY trakdo.spa/nginx.conf /etc/nginx/conf.d/default.conf
# The base image runs everything in this directory before starting nginx.
COPY trakdo.spa/docker-resolver.sh /docker-entrypoint.d/10-resolver.sh
RUN chmod +x /docker-entrypoint.d/10-resolver.sh
COPY --from=build /src/dist/trakdo.spa/browser /usr/share/nginx/html
EXPOSE 80
