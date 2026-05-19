const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(express.json());

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

// --- License endpoints ---
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

// --- Purchase code management ---
app.get('/new-code', (req, res) => {
  const purchases = readJSON(PURCHASE_DB);
  const code = 'PU-' + crypto.randomBytes(8).toString('hex').toUpperCase();
  purchases[code] = { used: false, created: Date.now() };
  writeJSON(PURCHASE_DB, purchases);
  res.json({ code, link: `${req.protocol}://${req.get('host')}/buy?code=${code}` });
});

// --- Buy endpoint: serves script with embedded license ---
app.get('/buy', (req, res) => {
  const { code } = req.query;
  if (!code) {
    res.status(400).send('Missing purchase code. Use /buy?code=PU-XXXX');
    return;
  }

  const purchases = readJSON(PURCHASE_DB);
  const purchase = purchases[code];
  if (!purchase || purchase.used) {
    res.status(403).send('Invalid or already used purchase code.');
    return;
  }

  const licenses = readJSON(DB_PATH);
  const licenseKey = 'TF-' + crypto.randomUUID().slice(0, 12).toUpperCase();
  licenses[licenseKey] = { revoked: false, created: Date.now() };
  writeJSON(DB_PATH, licenses);

  purchase.used = true;
  writeJSON(PURCHASE_DB, purchases);

  try {
    let template = fs.readFileSync(SCRIPT_PATH, 'utf8');
    template = template.replace('%%LICENSE%%', licenseKey);

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
    res.status(500).send('Server error: could not read script template.');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`License server running on port ${PORT}`));