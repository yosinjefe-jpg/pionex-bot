const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

// Cargar variables de entorno
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

async function pionexPost(endpointPath, body) {
  const timestamp = Date.now().toString();
  const bodyJson = JSON.stringify(body);
  const params = { timestamp };
  const sortedKeys = Object.keys(params).sort();
  const queryString = sortedKeys.map((k) => `${k}=${params[k]}`).join("&");
  const pathUrl = `${endpointPath}?${queryString}`;
  const payload = `POST${pathUrl}${bodyJson}`;
  
  const signature = crypto.createHmac("sha256", PIONEX_API_SECRET).update(payload).digest("hex");
  const url = `${baseUrl}${pathUrl}`;
  const headers = {
    "PIONEX-KEY": PIONEX_API_KEY,
    "PIONEX-SIGNATURE": signature,
    "Content-Type": "application/json",
  };

  const res = await fetch(url, { method: "POST", headers, body: bodyJson });
  return await res.json();
}

async function run() {
  const symbol = "LINK.PERP";
  const bottom = "6.8";
  const top = "9.2";
  const rows = 90;
  const leverage = 3;
  const investment = "45";

  console.log(`\n1. Validando parámetros para bot de ${symbol}...`);
  const checkRes = await pionexPost("/api/v1/bot/orders/futuresGrid/checkParams", {
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

  console.log(`\n2. Parámetros válidos. Creando bot de ${symbol} con rango ${bottom}-${top} USDT...`);
  const createRes = await pionexPost("/api/v1/bot/orders/futuresGrid/create", {
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
    console.log("🚀 ¡Bot de Chainlink creado con éxito en Pionex!");
  } else {
    console.error("❌ Error al crear el bot de Chainlink en Pionex.");
  }
}

run().catch(console.error);
