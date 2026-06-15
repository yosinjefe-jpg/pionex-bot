const coins = ["BTC_USDT", "ETH_USDT", "SOL_USDT", "DOGE_USDT", "NEAR_USDT", "LINK_USDT", "AVAX_USDT", "XRP_USDT", "BNB_USDT", "ADA_USDT"];

async function run() {
  console.log("Analyzing tickers...");
  const tickersRes = await fetch("https://api.pionex.com/api/v1/market/tickers");
  const tickersData = await tickersRes.json();
  const tickerMap = {};
  for (const t of tickersData.data.tickers) {
    if (coins.includes(t.symbol)) {
      tickerMap[t.symbol] = t;
    }
  }

  console.log("\nResults:");
  for (const sym of coins) {
    const t = tickerMap[sym];
    if (!t) {
      console.log(`${sym}: No data`);
      continue;
    }
    const openPrice = parseFloat(t.open);
    const closePrice = parseFloat(t.close);
    const changePct = ((closePrice - openPrice) / openPrice) * 100;
    const vol = parseFloat(t.volume);
    const amt = parseFloat(t.amount);
    console.log(`${sym}: Price = ${closePrice}, 24h Change = ${changePct.toFixed(2)}%, Volume = ${vol.toFixed(0)}, Amount = $${(amt / 1e6).toFixed(2)}M`);
  }
}

run().catch(console.error);
