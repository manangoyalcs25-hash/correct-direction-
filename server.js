// ============================================
// SERVER - Node.js Backend
// Serves the Shop Inventory app
// + Proxies Anthropic API (camera search)
// ============================================

// ─── FIX: Load API key from .env file ────────────────────────────────────────
// 1. Run:  npm install dotenv
// 2. Create a .env file in this folder with:
//      ANTHROPIC_API_KEY=sk-ant-your-real-key-here
// 3. Add .env to your .gitignore so it never gets committed
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const PORT = 3000;
const HOST = 'localhost';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end',  () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = http.createServer(async (req, res) => {
  console.log(`📥 ${req.method} ${req.url}`);

  setCORS(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ── PROXY: POST /api/claude-vision ──────────────────────────────────────
  if (req.method === 'POST' && req.url === '/api/claude-vision') {
    if (!ANTHROPIC_API_KEY) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'API key not set. Create a .env file with ANTHROPIC_API_KEY=your-key-here'
      }));
      return;
    }

    try {
      const body = await readBody(req);

      const options = {
        hostname: 'api.anthropic.com',
        path:     '/v1/messages',
        method:   'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length':    body.length,
        },
      };

      const proxyReq = https.request(options, (proxyRes) => {
        const chunks = [];
        proxyRes.on('data', c => chunks.push(c));
        proxyRes.on('end', () => {
          const data = Buffer.concat(chunks);
          res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(data);
          console.log(`✅ Anthropic proxy → ${proxyRes.statusCode}`);
        });
      });

      proxyReq.on('error', (err) => {
        console.error('❌ Proxy error:', err.message);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Proxy request failed: ' + err.message }));
      });

      proxyReq.write(body);
      proxyReq.end();

    } catch (err) {
      console.error('❌ Vision proxy error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── STATIC FILES ─────────────────────────────────────────────────────────
  let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  filePath = path.join(__dirname, filePath);

  const realPath = path.resolve(filePath);
  if (!realPath.startsWith(path.resolve(__dirname))) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500);
        res.end('Server Error');
      }
    } else {
      const ext      = path.extname(filePath);
      const mimeType = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mimeType, 'Cache-Control': 'no-cache' });
      res.end(data);
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log('\n' + '='.repeat(50));
  console.log('🏪 SHOP INVENTORY SERVER');
  console.log('='.repeat(50));
  console.log(`🌐 http://${HOST}:${PORT}`);
  console.log(`🤖 AI proxy: ${ANTHROPIC_API_KEY ? '✅ API key loaded from .env' : '⚠️  No API key — add ANTHROPIC_API_KEY to .env'}`);
  console.log('\nPress Ctrl+C to stop\n');
});

server.on('error', (err) => {
  console.error('❌ Server error:', err.message);
  process.exit(1);
});
