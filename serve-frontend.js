/**
 * ACP Health — zero-dependency static file server
 * =========================================================
 * Serves frontend-prototypes/ on http://localhost:8080.
 * Uses only Node's built-in http/fs/path modules — no `npm
 * install`, no `npx` package download, no internet connection
 * required. This exists specifically because `npx http-server`
 * can fail silently on machines without global npm cache /
 * internet access, which is what caused the earlier
 * ERR_CONNECTION_REFUSED / 404 errors.
 *
 * Run: node serve-frontend.js
 * Then open: http://localhost:8080
 * =========================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const ROOT = path.join(__dirname, 'frontend-prototypes');

// Hitting the bare root URL serves the most complete prototype,
// instead of 404ing because there's no index.html.
const DEFAULT_FILE = '05_doctor_booking_specialty_matched.html';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

if (!fs.existsSync(ROOT)) {
  console.error(`Could not find "${ROOT}". Run this script from the project root (the folder containing frontend-prototypes/).`);
  process.exit(1);
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = `/${DEFAULT_FILE}`;

  // Prevent path traversal outside frontend-prototypes/
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(`
        <h1>404 — Not found</h1>
        <p>No file at <code>${urlPath}</code>.</p>
        <p>Available prototypes:</p>
        <ul>
          <li><a href="/01_initial_prototype.html">01_initial_prototype.html</a></li>
          <li><a href="/02_styled_with_live_clinics.html">02_styled_with_live_clinics.html</a></li>
          <li><a href="/03_beta_gated.html">03_beta_gated.html</a></li>
          <li><a href="/04_backend_connected_demo.html">04_backend_connected_demo.html</a></li>
          <li><a href="/05_doctor_booking_specialty_matched.html">05_doctor_booking_specialty_matched.html</a></li>
        </ul>
      `);
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} is already in use. Either stop whatever's using it, or run:\n  PORT=8081 node serve-frontend.js\n`);
  } else {
    console.error(err);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`\nACP Health frontend running at http://localhost:${PORT}`);
  console.log(`(serving ${ROOT})\n`);
});
