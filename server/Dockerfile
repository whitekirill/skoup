# Сервис брифа. Собирается на brim скриптом deploy/bin/skoup-deploy-brief, запускается стеком deploy/brief/docker-stack.yml
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
# uid 1000 — владелец /srv/skoup/<env>/data на brim
USER node
EXPOSE 3200
CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.js"]
