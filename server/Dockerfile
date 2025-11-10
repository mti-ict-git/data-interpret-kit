# Backend Dockerfile (Node.js)
FROM node:18-alpine AS base

WORKDIR /app

# Install dependencies first (leverage docker layer cache)
COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source and models required for face detection (if used)
COPY src ./src
COPY models ./models

# Expose backend port
EXPOSE 3001

# Environment will be injected via docker-compose env_file (server/.env)
CMD ["npm", "run", "start"]