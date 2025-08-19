// Register Service Worker for offline
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

// Tiny IndexedDB helper
const DB_NAME = 'zipdb';
const STORE = 'entries';
let db;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => { db = req.result; resolve(); };
    req.onerror = () => reject(req.error);
  });
}

function addEntry(zip) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).add({ zip, ts: new Date().toISOString() });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

function getAll() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function clearAll() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// UI
const disp = document.getElementById('display');
const status = document.getElementById('status');
const submitBtn = document.getElementById('submit');
let digits = [];

function render() {
  const shown = digits.concat(Array(5 - digits.length).fill('_')).join('');
  disp.textContent = shown;
  submitBtn.disabled = !(digits.length === 5);
}

function pushDigit(d) {
  if (digits.length < 5) digits.push(d);
  render();
}

function backspace() {
  digits.pop(); render();
}

function clearDisp() {
  digits = []; render();
}

function isValidZip(a) {
  // Exactly 5 digits (keeps leading zeros)
  return /^[0-9]{5}$/.test(a.join(''));
}

function toast(msg) {
  status.textContent = msg;
  setTimeout(() => { status.textContent = ''; }, 1200);
}

document.querySelectorAll('button[data-key]').forEach(btn => {
  btn.addEventListener('click', () => {
    const k = btn.getAttribute('data-key');
    if (k === 'bksp') return backspace();
    if (k === 'clr') return clearDisp();
    pushDigit(k);
  });
});

submitBtn.addEventListener('click', async () => {
  if (!isValidZip(digits)) { toast('Please enter 5 digits'); return; }
  try {
    await addEntry(digits.join(''));
    toast('Saved! Next person →');
    clearDisp(); // auto-reset for the next attendee
  } catch (e) {
    toast('Save failed (still offline?)');
  }
});

document.getElementById('countBtn').addEventListener('click', async () => {
  const all = await getAll();
  toast(`${all.length} entries on device`);
});

document.getElementById('export').addEventListener('click', async () => {
  const all = await getAll();
  const header = 'timestamp,zip\n';
  const rows = all.map(r => `${r.ts},${r.zip}`).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `meckco_zip_export_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
});

document.getElementById('wipe').addEventListener('click', async () => {
  const ok = confirm('Type 1234 to confirm wipe');
  if (ok) {
    // Simple guard: prompt returns "null" if cancelled
    const code = prompt('Confirm code:');
    if (code === '1234') { await clearAll(); toast('All entries cleared'); }
    else { toast('Wipe canceled'); }
  }
});

// Init
openDB().then(render);
