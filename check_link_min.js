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

async function check(rows) {
  const symbol = "LINK.PERP";
  const bottom = "6.8";
  const top = "9.2";
  const leverage = 3;
  const investment = "47.83";

  const res = await pionexPost("/api/v1/bot/orders/futuresGrid/checkParams", {
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

  if (res.result) {
    console.log(`Rows ${rows}: SUCCESS. Min Inv required: ${res.data.minInvestment} USDT. Est. Liq Down: ${res.data.estimateLiquidationPriceDown} USDT`);
  } else {
    console.log(`Rows ${rows}: FAILED. Error: ${JSON.stringify(res)}`);
  }
}

async function run() {
  console.log("Checking LINK.PERP grid options for investment of 47.83 USDT...");
  await check(90);
  await check(70);
  await check(50);
  await check(40);
  await check(30);
}

run().catch(console.error);
