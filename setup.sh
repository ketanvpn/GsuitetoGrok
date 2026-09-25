#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=========================================="
echo " 🚀 Setup GSuite to Grok + grok2api Gateway"
echo "=========================================="

# 1. Pastikan config.yaml dibuat
if [ ! -f "config.yaml" ]; then
    echo "[1/4] Membuat config.yaml dengan kunci enkripsi aman..."
    cp config.example.yaml config.yaml
    JWT_SEC=$(openssl rand -hex 32)
    ENC_KEY=$(openssl rand -base64 32)
    ADMIN_PASS=$(openssl rand -hex 12)
    
    sed -i "s|jwtSecret:.*|jwtSecret: \"${JWT_SEC}\"|" config.yaml
    sed -i "s|credentialEncryptionKey:.*|credentialEncryptionKey: \"${ENC_KEY}\"|" config.yaml
    sed -i "s|password:.*|password: \"${ADMIN_PASS}\"|" config.yaml
    
    echo "  -> Admin Username: admin"
    echo "  -> Admin Password: $ADMIN_PASS"
    echo "  (Password tersimpan di config.yaml)"
else
    echo "[1/4] config.yaml sudah ada, dilewati."
fi

# 2. Pastikan direktori data ada
mkdir -p data screenshots

# 3. Jalankan Gateway grok2api Docker
echo "[2/4] Menjalankan grok2api Gateway via Docker..."
if command -v docker &> /dev/null; then
    docker compose up -d
else
    echo "PERINGATAN: Docker belum terpasang. Silakan install Docker terlebih dahulu."
fi

# 4. Install dependensi Node.js untuk bot harvester
echo "[3/4] Memasang dependensi Node.js..."
if [ ! -d "node_modules" ]; then
    npm install
fi

# 5. Buat file akun.txt jika belum ada
if [ ! -f "akun.txt" ]; then
    touch akun.txt
    echo "[4/4] File akun.txt telah dibuat."
fi

echo ""
echo "=========================================="
echo " 🎉 SETUP SELESAI!"
echo "=========================================="
echo "Langkah selanjutnya:"
echo "1. Isi akun ke akun.txt: nano akun.txt (format: email|password)"
echo "2. Jalankan bot: ./run.sh"
echo "=========================================="
