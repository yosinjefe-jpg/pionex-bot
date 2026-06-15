const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

// Cargar variables de entorno desde el archivo .env o usar process.env directamente en Docker/EasyPanel
function loadEnv() {
  if (process.env.PIONEX_API_KEY && process.env.PIONEX_API_SECRET) {
    return process.env;
  }
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) {
    console.warn("No se encontró el archivo .env ni variables de entorno.");
    return process.env; // Intentar caer en process.env
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
const PIONEX_API_KEY = env.PIONEX_API_KEY;
const PIONEX_API_SECRET = env.PIONEX_API_SECRET;
const NOTION_TOKEN = env.NOTION_TOKEN;
const NOTION_PAGE_ID = env.NOTION_PAGE_ID;

if (!PIONEX_API_KEY || !PIONEX_API_SECRET) {
  console.error("Faltan credenciales de Pionex en el archivo .env.");
  process.exit(1);
}

// Función robusta para reintentar peticiones en caso de fallos DNS/Red temporales
async function fetchWithRetry(url, options = {}, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`Petición fallida a ${url} (${err.message}). Reintentando en ${delay}ms... (${i + 1}/${retries})`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// Cliente firmado de Pionex
async function pionexRequest(pathUrl, method = "GET", body = null) {
  const timestamp = Date.now().toString();
  const baseUrl = "https://api.pionex.com";
  
  const params = { timestamp };
  const sortedKeys = Object.keys(params).sort();
  const queryString = sortedKeys.map((k) => `${k}=${params[k]}`).join("&");
  const fullPath = `${pathUrl}?${queryString}`;
  
  let payload = `${method}${fullPath}`;
  let bodyJson = null;
  if (body) {
    bodyJson = JSON.stringify(body);
    payload += bodyJson;
  }
  
  const signature = crypto.createHmac("sha256", PIONEX_API_SECRET).update(payload).digest("hex");
  const url = `${baseUrl}${fullPath}`;
  const headers = {
    "PIONEX-KEY": PIONEX_API_KEY,
    "PIONEX-SIGNATURE": signature,
    "Content-Type": "application/json",
  };
  
  const options = { method, headers };
  if (bodyJson) options.body = bodyJson;
  
  const res = await fetchWithRetry(url, options);
  return await res.json();
}

// Consultas de mercado
async function getTickers(symbols) {
  const res = await fetchWithRetry("https://api.pionex.com/api/v1/market/tickers");
  const json = await res.json();
  const map = {};
  for (const t of json.data.tickers) {
    if (symbols.includes(t.symbol)) {
      map[t.symbol] = t;
    }
  }
  return map;
}

// Analizar Klines para recomendaciones
async function get30dStats(symbol) {
  const url = `https://api.pionex.com/api/v1/market/klines?symbol=${symbol}&interval=1D&limit=30`;
  const res = await fetchWithRetry(url);
  const data = await res.json();
  if (!data.data || !data.data.klines) return null;
  
  let min = Infinity;
  let max = -Infinity;
  let sumClose = 0;
  const closes = [];

  for (const k of data.data.klines) {
    const high = parseFloat(k.high);
    const low = parseFloat(k.low);
    const close = parseFloat(k.close);
    if (low < min) min = low;
    if (high > max) max = high;
    closes.push(close);
    sumClose += close;
  }
  return {
    current: closes[0],
    min,
    max,
    avg: sumClose / data.data.klines.length
  };
}

async function main() {
  console.log("Iniciando generación de reporte estratégico...");
  
  // 1. Obtener Balances
  const balanceData = await pionexRequest("/api/v1/account/balances");
  const freeUSDT = balanceData.data?.balances?.find(b => b.coin === "USDT")?.free || "0";
  
  // 2. Obtener Bots Activos
  const botsData = await pionexRequest("/api/v1/bot/orders", "GET");
  const runningBots = botsData.data?.results?.filter(b => b.buOrderData.status === "running") || [];
  
  // 3. Obtener Tickers de Mercado
  const tickers = await getTickers(["BTC_USDT", "ETH_USDT", "SOL_USDT", "AVAX_USDT", "ADA_USDT", "LINK_USDT"]);
  
  // 4. Analizar monedas candidatas para inversión
  const avaxStats = await get30dStats("AVAX_USDT");
  const adaStats = await get30dStats("ADA_USDT");
  const linkStats = await get30dStats("LINK_USDT");
  
  console.log(`Balances y bots recuperados. Bots corriendo: ${runningBots.length}`);
  
  // Construir reporte
  const dateStr = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  
  // Bloques de Notion
  const children = [
    {
      object: "block",
      type: "heading_1",
      heading_1: {
        rich_text: [{ type: "text", text: { content: "📈 Reporte Estratégico de Inversión" } }]
      }
    },
    {
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [
          { type: "text", text: { content: `Fecha de generación: ` } },
          { type: "text", text: { content: dateStr }, annotations: { bold: true } }
        ]
      }
    },
    {
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "💼 Estado del Portafolio y Balances" } }]
      }
    },
    {
      object: "block",
      type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: [
          { type: "text", text: { content: "Saldo Libre en Cuenta: " } },
          { type: "text", text: { content: `${parseFloat(freeUSDT).toFixed(2)} USDT` }, annotations: { bold: true, code: true } }
        ]
      }
    },
    {
      object: "block",
      type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: [
          { type: "text", text: { content: "Bots Activos en Ejecución: " } },
          { type: "text", text: { content: `${runningBots.length}` }, annotations: { bold: true } }
        ]
      }
    },
    {
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "🤖 Rendimiento Detallado de los Bots Activos" } }]
      }
    }
  ];

  if (runningBots.length === 0) {
    children.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [{ type: "text", text: { content: "No hay bots activos en este momento." }, annotations: { italic: true } }]
      }
    });
  } else {
    runningBots.forEach((bot, index) => {
      const d = bot.buOrderData;
      const profit = parseFloat(d.gridProfit || "0");
      const realized = parseFloat(d.totalRealizedProfit || "0");
      const currentPrice = tickers[bot.base.replace(".PERP", "_USDT")]?.close || d.initPrice;
      
      children.push(
        {
          object: "block",
          type: "heading_3",
          heading_3: {
            rich_text: [{ type: "text", text: { content: `Bot #${index + 1}: ${bot.base} (${d.trend.toUpperCase()} ${d.leverage}x)` } }]
          }
        },
        {
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [
              { type: "text", text: { content: "Inversión Inicial: " } },
              { type: "text", text: { content: `${d.initUsdtInvestment} USDT` }, annotations: { bold: true } }
            ]
          }
        },
        {
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [
              { type: "text", text: { content: "Rango del Bot: " } },
              { type: "text", text: { content: `${d.bottom} - ${d.top} USDT` }, annotations: { bold: true } }
            ]
          }
        },
        {
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [
              { type: "text", text: { content: "Precio de Entrada: " } },
              { type: "text", text: { content: `${d.initPrice} USDT` } },
              { type: "text", text: { content: " | Precio Actual: " } },
              { type: "text", text: { content: `${currentPrice} USDT` }, annotations: { bold: true } }
            ]
          }
        },
        {
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [
              { type: "text", text: { content: "Ganancia de Grilla (Grid Profit): " } },
              { type: "text", text: { content: `+${profit.toFixed(4)} USDT` }, annotations: { bold: true, color: "green" } }
            ]
          }
        },
        {
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [
              { type: "text", text: { content: "Ganancia Realizada Total: " } },
              { type: "text", text: { content: `${realized.toFixed(4)} USDT` }, annotations: { bold: true } }
            ]
          }
        },
        {
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: [
              { type: "text", text: { content: "Precio de Liquidación Estimado: " } },
              { type: "text", text: { content: `${d.estimateLiquidationPriceDown || "N/A"} USDT` }, annotations: { color: "red", bold: true } }
            ]
          }
        }
      );
    });
  }

  // Agregar Sección de Propuestas
  children.push(
    {
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "🔍 Análisis de Oportunidades y Sugerencia de Tercer Bot" } }]
      }
    },
    {
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [{ type: "text", text: { content: "Evaluando el mercado actual, la tendencia general es de estabilización cerca de soportes mensuales clave. A continuación se detallan las 3 opciones de diversificación para tu portafolio en LONG con apalancamiento 3x:" } }]
      }
    }
  );

  // Helper para armar bloques de propuesta
  function pushOptionBlocks(name, stats, suggestBottom, suggestTop, desc) {
    if (!stats) return;
    const bouncePct = ((stats.avg - stats.current) / stats.current) * 100;
    children.push(
      {
        object: "block",
        type: "heading_3",
        heading_3: {
          rich_text: [{ type: "text", text: { content: `Opción: ${name} (Recomendado)` } }]
        }
      },
      {
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [
            { type: "text", text: { content: "Precio Actual: " } },
            { type: "text", text: { content: `${stats.current} USDT` }, annotations: { bold: true } },
            { type: "text", text: { content: ` | Rango 30d: ${stats.min} - ${stats.max} USDT` } }
          ]
        }
      },
      {
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [
            { type: "text", text: { content: "Rango Recomendado: " } },
            { type: "text", text: { content: `${suggestBottom.toFixed(3)} - ${suggestTop.toFixed(3)} USDT` }, annotations: { bold: true, code: true } }
          ]
        }
      },
      {
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [
            { type: "text", text: { content: "Potencial de retorno a la media (promedio 30d): " } },
            { type: "text", text: { content: `+${bouncePct.toFixed(1)}%` }, annotations: { bold: true } },
            { type: "text", text: { content: ` (x3 apalancamiento = ` } },
            { type: "text", text: { content: `+${(bouncePct * 3).toFixed(1)}%` }, annotations: { bold: true } },
            { type: "text", text: { content: `)` } }
          ]
        }
      },
      {
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: desc } }]
        }
      }
    );
  }

  pushOptionBlocks(
    "AVAX (Avalanche)",
    avaxStats,
    avaxStats.min * 0.98,
    avaxStats.max * 1.02,
    "Avalanche muestra una alta volatilidad diaria (Beta alto). Es ideal para un bot de futuros de grilla ya que el rebote a la media de 8.96 USDT ofrece una rentabilidad muy atractiva y su soporte mensual en los 6.22 USDT ha sido muy sólido en las últimas semanas."
  );

  pushOptionBlocks(
    "ADA (Cardano)",
    adaStats,
    adaStats.min * 0.98,
    adaStats.max * 1.02,
    "Cardano es una opción conservadora con la mayor desviación con respecto a su precio medio de 30 días (+50% de retorno potencial directo). Su precio está consolidando en mínimos mensuales de 0.148 USDT."
  );

  pushOptionBlocks(
    "LINK (Chainlink)",
    linkStats,
    linkStats.min * 0.98,
    linkStats.max * 1.02,
    "Chainlink es el oráculo líder y muestra una excelente correlación defensiva en el mercado. Con soporte firme en los 7.00 USDT, la estrategia LONG 3x tiene un excelente margen de seguridad y liquidación por debajo de los 4.50 USDT."
  );

  // Enviar a Notion si las llaves están configuradas
  if (NOTION_TOKEN && NOTION_PAGE_ID) {
    console.log("Enviando reporte a Notion...");
    try {
      const response = await fetchWithRetry("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${NOTION_TOKEN}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          parent: { page_id: NOTION_PAGE_ID },
          properties: {
            title: [
              {
                text: {
                  content: `Reportes rendimiento BOTS - ${new Date().toLocaleDateString("es-ES")}`
                }
              }
            ]
          },
          children: children
        })
      });
      const resJson = await response.json();
      if (response.ok) {
        console.log("Reporte publicado con éxito en Notion. ID de Página:", resJson.id);
      } else {
        console.error("Error al publicar en Notion:", resJson);
      }
    } catch (e) {
      console.error("Error en petición a Notion:", e);
    }
  } else {
    console.log("Reporte generado localmente. NOTION_TOKEN o NOTION_PAGE_ID no configurados en .env.");
    // Imprimir el reporte para debug local
    console.log(JSON.stringify(children, null, 2));
  }
}

if (require.main === module) {
  main().catch(console.error);
}
