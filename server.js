const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(express.json());

// Health-check route (prevents Fly.io restart spam)
app.get('/', (req, res) => res.send('OK'));

const DB_PATH = path.join(__dirname, 'licenses.json');
const PURCHASE_DB = path.join(__dirname, 'purchases.json');
const SCRIPT_PATH = path.join(__dirname, 'taskflux.user.js');

function readJSON(file, fallback = {}) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch { return fallback; }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function hash(fp) {
  return crypto.createHash('sha256').update(fp).digest('hex');
}

// ----- License endpoints (unchanged) -----
app.post('/activate', (req, res) => {
  const { license, fingerprint } = req.body;
  if (!license || !fingerprint) return res.json({ status: 'invalid' });
  const db = readJSON(DB_PATH);
  const entry = db[license];
  if (!entry || entry.revoked) return res.json({ status: 'invalid' });
  const fpHash = hash(fingerprint);
  if (entry.fingerprint && entry.fingerprint !== fpHash) {
    return res.json({ status: 'already_bound' });
  }
  if (!entry.fingerprint) entry.fingerprint = fpHash;
  const token = crypto.randomBytes(16).toString('hex');
  entry.token = token;
  entry.tokenExpires = Date.now() + 7 * 24 * 60 * 60 * 1000;
  writeJSON(DB_PATH, db);
  res.json({ status: 'ok', token });
});

app.post('/validate', (req, res) => {
  const { license, token } = req.body;
  if (!license || !token) return res.json({ status: 'invalid' });
  const db = readJSON(DB_PATH);
  const entry = db[license];
  if (!entry || entry.revoked || entry.token !== token) return res.json({ status: 'invalid' });
  if (entry.tokenExpires && Date.now() > entry.tokenExpires) return res.json({ status: 'expired' });
  res.json({ status: 'valid' });
});

app.get('/new-code', (req, res) => {
  try {
    const purchases = readJSON(PURCHASE_DB);
    const code = 'PU-' + crypto.randomBytes(8).toString('hex').toUpperCase();
    purchases[code] = { used: false, created: Date.now() };
    writeJSON(PURCHASE_DB, purchases);
    res.json({ code, link: `${req.protocol}://${req.get('host')}/buy?code=${code}` });
  } catch (err) {
    console.error('Error generating code:', err);
    res.status(500).send('Server error.');
  }
});

app.get('/buy', (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Missing purchase code.');
  const purchases = readJSON(PURCHASE_DB);
  const purchase = purchases[code];
  if (!purchase || purchase.used) return res.status(403).send('Invalid or already used purchase code.');
  const licenses = readJSON(DB_PATH);
  const licenseKey = 'TF-' + crypto.randomUUID().slice(0, 12).toUpperCase();
  licenses[licenseKey] = { revoked: false, created: Date.now() };
  writeJSON(DB_PATH, licenses);
  purchase.used = true;
  writeJSON(PURCHASE_DB, purchases);

  try {
    let template = fs.readFileSync(SCRIPT_PATH, 'utf8');
    template = template.replace('%%LICENSE%%', licenseKey);
    template = template.replace('%%SERVER_URL%%', `${req.protocol}://${req.get('host')}`);
    // Integrity hash (optional – keep if you want tamper detection)
    const markerStart = '// INTEGRITY_START';
    const markerEnd = '// INTEGRITY_END';
    const startIdx = template.indexOf(markerStart);
    const endIdx = template.indexOf(markerEnd);
    if (startIdx !== -1 && endIdx !== -1) {
      const moduleSource = template.slice(startIdx, endIdx + markerEnd.length);
      const integrityHash = crypto.createHash('sha256').update(moduleSource).digest('hex');
      template = template.replace('%%INTEGRITY%%', integrityHash);
    }
    res.setHeader('Content-Type', 'application/javascript');
    res.send(template);
  } catch (err) {
    console.error('Error serving script:', err);
    res.status(500).send('Server error.');
  }
});

// Catch-all error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).send('Internal server error');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`License server running on port ${PORT}`));

// Log any uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});
