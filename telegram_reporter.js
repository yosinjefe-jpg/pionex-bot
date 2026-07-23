const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

// Cargar variables de entorno
function loadEnv() {
  if (process.env.PIONEX_API_KEY && process.env.PIONEX_API_SECRET) {
    return process.env;
  }
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) {
    console.warn("No se encontró el archivo .env.");
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
const PIONEX_API_KEY = env.PIONEX_API_KEY;
const PIONEX_API_SECRET = env.PIONEX_API_SECRET;
const TELEGRAM_BOT_TOKEN = env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error("❌ Faltan las variables TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID.");
  process.exit(1);
}

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

async function translateText(text) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=${encodeURIComponent(text)}`;
  try {
    const res = await fetchWithRetry(url);
    const json = await res.json();
    return json[0].map(s => s[0]).join("");
  } catch (e) {
    console.error("Error al traducir texto:", e.message);
    return text;
  }
}

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

// Obtener tickers de mercado
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

// Obtener noticias de regulación desde el RSS de CoinTelegraph
async function getRegNews() {
  const url = "https://cointelegraph.com/rss";
  const news = [];
  try {
    const res = await fetchWithRetry(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    });
    if (!res.ok) return news;
    const xml = await res.text();
    
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    const keywords = ["clarity", "regulation", "sec", "cftc", "senate", "law", "stablecoin", "regulación", "ley", "congreso"];
    
    while ((match = itemRegex.exec(xml)) !== null && news.length < 3) {
      const itemContent = match[1];
      const title = (itemContent.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) || itemContent.match(/<title>([\s\S]*?)<\/title>/))?.[1] || "No Title";
      let link = itemContent.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "";
      if (link.includes("<![CDATA[")) {
        link = link.replace("<![CDATA[", "").replace("]]>", "");
      }
      
      const titleLower = title.toLowerCase();
      const matchesKeyword = keywords.some(kw => titleLower.includes(kw));
      
      if (matchesKeyword) {
        const descMatch = itemContent.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) || itemContent.match(/<description>([\s\S]*?)<\/description>/);
        let descText = descMatch ? descMatch[1] : "Sin descripción disponible.";
        descText = descText.replace(/<\/?[^>]+(>|$)/g, ""); // Eliminar HTML
        descText = descText.replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
        if (descText.length > 220) {
          descText = descText.slice(0, 217) + "...";
        }
        const translatedTitle = await translateText(title.trim());
        const translatedDesc = await translateText(descText);
        news.push({ title: translatedTitle, link: link.trim(), description: translatedDesc });
      }
    }
  } catch (e) {
    console.error("Error al obtener noticias RSS:", e.message);
  }
  return news;
}

// Enviar mensaje a Telegram usando formato HTML
async function sendTelegram(htmlMessage) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    const response = await fetchWithRetry(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: htmlMessage,
        parse_mode: "HTML",
        disable_web_page_preview: true
      })
    });
    const resJson = await response.json();
    if (response.ok) {
      console.log("✅ Reporte enviado a Telegram correctamente.");
    } else {
      console.error("❌ Error de Telegram API:", resJson);
    }
  } catch (e) {
    console.error("❌ Error al enviar mensaje a Telegram:", e.message);
  }
}

function getSuggestion(bot, currentPrice, profitPct, realized, profit, estLiq, ticker, hasRegulatoryNews) {
  const d = bot.buOrderData;
  const top = parseFloat(d.top);
  const bottom = parseFloat(d.bottom);
  const rows = parseInt(d.row);
  const liq = parseFloat(estLiq);
  
  const gridRange = top - bottom;
  const gridSpacingPct = (gridRange / bottom / rows) * 100;
  
  let dailyVol = 0;
  let dailyChange = 0;
  if (ticker) {
    const high = parseFloat(ticker.high);
    const low = parseFloat(ticker.low);
    dailyVol = ((high - low) / low) * 100;
    dailyChange = parseFloat(ticker.change || "0") * 100;
  }
  
  let advice = [];
  
  // 1. Gestión de Volatilidad
  if (dailyVol > 7) {
    advice.push(`⚠️ Volatilidad alta (${dailyVol.toFixed(1)}% en 24h). Mantén apalancamiento conservador. Espaciamiento de grillas actual: ${gridSpacingPct.toFixed(2)}%`);
  } else if (dailyVol < 3.5 && dailyVol > 0) {
    advice.push(`⚡ Baja volatilidad (${dailyVol.toFixed(1)}%). Zona ideal para acumulación de micro-arbitraje`);
  }
  
  // 2. Liquidación y Margen de Seguridad
  if (!isNaN(liq) && liq > 0) {
    const distLiqPct = ((currentPrice - liq) / currentPrice) * 100;
    if (distLiqPct < 18) {
      advice.push(`🚨 ALTA VULNERABILIDAD: Precio a solo ${distLiqPct.toFixed(1)}% de la liquidación (${liq.toFixed(2)}). Se sugiere inyectar margen extra de inmediato`);
    } else if (distLiqPct > 40) {
      advice.push(`🛡️ Liquidación muy protegida (distancia >40% a ${liq.toFixed(2)})`);
    }
  }
  
  // 3. Posición dentro de la Cuadrícula
  const positionPct = ((currentPrice - bottom) / gridRange) * 100;
  if (positionPct > 90) {
    advice.push(`📈 TOMA DE BENEFICIOS: Bot al ${positionPct.toFixed(0)}% del rango. Inventario casi agotado (convertido a USDT). Se sugiere cerrar de forma manual para asegurar el +${profitPct.toFixed(1)}% neto y reconfigurar una grilla con rango superior`);
  } else if (positionPct < 10) {
    advice.push(`📉 ACUMULACIÓN MÁXIMA: Bot al ${positionPct.toFixed(0)}% del rango (suelo). Inventario de compra al máximo. No cierres si confías en el soporte; de lo contrario, evalúa Stop Loss`);
  } else {
    advice.push(`⚖️ Grilla equilibrada (actualmente al ${positionPct.toFixed(0)}% del rango)`);
  }
  
  // 4. Momentum y Tendencia de Mercado
  if (dailyChange > 5) {
    advice.push(`🚀 Fuerte impulso alcista (+${dailyChange.toFixed(1)}%). El bot largo capitaliza bien la tendencia`);
  } else if (dailyChange < -5) {
    advice.push(`🩸 Caída de mercado (-${dailyChange.toFixed(1)}%). Mayor drawdown temporal; vigila el margen libre`);
  }
  
  // 5. Impacto Regulatorio (Noticias de Ley CLARITY)
  if (hasRegulatoryNews) {
    advice.push(`📰 Incertidumbre regulatoria activa (Ley CLARITY en el Senado). Evita abrir grillas con apalancamiento >3x`);
  }
  
  // 6. Eficiencia de Cobertura de Grilla
  const floatPnL = realized - profit;
  if (floatPnL < -15 && realized < 0) {
    advice.push(`💸 El Arbitraje de Grilla (+${profit.toFixed(1)} USDT) está absorbiendo pérdidas flotantes. Mantén la calma, la grilla está amortiguando la corrección`);
  }
  
  return advice.join(" | ");
}

async function main() {
  console.log("Generando reporte diario para Telegram...");
  
  // 1. Obtener saldos y bots de Pionex
  const balanceData = await pionexRequest("/api/v1/account/balances");
  const freeUSDT = balanceData.data?.balances?.find(b => b.coin === "USDT")?.free || "0";
  
  const botsData = await pionexRequest("/api/v1/bot/orders", "GET");
  const runningBots = botsData.data?.results?.filter(b => b.buOrderData.status === "running") || [];
  
  const tickers = await getTickers(["BTC_USDT", "ETH_USDT", "SOL_USDT", "AVAX_USDT", "LINK_USDT"]);
  
  // 2. Obtener noticias reguladoras recientes
  const news = await getRegNews();
  
  // 3. Formatear mensaje HTML
  let msg = `<b>📈 REPORT DIARIO DE RENDIMIENTO Y REGULACIÓN</b>\n`;
  msg += `<i>Fecha: ${new Date().toLocaleString("es-ES", { timeZone: "America/Bogota" })}</i>\n\n`;
  
  msg += `<b>💼 Balance del Portafolio:</b>\n`;
  msg += `• Saldo Libre: <code>${parseFloat(freeUSDT).toFixed(2)} USDT</code>\n`;
  msg += `• Bots en ejecución: <b>${runningBots.length}</b>\n\n`;
  
  msg += `<b>🤖 Rendimiento de los Bots:</b>\n`;
  
  for (const bot of runningBots) {
    const d = bot.buOrderData;
    const symbol = bot.base.replace(".PERP", "_USDT");
    const tick = tickers[symbol];
    const currentPrice = tick ? parseFloat(tick.close) : parseFloat(d.initPrice);
    
    // Obtener detalles adicionales del bot
    const detPath = "/api/v1/bot/orders/futuresGrid/order";
    const timestamp = Date.now().toString();
    const q = { buOrderId: bot.buOrderId, timestamp };
    const sortedKeys = Object.keys(q).sort();
    const queryString = sortedKeys.map((k) => `${k}=${q[k]}`).join("&");
    const fullPath = `${detPath}?${queryString}`;
    const payload = `GET${fullPath}`;
    const signature = crypto.createHmac("sha256", PIONEX_API_SECRET).update(payload).digest("hex");
    const url = `https://api.pionex.com${fullPath}`;
    const headers = {
      "PIONEX-KEY": PIONEX_API_KEY,
      "PIONEX-SIGNATURE": signature,
      "Content-Type": "application/json",
    };
    
    let profit = parseFloat(d.gridProfit || "0");
    let realized = parseFloat(d.totalRealizedProfit || "0");
    let estLiq = d.estimateLiquidationPriceDown || "N/A";
    
    try {
      const detRes = await fetchWithRetry(url, { headers });
      const detJson = await detRes.json();
      if (detJson.data?.buOrderData) {
        const fullData = detJson.data.buOrderData;
        profit = parseFloat(fullData.gridProfit || "0");
        realized = parseFloat(fullData.totalRealizedProfit || "0");
        estLiq = fullData.estimateLiquidationPriceDown || "N/A";
      }
    } catch (e) {
      // Usar datos básicos si falla
    }
    
    const invest = parseFloat(d.initUsdtInvestment || "0");
    const profitPct = (realized / invest) * 100;
    const sign = realized >= 0 ? "+" : "";
    
    const hasRegNews = news.length > 0;
    const suggestion = getSuggestion(bot, currentPrice, profitPct, realized, profit, estLiq, tick, hasRegNews);
    msg += `• <b>${bot.base} (${d.trend.toUpperCase()} ${d.leverage}x)</b>\n`;
    msg += `  Grilla: <code>+${profit.toFixed(2)} USDT</code>\n`;
    msg += `  Neto: <b>${sign}${realized.toFixed(2)} USDT (${sign}${profitPct.toFixed(2)}%)</b>\n`;
    msg += `  Precio: ${currentPrice.toFixed(3)} | Liq: <pre>${parseFloat(estLiq).toFixed(2)} USDT</pre>\n`;
    msg += `  💡 <i>Sugerencia: ${suggestion}</i>\n\n`;
  }
  
  msg += `<b>📰 Noticias de Regulación y Ley CLARITY:</b>\n`;
  if (news.length === 0) {
    msg += `• No se detectaron noticias reguladoras urgentes en las últimas horas.\n`;
  } else {
    news.forEach(n => {
      msg += `• <a href="${n.link}"><b>${n.title}</b></a>\n  <i>${n.description}</i>\n\n`;
    });
  }
  
  msg += `\n<i>Bot autocurativo en la nube - EasyPanel</i>`;
  
  // 4. Enviar a Telegram
  await sendTelegram(msg);
}

if (require.main === module) {
  main().catch(console.error);
}
