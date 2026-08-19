FROM node:20-alpine

WORKDIR /app/frontend

# Copy dependency manifests first to leverage cached layers
COPY frontend/package*.json ./
RUN npm install --production=false

COPY frontend/ ./
COPY docs/user /app/docs/user

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
