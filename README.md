# GSuite to Grok (xAI) Harvester & Gateway Bridge 🚀

Automated multi-account harvester and gateway pipeline for **Grok (xAI)** using Google Workspace (GSuite) accounts. Converts web sessions into high-performance, rotation-enabled, OpenAI-compatible API endpoints for **9Router**, Claude Code, Cursor, Cline, and custom AI clients.

---

## 💡 Bagaimana Cara Kerjanya? (Arsitektur Sistem)

Di web resmi Grok (`grok.com`), setiap akun gratis memiliki batas kuota (misal ~15-20 pesan per 2 jam). Proyek ini menghilangkan batasan tersebut melalui arsitektur multi-akun otomatis:

```
[Akun GSuite (akun.txt)] 
         │
         ▼ (Puppeteer Stealth + Human-like Typing)
[Google OAuth SSO di xAI / grok.com]
         │
         ▼ (Ekstraksi Token Sesi: sso & sso-rw)
[grok2api Multi-Account Gateway (Docker Port 8000)]
         │
         ▼ (Auto-Rotation / Round-Robin Antar Akun)
[OpenAI-Compatible REST API: http://127.0.0.1:8000/v1]
         │
         ├──► 9Router AI Gateway
         ├──► NextChat / Chatbox / LibreChat
         └──► Claude Code / Cursor / Cline / OpenClaw
```

1. **Bot Harvester (`bot.js`):** Menggunakan browser headless Chromium dengan teknik siluman (*stealth*) untuk login ke Google dan mengotorisasi SSO di `accounts.x.ai`.
2. **Auto Capture & Sync:** Mengambil token sesi otentikasi resmi (`sso` dan `sso-rw`), lalu otomatis menyuntikkannya ke gateway backend **`grok2api`**.
3. **Multi-Account Rotating Pool:** `grok2api` memutar akun-akun GSuite Anda secara otomatis. Jika satu akun mendekati limit, permintaan berikutnya dialihkan ke akun berikutnya tanpa jeda.

---

## 🌟 Model-Model Resmi yang Tersedia

Setiap akun yang terhubung langsung membuka akses ke model xAI terkini:

| Model ID | Deskripsi & Kegunaan |
|---|---|
| **`grok-4.7`** | Model penalaran flagship xAI dengan kecerdasan logika tertinggi. |
| **`grok-chat-fast`** | Model obrolan super cepat dan hemat latensi. |
| **`grok-composer-2.5-fast`** | Dioptimalkan khusus untuk coding, refactoring, dan penulisan skrip. |
| **`grok-imagine-image`** | Generator gambar AI berbasis prompt teks (Text-to-Image). |
| **`grok-imagine-image-2.0`** | Generator gambar resolusi tinggi generasi terbaru. |
| **`grok-imagine-image-edit`** | Pengedit dan pemoles gambar AI (Image Inpainting / Editing). |
| **`grok-imagine-video`** | Generator video AI resmi xAI (Text-to-Video). |

---

## 📦 Persyaratan Sistem

- **OS:** Linux (Ubuntu 22.04+ / Debian 11+ direkomendasikan).
- **Docker & Docker Compose:** Versi terbaru untuk menjalankan gateway `grok2api`.
- **Node.js:** v18.0.0 atau lebih baru.
- **Chromium / Chrome:** Terpasang di VPS (otomatis didukung oleh Puppeteer).

---

## 🚀 Panduan Setup di VPS Baru (Dari Nol)

Jika Anda memindahkan proyek ini ke VPS baru atau menginstalnya pertama kali, cukup ikuti 3 langkah mudah:

### 1. Kloning Repositori
```bash
git clone https://github.com/ketanvpn/GsuitetoGrok.git
cd GsuitetoGrok
```

### 2. Jalankan Skrip Setup Otomatis
```bash
chmod +x setup.sh run.sh
./setup.sh
```
*Skrip ini akan secara otomatis:*
- Menghasilkan kunci rahasia enkripsi (`jwtSecret` & `credentialEncryptionKey`).
- Membuat berkas konfigurasi `config.yaml`.
- Menyalakan container gateway `grok2api` di latar belakang (`http://127.0.0.1:8000`).
- Memasang dependensi Node.js (`npm install`).

### 3. Masukkan Daftar Akun GSuite
Edit file `akun.txt`:
```bash
nano akun.txt
```
Masukkan akun dengan format baris tunggal (bisa menggunakan delimiter `|` atau `:`):
```text
yulita1@paragadis.com|password123
yulita2@paragadis.com|password123
yulita3@paragadis.com:password123
```
*Simpan dengan menekan `Ctrl + O`, `Enter`, lalu `Ctrl + X`.*

### 4. Mulai Pemanenan (Harvester)
```bash
./run.sh
```
*Bot akan membuka browser headless, login via Google SSO, memanen token, dan langsung mendaftarkannya ke gateway `grok2api`.*

---

## 🔌 Cara Menggunakan API

Setelah akun terdaftar, gateway `grok2api` siap melayani request API standar OpenAI:

- **Base URL:** `http://127.0.0.1:8000/v1` (atau `http://IP_VPS:8000/v1`)
- **API Key:** Kunci klien yang dibuat di `grok2api` (misal: `g2a_...`)

### Contoh Tes Curl:
```bash
curl -X POST http://127.0.0.1:8000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-chat-fast",
    "messages": [{"role": "user", "content": "Halo Grok, siapa kamu?"}]
  }'
```

### Menghubungkan ke 9Router:
Jika 9Router berjalan di Docker pada VPS yang sama:
1. Hubungkan container `9router` ke jaringan docker `grok2api`:
   ```bash
   docker network connect grok2api_default 9router
   ```
2. Di dalam 9Router, endpoint dapat diakses langsung via:
   `http://grok2api:8000/v1`

---

## 🔄 Panduan Migrasi / Pindah VPS

Jika Anda ingin berpindah server tanpa kehilangan akun yang sudah aktif:
1. Cukup salin seluruh folder `GsuitetoGrok` beserta folder `./data` dan `config.yaml` ke VPS baru:
   ```bash
   rsync -avz /root/projects/GsuitetoGrok/ user@ip-vps-baru:/root/projects/GsuitetoGrok/
   ```
2. Di VPS baru, jalankan:
   ```bash
   docker compose up -d
   ```
   *Semua akun, token, dan riwayat langsung aktif kembali seketika tanpa perlu login ulang!*

---

## 🔒 Keamanan Kredensial

Berkas kredensial sensitif seperti `akun.txt`, `grok_tokens.txt`, `config.yaml`, dan folder `./data/` dilindungi secara ketat oleh `.gitignore` sehingga tidak akan pernah terunggah ke repositori publik GitHub.

---

## 📄 Lisensi
MIT License © 2026 [KetanTech](https://github.com/ketanvpn)
