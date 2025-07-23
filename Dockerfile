FROM node:20-alpine
# Set working directory
WORKDIR /app

# Copy the standalone build output to the correct location
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
EXPOSE 3000
CMD ["node", "server.js"]
