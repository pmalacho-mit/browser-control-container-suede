FROM node:22-bookworm-slim

ARG BROWSER=chromium
ENV BROWSER=$BROWSER

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

# Install only the requested browser + its OS deps
RUN npx playwright install --with-deps "$BROWSER"

COPY scripts/ ./scripts/
RUN chmod +x scripts/*.ts

ENV WS_FILE=/tmp/playwright-ws
ENV LOG_DIR=/tmp/browser-logs

CMD ["bash"]