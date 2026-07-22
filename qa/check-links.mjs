import { readFile } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const urls = [...new Set([...html.matchAll(/href="(https?:\/\/[^"#]+)"/g)].map((match) => match[1]))];

async function check(url) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (reference-link-audit)" },
      signal: AbortSignal.timeout(20000)
    });
    await response.body?.cancel();
    return { url, status: response.status, finalUrl: response.url };
  } catch (error) {
    return { url, status: "ERROR", error: error.message };
  }
}

const results = [];
for (let index = 0; index < urls.length; index += 6) {
  results.push(...await Promise.all(urls.slice(index, index + 6).map(check)));
}

const broken = results.filter(({ status }) => status === 404 || status === 410);
const accessControlled = results.filter(({ status }) => status === 401 || status === 403 || status === 429);
const unverified = results.filter(({ status }) => status === "ERROR" || status >= 500);
process.stdout.write(JSON.stringify({ checked: results.length, broken, accessControlled, unverified, results }, null, 2));
process.exitCode = broken.length ? 1 : 0;
