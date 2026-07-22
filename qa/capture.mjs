import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outputDir = path.join(root, "qa", "renders");
const endpoint = process.env.CDP_ENDPOINT || "http://127.0.0.1:9223";
const deckUrl = process.env.DECK_URL || "http://127.0.0.1:4173/";
const slideCount = 20;

await mkdir(outputDir, { recursive: true });

async function waitForEndpoint() {
  let lastError;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${endpoint}/json/version`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`CDP indisponível em ${endpoint}: ${lastError || "timeout"}`);
}

await waitForEndpoint();
const targetResponse = await fetch(`${endpoint}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
if (!targetResponse.ok) throw new Error(`Falha ao criar aba: ${targetResponse.status}`);
const target = await targetResponse.json();

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let commandId = 0;
const pending = new Map();
const eventWaiters = new Map();
const consoleErrors = [];

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
    return;
  }
  if (message.method === "Runtime.exceptionThrown") {
    consoleErrors.push(message.params.exceptionDetails?.text || "Runtime exception");
  }
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    consoleErrors.push(message.params.args.map((arg) => arg.value || arg.description || "").join(" "));
  }
  const waiters = eventWaiters.get(message.method);
  if (waiters?.length) {
    eventWaiters.delete(message.method);
    waiters.forEach((resolve) => resolve(message.params));
  }
});

function send(method, params = {}) {
  const id = ++commandId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

function waitForEvent(method, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timeout: ${method}`)), timeoutMs);
    const wrapped = (params) => { clearTimeout(timeout); resolve(params); };
    const waiters = eventWaiters.get(method) || [];
    waiters.push(wrapped);
    eventWaiters.set(method, waiters);
  });
}

await send("Page.enable");
await send("Runtime.enable");
await send("Page.bringToFront");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1920,
  height: 1080,
  deviceScaleFactor: 1,
  mobile: false,
  screenWidth: 1920,
  screenHeight: 1080
});

const report = [];

async function waitForCondition(expression, label) {
  let lastResult;
  let lastError;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const state = await send("Runtime.evaluate", { expression, returnByValue: true });
      lastResult = state;
      if (state.result.value === true) return;
    } catch (error) {
      lastError = error;
      // A navegação pode substituir o contexto entre duas sondagens.
    }
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  const diagnostic = await send("Runtime.evaluate", {
    expression: `({ readyState: document.readyState, href: location.href, active: document.querySelector('.slide.is-active')?.id || null, hiddenFragments: document.querySelectorAll('.slide.is-active .fragment:not(.is-visible)').length })`,
    returnByValue: true
  }).catch((error) => ({ error: String(error) }));
  throw new Error(`${label}: condição não satisfeita; último resultado=${JSON.stringify(lastResult)}; diagnóstico=${JSON.stringify(diagnostic)}; erro=${lastError || "nenhum"}`);
}

await send("Page.navigate", { url: `${deckUrl}?qa=1#s=1&b=99` });
await waitForCondition(
  `document.readyState !== 'loading' && document.querySelector('.slide.is-active')?.id === 'slide-1'`,
  "Carga inicial"
);

for (let slide = 1; slide <= slideCount; slide += 1) {
  await send("Runtime.evaluate", {
    expression: `location.hash = '#s=${slide}&b=99'`,
    returnByValue: true
  });
  await waitForCondition(
    `document.querySelector('.slide.is-active')?.id === 'slide-${slide}' && document.querySelectorAll('.slide.is-active .fragment:not(.is-visible)').length === 0`,
    `Slide ${slide}`
  );
  await send("Runtime.evaluate", {
    expression: `new Promise(async (resolve) => {
      if (document.fonts?.ready) await document.fonts.ready;
      requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 80)));
    })`,
    awaitPromise: true,
    returnByValue: true
  });

  const audit = await send("Runtime.evaluate", {
    expression: `(() => {
      const active = document.querySelector('.slide.is-active');
      const viewport = { width: innerWidth, height: innerHeight };
      const outside = [];
      const clipped = [];
      if (!active) return { title: null, viewport, outside: ['NO_ACTIVE_SLIDE'], clipped: [] };
      for (const el of active.querySelectorAll('*')) {
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        const label = el.className?.baseVal || el.className || el.tagName;
        const allowOutside = el.closest('.ambient,.close-visual,.official-marks') || el.matches('svg,path');
        if (!allowOutside && (rect.left < -2 || rect.top < -2 || rect.right > innerWidth + 2 || rect.bottom > innerHeight + 2)) {
          outside.push({ label: String(label).slice(0,90), rect: [rect.left,rect.top,rect.right,rect.bottom].map(Math.round) });
        }
        if (el.childElementCount === 0 && (el.textContent || '').trim() &&
            ((el.scrollWidth - el.clientWidth) > 2 || (el.scrollHeight - el.clientHeight) > 2) &&
            !['visible','clip'].includes(style.overflow)) {
          clipped.push({ label: String(label).slice(0,90), text: el.textContent.trim().slice(0,90), size: [el.clientWidth,el.clientHeight,el.scrollWidth,el.scrollHeight] });
        }
      }
      return {
        title: (active.querySelector('h1,h2')?.textContent || active.dataset.title || '').trim().replace(/\\s+/g,' '),
        viewport,
        stage: (() => { const r = document.getElementById('stage').getBoundingClientRect(); return [r.left,r.top,r.width,r.height].map(Math.round); })(),
        sources: active.querySelectorAll('.sources a').length,
        fragmentsVisible: active.querySelectorAll('.fragment.is-visible').length,
        fragmentsTotal: active.querySelectorAll('.fragment').length,
        outside,
        clipped
      };
    })()`,
    returnByValue: true
  });

  const screenshot = await send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false
  });
  const filename = `slide-${String(slide).padStart(2, "0")}.png`;
  await writeFile(path.join(outputDir, filename), Buffer.from(screenshot.data, "base64"));
  report.push({ slide, ...audit.result.value });
}

await writeFile(path.join(root, "qa", "render-report.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  consoleErrors,
  slides: report
}, null, 2));

socket.close();
await fetch(`${endpoint}/json/close/${target.id}`);

const bad = report.filter((entry) => entry.outside.length || entry.clipped.length || entry.sources > 3);
process.stdout.write(JSON.stringify({ rendered: report.length, consoleErrors, flaggedSlides: bad.map((entry) => entry.slide) }, null, 2));
