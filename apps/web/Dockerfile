# Web image — Next.js dashboard. Build context is the repo ROOT (workspaces),
# so build with: docker build -f apps/web/Dockerfile .
# NEXT_PUBLIC_API_URL is inlined at build time, so it must be passed as a build arg.
FROM node:20-slim
WORKDIR /app

COPY . .
RUN npm ci

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build -w web

EXPOSE 3000
CMD ["npm", "run", "start", "-w", "web"]
