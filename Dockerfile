# syntax=docker/dockerfile:1.7
#
# Imagem de produção do OABase (VPS em São Paulo, ver deploy/).
#
# Três estágios: dependências, build e execução. A imagem final leva só o
# servidor `standalone` que o Next gera — sem código-fonte, sem node_modules
# inteiro, sem ferramenta de build.
#
# **Segredo não entra em camada.** O `next build` precisa do ambiente
# completo: gera páginas estáticas lendo o Supabase, e a tela de cadastro
# decide a frase sobre cobrança por `ASAAS_AMBIENTE`. O `.env` chega como
# secret do BuildKit, montado só durante o `RUN` do build. Em execução, o
# ambiente vem do `env_file` do compose.
#
# Atenção: o `output: "standalone"` **copia os `.env*` do projeto para dentro
# de `.next/standalone`** — com o secret montado em `/app/.env.production`,
# isso gravava todos os segredos na imagem. O `rm` fica no mesmo `RUN` do
# build, para o arquivo não existir em camada nenhuma, nem no cache.

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN npm install -g pnpm@9.15.0 --silent
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `required=true`: sem o segredo o build falha. O padrão do BuildKit é pular
# em silêncio o segredo que não encontra — e aí o `next build` roda sem as
# variáveis NEXT_PUBLIC_*, gera o JS do navegador sem a URL do Supabase e
# cai nos dados de exemplo (`fonte-mock.ts`) nas páginas estáticas. Foi o
# que aconteceu no primeiro build: o id aqui não batia com o do compose.
RUN --mount=type=secret,id=ambiente,target=/app/.env.production,required=true \
    OABASE_STANDALONE=1 pnpm build \
 && rm -f .next/standalone/.env* \
 && cp -r public .next/standalone/ \
 && cp -r .next/static .next/standalone/.next/

FROM node:${NODE_VERSION}-slim AS app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /app
# Usuário sem privilégio: quem explorar uma falha no app não ganha root no
# container. O cache de ISR (.next/cache) precisa ser dele para gravar.
COPY --from=build --chown=node:node /app/.next/standalone ./
RUN mkdir -p .next/cache && chown node:node .next/cache
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
