FROM node:18-alpine

# Install OpenSSL and other dependencies
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy prisma files
COPY prisma ./prisma/

# Provide a build-time fallback so prisma generate can run without external env injection
ARG DATABASE_URL=postgresql://postgres:postgres@localhost:5432/inventory_db
ENV DATABASE_URL=${DATABASE_URL}

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 4000

# Start server
CMD ["node", "dist/index.js"]
