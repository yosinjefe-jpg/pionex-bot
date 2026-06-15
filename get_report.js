const crypto = require("node:crypto");

const apiKey = "3Pzbj3HQjmDc3gCAyDZcMncEQMvMdLQySde4c2iAez6mnjKg8AveQQWyGopMadZJU3";
const apiSecret = "Vg37l6puwLeGch40D2Q3DYvuzL0IR7Nv6gYQ7W2QfWuGyzqLYlVQ73p3xleCrUX0";
const baseUrl = "https://api.pionex.com";

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

async function pionexRequest(pathUrl, method = "GET", body = null) {
  const timestamp = Date.now().toString();
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
  
  const signature = crypto.createHmac("sha256", apiSecret).update(payload).digest("hex");
  const url = `${baseUrl}${fullPath}`;
  const headers = {
    "PIONEX-KEY": apiKey,
    "PIONEX-SIGNATURE": signature,
    "Content-Type": "application/json",
  };
  
  const options = { method, headers };
  if (bodyJson) options.body = bodyJson;
  
  const res = await fetchWithRetry(url, options);
  return await res.json();
}

async function run() {
  console.log("Fetching active bots...");
  const listRes = await pionexRequest("/api/v1/bot/orders");
  const running = listRes.data.results.filter(b => b.buOrderData.status === "running");
  
  // Fetch tickers
  const tickersRes = await fetchWithRetry("https://api.pionex.com/api/v1/market/tickers");
  const tickersData = await tickersRes.json();
  const tickerMap = {};
  for (const t of tickersData.data.tickers) {
    tickerMap[t.symbol] = t;
  }
  
  console.log("\n=======================================================");
  console.log("📋 REPORT DE RENDIMIENTO EN TIEMPO REAL - BOTS ACTIVOS");
  console.log("=======================================================");
  
  for (const bot of running) {
    const d = bot.buOrderData;
    const symbol = bot.base.replace(".PERP", "_USDT");
    const tick = tickerMap[symbol];
    const currentPrice = tick ? parseFloat(tick.close) : parseFloat(d.initPrice);
    
    // Fetch detailed bot info
    const detPath = "/api/v1/bot/orders/futuresGrid/order";
    const timestamp = Date.now().toString();
    const q = { buOrderId: bot.buOrderId, timestamp };
    const sortedKeys = Object.keys(q).sort();
    const queryString = sortedKeys.map((k) => `${k}=${q[k]}`).join("&");
    const fullPath = `${detPath}?${queryString}`;
    const payload = `GET${fullPath}`;
    const signature = crypto.createHmac("sha256", apiSecret).update(payload).digest("hex");
    const url = `${baseUrl}${fullPath}`;
    const headers = {
      "PIONEX-KEY": apiKey,
      "PIONEX-SIGNATURE": signature,
      "Content-Type": "application/json",
    };
    const detRes = await fetchWithRetry(url, { headers });
    const detJson = await detRes.json();
    const fullData = detJson.data?.buOrderData || d;
    
    const profit = parseFloat(fullData.gridProfit || "0");
    const realized = parseFloat(fullData.totalRealizedProfit || "0");
    const invest = parseFloat(fullData.initUsdtInvestment || "0");
    const profitPct = (realized / invest) * 100;
    
    console.log(`\n🤖 Bot: ${bot.base} (${fullData.trend.toUpperCase()} ${fullData.leverage}x)`);
    console.log(`  ID: ${bot.buOrderId}`);
    console.log(`  Inversión Inicial: ${invest.toFixed(2)} USDT (Margen Extra: ${fullData.initExtraMargin || "0"} USDT)`);
    console.log(`  Rango de Precios: ${fullData.bottom} - ${fullData.top} USDT (Grillas: ${fullData.row})`);
    console.log(`  Precio de Entrada: ${parseFloat(fullData.initPrice).toFixed(3)} | Precio Actual: ${currentPrice.toFixed(3)}`);
    console.log(`  Ganancia de Grilla (Grid Profit): +${profit.toFixed(4)} USDT`);
    console.log(`  Ganancia Realizada Total: +${realized.toFixed(4)} USDT (${profitPct.toFixed(2)}%)`);
    console.log(`  Órdenes Ejecutadas (Trades): ${fullData.closedExchangeOrderCount || 0} (${fullData.exchangeOrderPairedCount || 0} emparejadas)`);
    console.log(`  Precio de Liquidación Estimado: ${fullData.estimateLiquidationPriceDown || "N/A"} USDT`);
  }
  console.log("\n=======================================================");
}

run().catch(console.error);
