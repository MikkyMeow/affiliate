FROM node:20-alpine

WORKDIR /app

# Accept build-time overrides for the public API/tracking base URLs.
ARG NEXT_PUBLIC_API_BASE
ARG NEXT_PUBLIC_TRACKING_BASE
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_TRACKING_BASE=$NEXT_PUBLIC_TRACKING_BASE

# Copy dependency manifests first to leverage cached layers
COPY package*.json ./
RUN npm install --production=false

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
