const { readFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");
const { homedir } = require("node:os");

// We can just install smol-toml locally to test, or we can use our own parser/console.log.
const path = join(homedir(), ".pionex", "config.toml");
console.log("Config path exists:", existsSync(path));
if (existsSync(path)) {
  const raw = readFileSync(path, "utf-8");
  console.log("Raw config contents:\n", raw);
}
