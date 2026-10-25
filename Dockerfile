FROM node:20-slim

WORKDIR /app

# Copy root dependency definitions
COPY package.json package-lock.json ./

# Install root dependencies
RUN npm install --omit=optional

# Copy frontend dependency definitions
COPY atelier-ui-codrops-main/package.json atelier-ui-codrops-main/package-lock.json* ./atelier-ui-codrops-main/

# Install frontend dependencies
RUN npm --prefix atelier-ui-codrops-main install --omit=optional

# Copy all source files
COPY . .

# Build the Next.js frontend export
RUN npm --prefix atelier-ui-codrops-main run build

# Expose default port
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

# Start VeriTrust server
CMD ["node", "src/server.js"]
