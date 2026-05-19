const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const app = express();
app.use(express.json());

const DB_PATH = 'licenses.json';

function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) return {};
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch { return {}; }
}

function writeDB(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function hash(fp) {
  return crypto.createHash('sha256').update(fp).digest('hex');
}

app.post('/activate', (req, res) => {
  const { license, fingerprint } = req.body;
  if (!license || !fingerprint) return res.json({ status: 'invalid' });
  const db = readDB();
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
  writeDB(db);
  res.json({ status: 'ok', token });
});

app.post('/validate', (req, res) => {
  const { license, token } = req.body;
  if (!license || !token) return res.json({ status: 'invalid' });
  const db = readDB();
  const entry = db[license];
  if (!entry || entry.revoked || entry.token !== token) return res.json({ status: 'invalid' });
  if (entry.tokenExpires && Date.now() > entry.tokenExpires) return res.json({ status: 'expired' });
  res.json({ status: 'valid' });
});

app.get('/create-license', (req, res) => {
  const db = readDB();
  const newKey = 'TF-' + crypto.randomUUID().slice(0, 12).toUpperCase();
  db[newKey] = { revoked: false, created: Date.now() };
  writeDB(db);
  res.json({ license: newKey });
});

app.post('/revoke', (req, res) => {
  const { license } = req.body;
  const db = readDB();
  if (!db[license]) return res.json({ error: 'not found' });
  db[license].revoked = true;
  writeDB(db);
  res.json({ status: 'revoked' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));