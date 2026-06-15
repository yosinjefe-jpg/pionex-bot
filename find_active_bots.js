const crypto = require("node:crypto");

const apiKey = "3Pzbj3HQjmDc3gCAyDZcMncEQMvMdLQySde4c2iAez6mnjKg8AveQQWyGopMadZJU3";
const apiSecret = "Vg37l6puwLeGch40D2Q3DYvuzL0IR7Nv6gYQ7W2QfWuGyzqLYlVQ73p3xleCrUX0";
const baseUrl = "https://api.pionex.com";
const path = "/api/v1/bot/orders";

async function run() {
  const timestamp = Date.now().toString();
  const q = { status: "running" };
  const sortedKeys = Object.keys(q).sort();
  const queryString = sortedKeys.map((k) => `${k}=${q[k]}`).join("&");
  const fullPath = `${path}?${queryString}&timestamp=${timestamp}`;
  
  const payload = `GET${fullPath}`;
  const signature = crypto.createHmac("sha256", apiSecret).update(payload).digest("hex");
  
  const url = `${baseUrl}${fullPath}`;
  const headers = {
    "PIONEX-KEY": apiKey,
    "PIONEX-SIGNATURE": signature,
    "Content-Type": "application/json",
  };
  
  const res = await fetch(url, { headers });
  const data = await res.json();
  console.log("Running bots found:");
  if (data.data && data.data.results) {
    for (const b of data.data.results) {
      console.log(`- Base: ${b.base}, Quote: ${b.quote}, Type: ${b.buOrderType}, ID: ${b.buOrderId}, Status: ${b.buOrderData.status}`);
    }
  } else {
    console.log("No results or error:", JSON.stringify(data, null, 2));
  }
}

run().catch(console.error);
