FROM ghcr.io/puppeteer/puppeteer:19.7.2

USER root

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci --ignore-scripts

COPY . .

USER pptruser

CMD ["node", "index.js"]