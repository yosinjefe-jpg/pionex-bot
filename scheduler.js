const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("=========================================");
console.log("📅 PROGRAMADOR INTELIGENTE DE REPORTES PIONEX INICIADO");
console.log("Intervalo de chequeo: Cada 1 hora");
console.log("Intervalo de reporte: Cada 3 días (autocurativo via Notion)");
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

// Función para ejecutar el reporte
function runReport() {
  console.log(`[${new Date().toISOString()}] Iniciando ejecución del reporte (notion_reporter.js)...`);
  exec("node notion_reporter.js", (error, stdout, stderr) => {
    if (error) {
      console.error(`[${new Date().toISOString()}] Error al ejecutar notion_reporter.js:`, error.message);
      if (stderr) console.error("Detalle de error:", stderr);
      return;
    }
    console.log(`[${new Date().toISOString()}] Reporte ejecutado con éxito.`);
    if (stdout) console.log("Salida del script:", stdout.trim());
  });
}

// Función robusta de reintento para peticiones fetch
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

// Verificar cuándo se creó el último reporte en Notion
async function checkAndRun() {
  console.log(`[${new Date().toISOString()}] Chequeando historial de reportes en Notion...`);
  if (!NOTION_TOKEN || !NOTION_PAGE_ID) {
    console.error("Faltan variables NOTION_TOKEN o NOTION_PAGE_ID. Ejecutando reporte por defecto.");
    runReport();
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
      console.log("Ejecutando reporte preventivo por fallo de API.");
      runReport();
      return;
    }

    const data = await response.json();
    const pages = data.results.filter(b => b.type === "child_page");
    
    if (pages.length === 0) {
      console.log("No se encontraron reportes anteriores. Ejecutando el primer reporte.");
      runReport();
      return;
    }

    // Obtener la fecha del reporte más reciente
    const times = pages.map(p => new Date(p.created_time).getTime());
    const maxTime = Math.max(...times);
    const lastReportDate = new Date(maxTime);
    
    console.log(`Último reporte detectado en Notion: ${lastReportDate.toISOString()}`);
    
    const diffMs = Date.now() - maxTime;
    const diffHours = diffMs / (1000 * 60 * 60);
    console.log(`Horas transcurridas desde el último reporte: ${diffHours.toFixed(2)}h`);

    // Si pasaron más de 71 horas (3 días aproximados con margen), generamos nuevo reporte
    if (diffHours >= 71) {
      console.log("¡Han pasado 3 días o más! Ejecutando reporte...");
      runReport();
    } else {
      console.log(`No es necesario ejecutar el reporte aún. Faltan ${(71 - diffHours).toFixed(2)}h.`);
    }
  } catch (error) {
    console.error("Error en el chequeo de Notion:", error.message);
    console.log("Ejecutando reporte de respaldo por error en chequeo.");
    runReport();
  }
}

// Ejecutar el chequeo inmediatamente al iniciar
checkAndRun();

// Ejecutar el chequeo cada 1 hora (3600000 ms)
const ONE_HOUR_MS = 60 * 60 * 1000;
setInterval(checkAndRun, ONE_HOUR_MS);
