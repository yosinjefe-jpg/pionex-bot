const crypto = require("node:crypto");

const apiKey = "3Pzbj3HQjmDc3gCAyDZcMncEQMvMdLQySde4c2iAez6mnjKg8AveQQWyGopMadZJU3";
const apiSecret = "Vg37l6puwLeGch40D2Q3DYvuzL0IR7Nv6gYQ7W2QfWuGyzqLYlVQ73p3xleCrUX0";
const baseUrl = "https://api.pionex.com";
const path = "/api/v1/account/balances";

const timestamp = Date.now().toString();
const params = { timestamp };

const sortedKeys = Object.keys(params).sort();
const queryString = sortedKeys.map((k) => `${k}=${params[k]}`).join("&");
const pathUrl = `${path}?${queryString}`;

const payload = `GET${pathUrl}`;
const signature = crypto.createHmac("sha256", apiSecret).update(payload).digest("hex");

const url = `${baseUrl}${pathUrl}`;
const headers = {
  "PIONEX-KEY": apiKey,
  "PIONEX-SIGNATURE": signature,
  "Content-Type": "application/json",
};

console.log("Fetching URL:", url);
console.log("Headers:", headers);

fetch(url, { method: "GET", headers })
  .then(async (res) => {
    console.log("Status:", res.status);
    console.log("OK:", res.ok);
    const text = await res.text();
    console.log("Response text:", text);
  })
  .catch((err) => {
    console.error("Fetch failed:", err);
  });
