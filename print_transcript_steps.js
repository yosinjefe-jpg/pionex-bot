const fs = require("node:fs");
const readline = require("readline");

async function run() {
  const fileStream = fs.createReadStream("C:/Users/usuario/.gemini/antigravity/brain/c44dc76b-b96a-44c3-8c88-461ee4a19cf4/.system_generated/logs/transcript.jsonl");
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  console.log("Printing steps 244 to 275...");
  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    if (lineCount >= 244 && lineCount <= 275) {
      const parsed = JSON.parse(line);
      console.log(`\n--- STEP ${parsed.step_index} (${parsed.source}) ---`);
      console.log(parsed.content || (parsed.tool_calls ? JSON.stringify(parsed.tool_calls) : ""));
    }
  }
}

run().catch(console.error);
