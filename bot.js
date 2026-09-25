const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');
const path = require('path');
const http = require('http');

const CHROME_PATH = process.env.CHROME_PATH || '/root/.hermes/tools/chromium-1208/chrome-linux64/chrome';
const AKUN_FILE = path.join(__dirname, 'akun.txt');
const OUTPUT_FILE = path.join(__dirname, 'grok_tokens.txt');
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');
const GROK2API_PORT = process.env.GROK2API_PORT || 8000;
const GROK2API_ADMIN_USER = process.env.GROK2API_ADMIN_USER || 'admin';
let GROK2API_ADMIN_PASS = process.env.GROK2API_ADMIN_PASS || 'bd6281873676dec58cb9ba65';

// Auto-read password from config.yaml if available
const CONFIG_FILE = path.join(__dirname, 'config.yaml');
if (fs.existsSync(CONFIG_FILE)) {
  try {
    const yamlContent = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const match = yamlContent.match(/password:\s*["']?([^"'\s\n]+)["']?/);
    if (match && match[1] && match[1] !== 'GENERATE_VIA_SETUP_SH') {
      GROK2API_ADMIN_PASS = match[1];
    }
  } catch {}
}

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function typeHumanLike(page, selector, text) {
  await page.waitForSelector(selector, { visible: true, timeout: 20000 });
  await page.click(selector);
  await sleep(200);

  // Clear existing
  await page.keyboard.down('Control');
  await page.keyboard.press('A');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await sleep(150);

  for (let i = 0; i < text.length; i++) {
    await page.keyboard.type(text[i]);
    const delay = Math.floor(Math.random() * 45) + 30; // 30-75ms
    await sleep(delay);
  }
}

