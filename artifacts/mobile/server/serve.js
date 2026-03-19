/**
 * Standalone production server for Expo static builds.
 *
 * Serves the output of build.js (static-build/) with two special routes:
 * - GET / or /manifest with expo-platform header → platform manifest JSON
 * - GET / without expo-platform → landing page HTML
 * /api/* requests are proxied to the API server on port 8080.
 * Everything else falls through to static file serving from ./static-build/.
 *
 * Zero external dependencies — uses only Node.js built-ins (http, fs, path).
 */

const http = require("http");
const fs = require("fs");
const path = require("path");

const STATIC_ROOT = path.resolve(__dirname, "..", "static-build");
const TEMPLATE_PATH = path.resolve(__dirname, "templates", "landing-page.html");
const basePath = (process.env.BASE_PATH || "/").replace(/\/+$/, "");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json",
};

function getAppName() {
  try {
    const appJsonPath = path.resolve(__dirname, "..", "app.json");
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf-8"));
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveManifest(platform, res) {
  const manifestPath = path.join(STATIC_ROOT, platform, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(
      JSON.stringify({ error: `Manifest not found for platform: ${platform}` }),
    );
    return;
  }

  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.writeHead(200, {
    "content-type": "application/json",
    "expo-protocol-version": "1",
    "expo-sfv-version": "0",
  });
  res.end(manifest);
}

function serveLandingPage(req, res, landingPageTemplate, appName) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = forwardedProto || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"];
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

function serveStaticFile(urlPath, res) {
  const safePath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(STATIC_ROOT, safePath);

  if (!filePath.startsWith(STATIC_ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { "content-type": contentType });
  res.end(content);
}

const API_PORT = parseInt(process.env.API_PORT || "8080", 10);

function sendProxyRequest(method, headers, fullPath, query, bodyBuffer, res, attempt) {
  const options = {
    hostname: "127.0.0.1",
    port: API_PORT,
    path: fullPath + query,
    method: method,
    headers: { ...headers, host: `127.0.0.1:${API_PORT}` },
  };

  console.log(`[proxy] attempt=${attempt} ${method} → 127.0.0.1:${API_PORT}${fullPath}${query}`);

  const proxyReq = http.request(options, (proxyRes) => {
    console.log(`[proxy] status=${proxyRes.statusCode} for ${fullPath}`);
    const outHeaders = { ...proxyRes.headers };
    delete outHeaders["transfer-encoding"];
    if (!res.headersSent) {
      res.writeHead(proxyRes.statusCode, outHeaders);
      proxyRes.pipe(res, { end: true });
    }
  });

  proxyReq.on("error", (err) => {
    console.error(`[proxy] error attempt=${attempt} ${fullPath}: ${err.code} ${err.message}`);
    if (attempt < 4 && (err.code === "ECONNREFUSED" || err.code === "ECONNRESET" || err.code === "ETIMEDOUT")) {
      const delay = attempt * 1000;
      setTimeout(() => sendProxyRequest(method, headers, fullPath, query, bodyBuffer, res, attempt + 1), delay);
      return;
    }
    if (!res.headersSent) {
      res.writeHead(502, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "API server temporarily unavailable", code: err.code }));
    }
  });

  if (bodyBuffer && bodyBuffer.length > 0) {
    proxyReq.write(bodyBuffer);
  }
  proxyReq.end();
}

function proxyToApi(req, res, fullPath) {
  const query = req.url && req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const bodyBuffer = Buffer.concat(chunks);
    sendProxyRequest(req.method, req.headers, fullPath, query, bodyBuffer, res, 1);
  });
  req.on("error", (err) => {
    console.error(`[proxy] request read error: ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(400);
      res.end("Bad Request");
    }
  });
}

const landingPageTemplate = fs.readFileSync(TEMPLATE_PATH, "utf-8");
const appName = getAppName();

console.log(`[serve] Starting: basePath="${basePath}", API_PORT=${API_PORT}`);

const server = http.createServer((req, res) => {
  const rawUrl = req.url || "/";
  let pathname;
  try {
    const url = new URL(rawUrl, `http://${req.headers.host || "localhost"}`);
    pathname = url.pathname;
  } catch {
    pathname = rawUrl.split("?")[0];
  }

  if (basePath && pathname.startsWith(basePath)) {
    pathname = pathname.slice(basePath.length) || "/";
  }

  console.log(`[serve] ${req.method} ${pathname}`);

  if (pathname.startsWith("/api/") || pathname === "/api") {
    return proxyToApi(req, res, pathname);
  }

  if (pathname === "/" || pathname === "/manifest") {
    const platform = req.headers["expo-platform"];
    if (platform === "ios" || platform === "android") {
      return serveManifest(platform, res);
    }

    if (pathname === "/") {
      return serveLandingPage(req, res, landingPageTemplate, appName);
    }
  }

  serveStaticFile(pathname, res);
});

const port = parseInt(process.env.PORT || "3000", 10);
server.listen(port, "0.0.0.0", () => {
  console.log(`[serve] Listening on port ${port}`);
  console.log(`[serve] API proxy → 127.0.0.1:${API_PORT}`);
});
