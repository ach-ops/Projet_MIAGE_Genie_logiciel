FROM node:22-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS runner

# dumb-init gère correctement SIGTERM
RUN apk add --no-cache dumb-init

WORKDIR /app

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node . .

ENV NODE_ENV=production

ENV PORT=8080

EXPOSE 8080

USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "index.js"]
