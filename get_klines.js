async function fetchWithRetry(url, options = {}, retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function analyzeCoin(symbol) {
  const url = `https://api.pionex.com/api/v1/market/klines?symbol=${symbol}&interval=1D&limit=30`;
  const res = await fetchWithRetry(url);
  const data = await res.json();
  if (!data.data || !data.data.klines) {
    console.log(`${symbol}: No kline data`);
    return;
  }
  const klines = data.data.klines;
  let min = Infinity;
  let max = -Infinity;
  let sumClose = 0;
  const closes = [];

  for (const k of klines) {
    const high = parseFloat(k.high);
    const low = parseFloat(k.low);
    const close = parseFloat(k.close);
    if (low < min) min = low;
    if (high > max) max = high;
    closes.push(close);
    sumClose += close;
  }

  const avg = sumClose / klines.length;
  const current = closes[0];

  console.log(`\nAnalysis for ${symbol} (last 30 days):`);
  console.log(`  Current Price: ${current}`);
  console.log(`  30d Low: ${min}`);
  console.log(`  30d High: ${max}`);
  console.log(`  30d Avg: ${avg.toFixed(4)}`);
  
  const bottomSuggest = min * 0.98;
  const topSuggest = max * 1.02;
  console.log(`  Suggested Range (Bottom): ${bottomSuggest.toFixed(4)}`);
  console.log(`  Suggested Range (Top): ${topSuggest.toFixed(4)}`);
}

async function run() {
  await analyzeCoin("ETH_USDT");
}

run().catch(console.error);
