const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) {
    console.error("No se encontró el archivo .env.");
    process.exit(1);
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
const baseUrl = "https://api.pionex.com";

async function pionexRequest(endpointPath, method, body = null) {
  const timestamp = Date.now().toString();
  const bodyJson = body ? JSON.stringify(body) : null;
  const params = { timestamp };
  const sortedKeys = Object.keys(params).sort();
  const queryString = sortedKeys.map((k) => `${k}=${params[k]}`).join("&");
  const pathUrl = `${endpointPath}?${queryString}`;
  let payload = `${method}${pathUrl}`;
  if (bodyJson) {
    payload += bodyJson;
  }
  
  const signature = crypto.createHmac("sha256", PIONEX_API_SECRET).update(payload).digest("hex");
  const url = `${baseUrl}${pathUrl}`;
  const headers = {
    "PIONEX-KEY": PIONEX_API_KEY,
    "PIONEX-SIGNATURE": signature,
    "Content-Type": "application/json",
  };

  const options = { method, headers };
  if (bodyJson) {
    options.body = bodyJson;
  }

  const res = await fetch(url, options);
  return await res.json();
}

async function getBalance() {
  const data = await pionexRequest("/api/v1/account/balances", "GET");
  const usdt = data.data?.balances?.find(b => b.coin === "USDT");
  return usdt ? parseFloat(usdt.free) : 0;
}

async function run() {
  const oldBotId = "19c07a4c-99e0-4145-854d-095da99c4869";
  
  console.log(`\n1. Iniciando cancelación del bot antiguo de ETH (ID: ${oldBotId})...`);
  const cancelRes = await pionexRequest("/api/v1/bot/orders/futuresGrid/cancel", "POST", {
    buOrderId: oldBotId
  });

  console.log("Resultado de Cancelación:", JSON.stringify(cancelRes, null, 2));

  if (!cancelRes.result) {
    console.error("❌ No se pudo cancelar el bot antiguo. Abortando proceso.");
    return;
  }
  console.log("✅ Bot antiguo cancelado. Esperando 5 segundos para actualización de balance...");
  await new Promise((resolve) => setTimeout(resolve, 5000));

  console.log("\n2. Verificando saldo libre disponible...");
  let balance = await getBalance();
  console.log(`Saldo libre actual: ${balance.toFixed(2)} USDT`);

  if (balance < 150) {
    console.warn(`⚠️ Saldo libre (${balance.toFixed(2)} USDT) es menor a los 150 USDT requeridos.`);
    console.warn("Intentaremos abrir el bot con el saldo disponible menos 3 USDT como margen de seguridad.");
    // Ajustar inversión si es menor
    const investmentToUse = Math.floor(balance - 3);
    if (investmentToUse < 50) {
      console.error("❌ El saldo disponible es demasiado bajo para abrir una nueva grilla (mínimo sugerido ~50 USDT).");
      return;
    }
    console.log(`Usaremos un monto de inversión de: ${investmentToUse} USDT`);
    await launchNewBot(investmentToUse.toString());
  } else {
    await launchNewBot("150");
  }
}

async function launchNewBot(investment) {
  const symbol = "ETH.PERP";
  const bottom = "1750";
  const top = "2150";
  const rows = 90;
  const leverage = 5;

  console.log(`\n3. Validando parámetros para nuevo bot de ${symbol}...`);
  const checkRes = await pionexRequest("/api/v1/bot/orders/futuresGrid/checkParams", "POST", {
    base: symbol,
    quote: "USDT",
    buOrderData: {
      top: top,
      bottom: bottom,
      row: rows,
      grid_type: "arithmetic",
      trend: "long",
      leverage: leverage,
      quoteInvestment: investment
    }
  });

  console.log("Resultado de Validación:", JSON.stringify(checkRes, null, 2));

  if (!checkRes.result) {
    console.error("❌ La validación de parámetros falló. No se puede crear el bot.");
    return;
  }

  console.log(`\n4. Creando nuevo bot de ${symbol} en el rango ${bottom}-${top} USDT con inversión de ${investment} USDT...`);
  const createRes = await pionexRequest("/api/v1/bot/orders/futuresGrid/create", "POST", {
    base: symbol,
    quote: "USDT",
    buOrderData: {
      top: top,
      bottom: bottom,
      row: rows,
      grid_type: "arithmetic",
      trend: "long",
      leverage: leverage,
      quoteInvestment: investment
    }
  });

  console.log("\nResultado de Creación:", JSON.stringify(createRes, null, 2));
  if (createRes.result) {
    console.log("🚀 ¡Nuevo bot de Ethereum creado con éxito en Pionex!");
  } else {
    console.error("❌ Error al crear el nuevo bot de Ethereum en Pionex.");
  }
}

run().catch(console.error);
