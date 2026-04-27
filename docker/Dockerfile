FROM node:22-bookworm-slim

ARG BROWSER=chrome
ENV BROWSER=$BROWSER

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

ENV PATH="/app/node_modules/.bin:$PATH"

# Install only the requested browser + its OS deps
RUN playwright-cli install "$BROWSER"

CMD ["bash"]