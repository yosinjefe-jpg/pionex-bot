const fs = require("node:fs");
const path = require("node:path");

function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) {
    return process.env;
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
const NOTION_TOKEN = env.NOTION_TOKEN;
const NOTION_PAGE_ID = env.NOTION_PAGE_ID;

async function test() {
  console.log("Fetching Notion page children for ID:", NOTION_PAGE_ID);
  const response = await fetch(`https://api.notion.com/v1/blocks/${NOTION_PAGE_ID}/children?page_size=100`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${NOTION_TOKEN}`,
      "Notion-Version": "2022-06-28"
    }
  });
  const data = await response.json();
  console.log("Status:", response.status);
  if (response.ok) {
    console.log("Children count:", data.results.length);
    const pages = data.results.filter(b => b.type === "child_page");
    console.log("Child pages count:", pages.length);
    pages.forEach(p => {
      console.log(`Page: ${p.child_page.title} | ID: ${p.id} | Created: ${p.created_time}`);
    });
  } else {
    console.error("Notion Error:", data);
  }
}

test().catch(console.error);
