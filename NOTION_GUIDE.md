# Guía de Conexión a Notion

Para que el script `notion_reporter.js` pueda crear reportes en tu Notion, necesitas configurar dos variables en tu archivo `.env`: `NOTION_TOKEN` y `NOTION_PAGE_ID`.

Sigue estos pasos sencillos para obtenerlos:

## 1. Crear una Integración en Notion (Token)
1. Ve a [Notion My Integrations](https://www.notion.so/my-integrations) en tu navegador.
2. Inicia sesión con tu cuenta de Notion.
3. Haz clic en **+ New Integration** (Nueva Integración).
4. Elige un nombre para tu integración (por ejemplo: "Pionex Reportes") y asegúrate de asociarla al espacio de trabajo (workspace) correcto.
5. Deja los permisos por defecto (necesita permisos de lectura y escritura para poder crear páginas).
6. Guarda la integración y copia la **Internal Integration Token** (Clave secreta que comienza con `secret_...`).
7. Pega esa clave en tu archivo `.env` en la línea:
   ```env
   NOTION_TOKEN=secret_xxxxxxxxx
   ```

## 2. Obtener el ID de la Página Madre (NOTION_PAGE_ID)
El script creará el reporte como una subpágina dentro de una página existente en tu Notion.
1. Ve a Notion y abre (o crea) la página donde quieres que se guarden los reportes.
2. Copia el enlace de esa página (desde la opción compartir o desde la barra del navegador). El enlace tendrá una estructura similar a esta:
   `https://www.notion.so/Nombre-De-La-Pagina-3a2b1c0d4e5f6g7h8i9j0k1l2m3n4o5p`
3. El ID de la página son los últimos 32 caracteres del enlace (después del último guion `-` o barra `/`). Por ejemplo, en el enlace de arriba sería: `3a2b1c0d4e5f6g7h8i9j0k1l2m3n4o5p`.
4. Pega este ID en tu archivo `.env` en la línea:
   ```env
   NOTION_PAGE_ID=3a2b1c0d4e5f6g7h8i9j0k1l2m3n4o5p
   ```

## 3. Compartir la Página con la Integración
Para que Notion permita a la integración crear páginas bajo tu página madre, debes darle acceso explícitamente:
1. Abre tu página madre en Notion.
2. Haz clic en **Share** (Compartir) en la esquina superior derecha.
3. Haz clic en la barra de búsqueda o sección **Invite / Add people, groups, or integrations**.
4. Busca y selecciona la integración que creaste (por ejemplo: "Pionex Reportes").
5. Asígnale permisos de **Can edit** (Puede editar) y haz clic en **Invite** (Invitar).

¡Listo! Una vez configuradas las variables en el `.env`, el reporte se enviará automáticamente cada 3 días.
