#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

if [ ! -f "akun.txt" ]; then
    echo "=========================================="
    echo " File akun.txt tidak ditemukan!"
    echo " Silakan buat akun.txt dengan format:"
    echo " email@domain.com|password"
    echo "=========================================="
    exit 1
fi

echo "=========================================="
echo " Starting GSuite to Grok Harvester..."
echo "=========================================="
node bot.js
