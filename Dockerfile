FROM node:22-slim

# Directorio de trabajo
WORKDIR /app

# Copiar configuración de dependencias
COPY package.json ./

# Instalar dependencias (si se agregan en el futuro)
RUN npm install --production

# Copiar los scripts de ejecución
COPY notion_reporter.js ./
COPY scheduler.js ./

# Comando de inicio
CMD ["npm", "start"]
