FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
RUN npm ci
COPY . .
RUN npm run db:generate && npm run build && npm run api:build
ENV NODE_ENV=production
EXPOSE 3000 4000
CMD ["npm", "start"]
