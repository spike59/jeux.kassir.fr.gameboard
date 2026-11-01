# gameboard : portail jeux.kassir.fr (menu 3D + API des scores), construit par la stack (web/jeux.kassir.fr/compose.yml).

# --- étape 1 : construction du menu 3D ---
FROM node:22-alpine AS menu-build
WORKDIR /menu
COPY menu/package.json menu/package-lock.json ./
# npm ci repart de zéro (efface un éventuel node_modules local venu de Windows)
RUN npm ci --no-audit --no-fund
COPY menu/ ./
RUN npm run build

# --- étape 2 : serveur ---
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
# fichiers appartenant à root, exécutés par l'utilisateur node : l'appli ne peut pas se modifier
COPY src ./src
COPY site ./site
COPY games.json ./
COPY --from=menu-build /menu/dist /menu
# scores : volume monté sur /data, seul endroit inscriptible (le reste du conteneur est en lecture seule)
RUN mkdir /data && chown node:node /data

USER node
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0 MENU_DIR=/menu PUBLIC_DIR=/app/site CATALOG=/app/games.json DATA_DIR=/data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
