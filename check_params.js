const crypto = require("node:crypto");

const apiKey = "3Pzbj3HQjmDc3gCAyDZcMncEQMvMdLQySde4c2iAez6mnjKg8AveQQWyGopMadZJU3";
const apiSecret = "Vg37l6puwLeGch40D2Q3DYvuzL0IR7Nv6gYQ7W2QfWuGyzqLYlVQ73p3xleCrUX0";
const baseUrl = "https://api.pionex.com";
const path = "/api/v1/bot/orders/futuresGrid/checkParams";

async function check(symbol, bottom, top, rows, leverage, investment) {
  const timestamp = Date.now().toString();
  
  const body = {
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
  };

  const bodyJson = JSON.stringify(body);
  const params = { timestamp };
  const sortedKeys = Object.keys(params).sort();
  const queryString = sortedKeys.map((k) => `${k}=${params[k]}`).join("&");
  const pathUrl = `${path}?${queryString}`;
  const payload = `POST${pathUrl}${bodyJson}`;
  const signature = crypto.createHmac("sha256", apiSecret).update(payload).digest("hex");

  const url = `${baseUrl}${pathUrl}`;
  const headers = {
    "PIONEX-KEY": apiKey,
    "PIONEX-SIGNATURE": signature,
    "Content-Type": "application/json",
  };

  const res = await fetch(url, { method: "POST", headers, body: bodyJson });
  const data = await res.json();
  console.log(`ETH (${bottom}-${top}, rows ${rows}, leverage ${leverage}x, inv ${investment}) Response:`, JSON.stringify(data, null, 2));
}

async function run() {
  // Option 1: Conservative (Wide) - 5x leverage, 70 rows
  await check("ETH.PERP", "1500", "2100", 70, 5, "100");
  // Option 2: Moderate (Medium) - 5x leverage, 90 rows
  await check("ETH.PERP", "1550", "1950", 90, 5, "100");
  // Option 3: Aggressive (Narrow) - 5x leverage, 90 rows
  await check("ETH.PERP", "1600", "1850", 90, 5, "100");
  
  // Checking with 10x leverage as comparison
  await check("ETH.PERP", "1550", "1950", 90, 10, "100");
}

run().catch(console.error);
