# ✈️ Guía de Configuración para Alertas de Telegram (Paso a Paso)

Esta guía te ayudará a crear tu propio Bot de Telegram y obtener tu ID de chat en menos de 2 minutos para recibir las alertas y el reporte de tus bots cada 24 horas.

---

### Paso 1: Crea tu Bot de Telegram
1. Abre Telegram y busca al usuario oficial **`@BotFather`** (el bot oficial para crear otros bots, que tiene una insignia de verificación azul).
2. Haz clic en **Iniciar / Start** y envía el comando:
   ```text
   /newbot
   ```
3. Sigue las instrucciones del BotFather:
   * **Nombre para el bot:** (Ejemplo: `Mi Pionex Reporter Bot`)
   * **Usuario para el bot:** Debe terminar en `bot` (Ejemplo: `yosinjefe_pionex_bot`).
4. Al finalizar, BotFather te enviará un mensaje con tu **Token de Acceso** (Token HTTP API). Será algo como:
   `7456382901:AAHk-9eN_xxxxx_xxxx_xxxxx`
5. **Copia este Token.** Este valor será tu `TELEGRAM_BOT_TOKEN`.

---

### Paso 2: Obtén tu ID de Chat de Telegram
Necesitamos indicarle al bot a qué chat privado debe enviar los reportes:
1. Abre Telegram y busca al usuario **`@userinfobot`** o **`@raw_data_bot`**.
2. Haz clic en **Iniciar / Start**.
3. El bot te responderá inmediatamente con tu información, incluyendo tu **`Id`** (un número de 9 o 10 dígitos, por ejemplo: `123456789`).
4. **Copia este número.** Este valor será tu `TELEGRAM_CHAT_ID`.

---

### Paso 3: Inicia la conversación con tu Bot
1. Ve al chat de tu propio bot (puedes buscarlo en Telegram con el nombre de usuario que elegiste en el Paso 1, o haciendo clic en el enlace `t.me/tu_usuario_bot` que te dio BotFather).
2. Haz clic en **Iniciar / Start** (o envía un mensaje cualquiera como `/start`). 
   * *Nota: Este paso es fundamental. Si no inicias la conversación, Telegram bloqueará al bot por seguridad y no podrá enviarte los reportes.*

---

### Paso 4: Configura las variables en EasyPanel (Servidor)
Para que el bot de la nube pueda enviar los reportes, ingresa a tu panel de **EasyPanel**:
1. Abre tu proyecto y selecciona la aplicación de tu bot.
2. Ve a la pestaña **Environment** (Variables de Entorno).
3. Agrega las dos nuevas variables (sin comillas):
   * `TELEGRAM_BOT_TOKEN` = `TU_TOKEN_DEL_PASO_1`
   * `TELEGRAM_CHAT_ID` = `TU_ID_DEL_PASO_2`
4. Haz clic en **Guardar / Save**.
5. Ve a la parte superior y haz clic en **Deploy** (Desplegar) para aplicar los cambios en el servidor.
