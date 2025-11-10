#!/bin/bash

# Скрипт для упаковки проекта для загрузки на VPS
# Создает архив без лишних файлов

echo "📦 Упаковка проекта для деплоя..."

# Имя архива
ARCHIVE_NAME="qr-generator-deploy.tar.gz"

# Создание архива с исключениями
tar -czf "$ARCHIVE_NAME" \
  --exclude='node_modules' \
  --exclude='qr_codes.db' \
  --exclude='.git' \
  --exclude='.DS_Store' \
  --exclude='logs' \
  --exclude='*.log' \
  --exclude="$ARCHIVE_NAME" \
  .

echo "✅ Архив создан: $ARCHIVE_NAME"
echo ""
echo "📤 Загрузите архив на сервер одним из способов:"
echo ""
echo "1. Через SCP:"
echo "   scp $ARCHIVE_NAME your-user@your-server-ip:/tmp/"
echo ""
echo "2. Через SFTP (FileZilla, WinSCP и т.д.)"
echo ""
echo "📂 На сервере распакуйте:"
echo "   sudo mkdir -p /var/www/qr-generator"
echo "   sudo tar -xzf /tmp/$ARCHIVE_NAME -C /var/www/qr-generator"
echo "   cd /var/www/qr-generator"
echo "   ./deploy.sh"
echo ""

