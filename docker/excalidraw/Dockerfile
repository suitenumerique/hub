# Excalidraw, pointed at our own collaboration server.
#
# The upstream app is a Vite bundle: `VITE_APP_WS_SERVER_URL` is inlined at
# build time from `.env.production`, so the published image always talks to
# `oss-collab.excalidraw.com` and no runtime variable can change that.
# Rebuilding the whole app from source to flip one URL costs several minutes,
# so we patch the built assets instead: the collaboration server is the only
# origin the meeting whiteboard needs, and the substitution is a plain string
# replacement in the emitted JavaScript.
FROM excalidraw/excalidraw:latest

ARG WS_SERVER_URL=http://localhost:9815

RUN find /usr/share/nginx/html -type f \( -name "*.js" -o -name "*.html" \) \
    -exec sed -i "s|https://oss-collab.excalidraw.com|${WS_SERVER_URL}|g" {} +
