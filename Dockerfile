FROM node:20-alpine
# Set working directory
WORKDIR /app

# Copy the standalone build output to the correct location
COPY .next/standalone ./

# Copy static assets - these are required for CSS, JS, and other assets
# Next.js standalone builds don't include these automatically
# Note: GitHub workflow now copies these to the standalone directory
# COPY .next/static ./.next/static
# COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
EXPOSE 3000
CMD ["node", "server.js"]
