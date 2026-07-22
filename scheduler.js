const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("=========================================");
console.log("📅 PROGRAMADOR INTELIGENTE DE REPORTES PIONEX INICIADO");
console.log("Intervalo de chequeo: Cada 1 hora");
console.log("Notion: Cada 3 días (autocurativo via Notion)");
console.log("Telegram: Cada 24 horas (autocurativo via archivo local)");
console.log("Zona horaria: " + (process.env.TZ || "Default"));
console.log("=========================================");

// Cargar variables de entorno
function loadEnv() {
  if (process.env.NOTION_TOKEN && process.env.NOTION_PAGE_ID) {
    return process.env;
  }
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) {
    return process.env;
  }
  const content = fs.readFileSync(envPath, "utf-8");
  const env = { ...process.env };
  content.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] ? match[2].trim() : "";
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      env[match[1]] = value;
    }
  });
  return env;
}

const env = loadEnv();
const NOTION_TOKEN = env.NOTION_TOKEN;
const NOTION_PAGE_ID = env.NOTION_PAGE_ID;

// Ruta del archivo de persistencia local para Telegram
const telegramTimeFile = path.join(__dirname, "last_telegram_send.json");

// --------------------- SECCIÓN NOTION ---------------------

function runNotionReport() {
  console.log(`[${new Date().toISOString()}] Iniciando ejecución del reporte de Notion (notion_reporter.js)...`);
  exec("node notion_reporter.js", (error, stdout, stderr) => {
    if (error) {
      console.error(`[${new Date().toISOString()}] Error al ejecutar notion_reporter.js:`, error.message);
      if (stderr) console.error("Detalle de error:", stderr);
      return;
    }
    console.log(`[${new Date().toISOString()}] Reporte de Notion ejecutado con éxito.`);
    if (stdout) console.log("Salida del script:", stdout.trim());
  });
}

async function fetchWithRetry(url, options = {}, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`Error en fetch a ${url}: ${err.message}. Reintentando (${i + 1}/${retries})...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function checkAndRunNotion() {
  console.log(`[${new Date().toISOString()}] Chequeando historial de reportes en Notion...`);
  if (!NOTION_TOKEN || !NOTION_PAGE_ID) {
    console.warn("Faltan variables NOTION_TOKEN o NOTION_PAGE_ID. Omitiendo Notion.");
    return;
  }

  try {
    const response = await fetchWithRetry(
      `https://api.notion.com/v1/blocks/${NOTION_PAGE_ID}/children?page_size=100`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${NOTION_TOKEN}`,
          "Notion-Version": "2022-06-28"
        }
      }
    );

    if (!response.ok) {
      const errData = await response.json();
      console.error("Error al consultar Notion API:", errData);
      return;
    }

    const data = await response.json();
    const pages = data.results.filter(b => b.type === "child_page");
    
    if (pages.length === 0) {
      console.log("No se encontraron reportes anteriores en Notion. Ejecutando el primer reporte.");
      runNotionReport();
      return;
    }

    const times = pages.map(p => new Date(p.created_time).getTime());
    const maxTime = Math.max(...times);
    const lastReportDate = new Date(maxTime);
    
    console.log(`Último reporte detectado en Notion: ${lastReportDate.toISOString()}`);
    
    const diffMs = Date.now() - maxTime;
    const diffHours = diffMs / (1000 * 60 * 60);
    console.log(`Horas transcurridas desde el último reporte en Notion: ${diffHours.toFixed(2)}h`);

    if (diffHours >= 71) {
      console.log("¡Han pasado 3 días o más! Ejecutando reporte en Notion...");
      runNotionReport();
    } else {
      console.log(`No es necesario ejecutar Notion aún. Faltan ${(71 - diffHours).toFixed(2)}h.`);
    }
  } catch (error) {
    console.error("Error en el chequeo de Notion:", error.message);
  }
}

// --------------------- SECCIÓN TELEGRAM ---------------------

function runTelegramReport() {
  console.log(`[${new Date().toISOString()}] Iniciando ejecución del reporte de Telegram (telegram_reporter.js)...`);
  exec("node telegram_reporter.js", (error, stdout, stderr) => {
    if (error) {
      console.error(`[${new Date().toISOString()}] Error al ejecutar telegram_reporter.js:`, error.message);
      if (stderr) console.error("Detalle de error:", stderr);
      return;
    }
    console.log(`[${new Date().toISOString()}] Reporte de Telegram ejecutado con éxito.`);
    if (stdout) console.log("Salida del script:", stdout.trim());
    
    // Guardar fecha de envío exitosa
    try {
      fs.writeFileSync(telegramTimeFile, JSON.stringify({ lastSendTime: Date.now() }), "utf-8");
    } catch (e) {
      console.error("Error al escribir archivo de control de Telegram:", e.message);
    }
  });
}

function checkAndRunTelegram() {
  console.log(`[${new Date().toISOString()}] Chequeando temporizador de Telegram...`);
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.log("Variables de Telegram no configuradas. Omitiendo reporte diario.");
    return;
  }

  let lastSendTime = 0;
  if (fs.existsSync(telegramTimeFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(telegramTimeFile, "utf-8"));
      lastSendTime = data.lastSendTime || 0;
    } catch (e) {
      console.warn("Error al leer last_telegram_send.json, reestableciendo...");
    }
  }

  const diffMs = Date.now() - lastSendTime;
  const diffHours = diffMs / (1000 * 60 * 60);
  console.log(`Horas transcurridas desde el último reporte de Telegram: ${diffHours.toFixed(2)}h`);

  // Ejecutar si pasaron más de 23 horas (1 día con margen de 1h)
  if (diffHours >= 23) {
    console.log("¡Han pasado 23 horas o más! Enviando reporte a Telegram...");
    runTelegramReport();
  } else {
    console.log(`No es necesario enviar reporte a Telegram aún. Faltan ${(23 - diffHours).toFixed(2)}h.`);
  }
}

// --------------------- INICIALIZACIÓN ---------------------

// Ejecutar chequeos al iniciar
checkAndRunNotion();
checkAndRunTelegram();

// Programar chequeos cada 1 hora
const ONE_HOUR_MS = 60 * 60 * 1000;
setInterval(() => {
  checkAndRunNotion();
  checkAndRunTelegram();
}, ONE_HOUR_MS);
