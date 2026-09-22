FROM node:24-alpine3.22 AS dependencies
WORKDIR /app
RUN npm install --global pnpm@11.19.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/kit/package.json ./packages/kit/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/create-app/package.json ./packages/create-app/package.json
COPY apps/reference/package.json ./apps/reference/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS builder
COPY . .
RUN pnpm build

FROM dependencies AS production_dependencies
RUN pnpm --filter @adula/reference deploy --prod --legacy --frozen-lockfile /runtime
# pnpm 11 legacy deployment preserves workspace links. The runtime assembles the
# built workspace packages below, instead of retaining links to the build tree.
RUN rm /runtime/node_modules/@adula/kit /runtime/node_modules/@adula/ui

FROM node:24-alpine3.22
RUN apk add --no-cache postgresql17-client aws-cli bash
WORKDIR /app/apps/reference
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3333
COPY --from=production_dependencies --chown=node:node /runtime/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/packages/kit/package.json ./node_modules/@adula/kit/package.json
COPY --from=builder --chown=node:node /app/packages/kit/build ./node_modules/@adula/kit/build
COPY --from=builder --chown=node:node /app/packages/ui/package.json ./node_modules/@adula/ui/package.json
COPY --from=builder --chown=node:node /app/packages/ui/build ./node_modules/@adula/ui/build
COPY --from=builder --chown=node:node /app/apps/reference/build ./
COPY --from=builder --chown=node:node /app/apps/reference/AGENTS.md ./AGENTS.md
COPY --from=builder --chown=node:node /app/apps/reference/CLAUDE.md /app/apps/reference/KIT_GAPS.md ./
COPY --from=builder --chown=node:node /app/apps/reference/adula.lock.json /app/apps/reference/ui.lock.json ./
COPY --from=builder --chown=node:node /app/apps/reference/.agents ./.agents
# Doctor verifies project-owned UI hashes and inventories customized pages.
# These sources are diagnostics only; the HTTP server serves compiled assets.
COPY --from=builder --chown=node:node /app/apps/reference/inertia/components/ui ./inertia/components/ui
COPY --from=builder --chown=node:node /app/apps/reference/inertia/pages ./inertia/pages
COPY --from=builder --chown=node:node /app/apps/reference/deploy ./deploy
RUN ln -s ../../.pnpm/node_modules node_modules/@adula/kit/node_modules     && mkdir -p storage/uploads && chown node:node storage storage/uploads
RUN node -e "const fs=require('node:fs'); for (const name of ['kit','ui']) { if (!fs.realpathSync('node_modules/@adula/'+name).startsWith(process.cwd()+'/')) throw new Error('Non-portable workspace dependency: '+name) }"     && node --input-type=module -e "await import('@adula/kit'); await import('@adula/ui/package.json', {with:{type:'json'}})"
USER node
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:3333/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "bin/server.js"]
