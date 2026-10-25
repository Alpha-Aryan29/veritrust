FROM node:20

WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json ./

# Install root dependencies
RUN npm install --omit=optional

# Copy all project code including pre-built frontend
COPY . .

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

# Start VeriTrust server
CMD ["node", "src/server.js"]