async function getGrok2APIAdminToken() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ username: GROK2API_ADMIN_USER, password: GROK2API_ADMIN_PASS });
    const req = http.request({
      hostname: '127.0.0.1',
      port: GROK2API_PORT,
      path: '/api/admin/v1/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (json.data && json.data.tokens) {
            resolve(json.data.tokens.accessToken);
          } else {
            reject(new Error(`Login to grok2api failed: ${body}`));
          }
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function importSSOToGrok2API(adminToken, ssoToken, email) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  let body = '';
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="file"; filename="grok_account_${email}.txt"\r\n`;
  body += `Content-Type: text/plain\r\n\r\n`;
  body += ssoToken + '\r\n';
  body += `--${boundary}--\r\n`;

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: GROK2API_PORT,
      path: '/api/admin/v1/accounts/web/import',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => resolve(resBody));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function processAccount(email, password, index, total) {
  console.log(`\n========================================`);
  console.log(`[${index}/${total}] Memproses Akun Grok: ${email}`);
  console.log(`========================================`);

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: CHROME_PATH,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,800'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    // 1. Login ke Google Session
    console.log(`  [Google] Membuka halaman login Google...`);
    await page.goto('https://accounts.google.com/signin', { waitUntil: 'networkidle2', timeout: 35000 });
    await sleep(1500);

    console.log(`  [Google] Memasukkan email...`);
    await typeHumanLike(page, '#identifierId', email);
    await sleep(400);
    await page.keyboard.press('Enter');

    console.log(`  [Google] Menunggu field password...`);
    await page.waitForSelector('input[type="password"]', { visible: true, timeout: 20000 });
    await sleep(800);
    await typeHumanLike(page, 'input[type="password"]', password);
    await sleep(400);
    await page.keyboard.press('Enter');

    console.log(`  [Google] Memverifikasi status login...`);
    await sleep(5000);

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const understandBtn = await page.$('button::-p-text(I understand), button::-p-text(Saya mengerti)');
        if (understandBtn) {
          console.log(`  [Google] Menyetujui syarat akun baru...`);
          await understandBtn.click();
          await sleep(3000);
        }
      } catch {}
    }

    // 2. Navigasi ke accounts.x.ai
    console.log(`  [xAI] Membuka halaman login Grok (accounts.x.ai)...`);
    await page.goto('https://accounts.x.ai/sign-in?redirect=grok-com', { waitUntil: 'networkidle2', timeout: 40000 });
    await sleep(3000);

    try {
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Accept All'));
        if (btn) btn.click();
      });
    } catch {}
    await sleep(1000);

    // Klik Login with Google
    console.log(`  [xAI] Mengklik "Login with Google"...`);
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button, a')).find(b => (b.innerText || '').includes('Login with Google'));
      if (btn) btn.click();
    });

    await sleep(5000);

    // Jika masuk ke Google Chooser
    if (page.url().includes('google.com')) {
      console.log(`  [Google] Memilih akun ${email}...`);
      try {
        await page.evaluate((userEmail) => {
          const acc = document.querySelector(`[data-email="${userEmail}"], [data-identifier="${userEmail}"]`) ||
                      document.querySelector('[data-email], [data-identifier], div[role="link"]');
          if (acc) acc.click();
        }, email);
      } catch {}

      await sleep(5000);

      // Cek tombol persetujuan izin
      try {
        const approveBtn = await page.waitForSelector('#submit_approve_access, button::-p-text(Izinkan), button::-p-text(Allow), button::-p-text(Continue), button::-p-text(Lanjutkan)', { timeout: 10000 });
        if (approveBtn) {
          console.log(`  [Google] Mengonfirmasi persetujuan akses...`);
          await approveBtn.click();
          await sleep(5000);
        }
      } catch {}
    }

    console.log(`  [xAI] Menunggu proses autentikasi selesai...`);
    for (let s = 0; s < 15; s++) {
      await sleep(1000);
      const cur = page.url();
      if (cur.includes('grok.com') || cur.includes('x.ai/oauth-complete')) break;
    }
    await sleep(3000);

    // Ambil cookies SSO
    const cookies = await page.cookies();
    const ssoCookie = cookies.find(c => c.name === 'sso' || c.name === 'sso-rw');

    if (!ssoCookie || !ssoCookie.value) {
      console.error(`  [✗] Gagal mendapatkan token SSO Grok.`);
      const safe = email.split('@')[0];
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `fail-${safe}.png`), fullPage: true });
      return false;
    }

    const ssoValue = ssoCookie.value;
    console.log(`  [✓] Berhasil menangkap Token SSO: ${ssoValue.substring(0, 15)}... (panjang: ${ssoValue.length})`);

    // Simpan ke file teks cadangan
    fs.appendFileSync(OUTPUT_FILE, `${email}|${ssoValue}|${new Date().toISOString()}\n`);

    // Otomatis push ke grok2api Gateway
    console.log(`  [grok2api] Menyinkronkan akun ke gateway grok2api...`);
    const adminToken = await getGrok2APIAdminToken();
    const importRes = await importSSOToGrok2API(adminToken, ssoValue, email);
    console.log(`  [grok2api] Hasil Sync: ${importRes.includes('created":1') || importRes.includes('synced":1') ? 'BERHASIL AKTIF' : 'SYNC SELESAI'}`);

    const safeUsername = email.split('@')[0];
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `success-${safeUsername}.png`), fullPage: true });

    return true;

  } catch (err) {
    console.error(`  [✗] Error pada ${email}: ${err.message}`);
    const safe = email.split('@')[0];
    try { await page.screenshot({ path: path.join(SCREENSHOT_DIR, `error-${safe}.png`) }); } catch {}
    return false;
  } finally {
    await browser.close();
  }
}

async function main() {
  if (!fs.existsSync(AKUN_FILE)) {
    console.error(`Error: File ${AKUN_FILE} tidak ditemukan!`);
    console.error(`Silakan buat file akun.txt dengan format: email|password (atau email:password)`);
    process.exit(1);
  }

  const rawLines = fs.readFileSync(AKUN_FILE, 'utf-8').split('\n');
  const accounts = rawLines
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const delimiter = line.includes('|') ? '|' : ':';
      const parts = line.split(delimiter);
      return { email: parts[0].trim(), password: parts[1].trim() };
    });

  if (accounts.length === 0) {
    console.log(`File ${AKUN_FILE} kosong.`);
    process.exit(0);
  }

  console.log(`==========================================`);
  console.log(` 🚀 Memulai GSuite to Grok (xAI) Harvester`);
  console.log(` Total antrean: ${accounts.length} akun`);
  console.log(` Target Gateway: http://127.0.0.1:${GROK2API_PORT}`);
  console.log(`==========================================`);

  for (let i = 0; i < accounts.length; i++) {
    const acc = accounts[i];
    const success = await processAccount(acc.email, acc.password, i + 1, accounts.length);

    if (success) {
      const remainingLines = fs.readFileSync(AKUN_FILE, 'utf-8')
        .split('\n')
        .filter(l => l.trim() && !l.startsWith('#') && !l.includes(acc.email));
      fs.writeFileSync(AKUN_FILE, remainingLines.join('\n'));
    }

    await sleep(2500);
  }

  console.log(`\n==========================================`);
  console.log(` 🎉 SEMUA SELESAI!`);
  console.log(` Token Grok tersimpan di: ${OUTPUT_FILE}`);
  console.log(`==========================================`);
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
