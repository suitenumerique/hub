ARG FRONTEND_IMAGE=frontend-build-output

FROM node:24-alpine AS frontend-deps

# Upgrade system packages to install security updates
RUN apk update && \
  apk upgrade && \
  rm -rf /var/cache/apk/*

WORKDIR /home/frontend/

COPY ./src/frontend/package.json ./package.json
COPY ./src/frontend/yarn.lock ./yarn.lock
COPY ./src/frontend/apps/hub/package.json ./apps/hub/package.json

RUN yarn install --frozen-lockfile

COPY .dockerignore ./.dockerignore
COPY ./src/frontend/.prettierrc.js ./.prettierrc.js
COPY ./src/frontend/apps/hub ./apps/hub

### ---- Front-end builder image ----
FROM frontend-deps AS hub

WORKDIR /home/frontend/apps/hub

FROM frontend-deps AS hub-dev

WORKDIR /home/frontend/apps/hub

EXPOSE 3000

CMD [ "yarn", "dev"]

# Tilt will rebuild hub target so, we dissociate hub and hub-builder
# to avoid rebuilding the app at every changes.
FROM hub AS hub-builder

WORKDIR /home/frontend/apps/hub

ARG API_ORIGIN
ENV NEXT_PUBLIC_API_ORIGIN=${API_ORIGIN}

RUN yarn build

# Normalize output path to /app (matches the runtime-prod layout)
FROM scratch AS frontend-build-output
COPY --from=hub-builder /home/frontend/apps/hub/out /app

# When FRONTEND_IMAGE is set to an external image, BuildKit skips
# frontend-deps,hub-builder, and frontend-build-output entirely
FROM ${FRONTEND_IMAGE} AS frontend-source

# ---- Front-end image ----
FROM nginxinc/nginx-unprivileged:alpine3.22 AS frontend-production

# Upgrade system packages to install security updates
USER root
RUN apk update && \
  apk upgrade && \
  rm -rf /var/cache/apk/*

# Un-privileged user running the application
ARG DOCKER_USER
USER ${DOCKER_USER}

COPY --from=frontend-source /app /app

COPY ./src/frontend/apps/hub/conf/default.conf /etc/nginx/conf.d
COPY ./docker/files/usr/local/bin/entrypoint /usr/local/bin/entrypoint

ENTRYPOINT [ "/usr/local/bin/entrypoint" ]

CMD ["nginx", "-g", "daemon off;"]
