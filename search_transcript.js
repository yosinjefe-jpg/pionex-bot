const fs = require("node:fs");
const readline = require("readline");

async function run() {
  const fileStream = fs.createReadStream("C:/Users/usuario/.gemini/antigravity/brain/8da3a8fd-9c54-4cb6-8b87-8e1c8ea26e51/.system_generated/logs/transcript.jsonl");
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const outPath = "C:/Users/usuario/.gemini/antigravity/scratch/pionex-bot/search_results_git.txt";
  const outStream = fs.createWriteStream(outPath);
  outStream.write("Searching transcript for git and repository keywords...\n");
  
  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    try {
      const obj = JSON.parse(line);
      if (obj.type === "USER_INPUT" || obj.type === "PLANNER_RESPONSE") {
        const textToSearch = (obj.content || "").toLowerCase();
        if (textToSearch.includes("cripto-analista") || textToSearch.includes("git") || textToSearch.includes("repo") || textToSearch.includes("github")) {
          outStream.write(`--- Step ${obj.step_index} (${obj.source} / ${obj.type}) ---\n`);
          outStream.write(`Content: ${obj.content}\n\n`);
        }
      }
    } catch (e) {
      // Ignorar
    }
  }
  outStream.end();
  console.log("Finished writing search results to:", outPath);
}

run().catch(console.error);
