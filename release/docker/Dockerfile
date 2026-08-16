FROM node:22-bookworm-slim

ARG BROWSER=chrome
ENV BROWSER=$BROWSER

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

ENV PATH="/app/node_modules/.bin:$PATH"

RUN npx playwright install --with-deps "$BROWSER"
RUN playwright-cli install-browser "$BROWSER"

# The tools trust.mjs needs to add a certificate to the stores the browsers read.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates libnss3-tools \
    && rm -rf /var/lib/apt/lists/*

COPY forward.mjs /forward.mjs
COPY trust.mjs /trust.mjs

CMD ["bash"]
