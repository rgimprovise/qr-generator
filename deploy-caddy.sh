#!/bin/bash

# Скрипт для деплоя QR Generator на VPS с Caddy
# Использование: ./deploy-caddy.sh

echo "🚀 Начинаем деплой QR Generator с Caddy..."

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Проверка Node.js
echo -e "${YELLOW}📦 Проверка Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js не установлен!${NC}"
    echo "Установите Node.js: https://nodejs.org/"
    exit 1
fi
echo -e "${GREEN}✅ Node.js установлен: $(node -v)${NC}"

# Проверка npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm не установлен!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ npm установлен: $(npm -v)${NC}"

# Установка зависимостей
echo -e "${YELLOW}📦 Установка зависимостей...${NC}"
npm install --production
echo -e "${GREEN}✅ Зависимости установлены${NC}"

# Проверка/установка PM2
echo -e "${YELLOW}📦 Проверка PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}Установка PM2...${NC}"
    npm install -g pm2
fi
echo -e "${GREEN}✅ PM2 готов${NC}"

# Создание директории для логов
echo -e "${YELLOW}📁 Создание директории для логов...${NC}"
mkdir -p logs
echo -e "${GREEN}✅ Директория создана${NC}"

# Создание .env файла если его нет
if [ ! -f .env ]; then
    echo -e "${YELLOW}📝 Создание .env файла...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ Файл .env создан. Не забудьте настроить его!${NC}"
fi

# Остановка предыдущей версии
echo -e "${YELLOW}🛑 Остановка предыдущей версии...${NC}"
pm2 stop qr-generator 2>/dev/null || true
pm2 delete qr-generator 2>/dev/null || true

# Запуск приложения
echo -e "${YELLOW}🚀 Запуск приложения...${NC}"
pm2 start ecosystem.config.js

# Сохранение конфигурации PM2
pm2 save

# Настройка автозапуска
echo -e "${YELLOW}⚙️  Настройка автозапуска...${NC}"
pm2 startup

# Проверка Caddy
echo -e "${YELLOW}🌐 Проверка Caddy...${NC}"
if command -v caddy &> /dev/null; then
    echo -e "${GREEN}✅ Caddy установлен: $(caddy version)${NC}"
    
    # Копирование Caddyfile если его нет
    if [ ! -f /etc/caddy/Caddyfile ]; then
        echo -e "${YELLOW}📝 Установка Caddyfile...${NC}"
        sudo mkdir -p /etc/caddy
        sudo mkdir -p /var/log/caddy
        echo -e "${YELLOW}⚠️  Не забудьте настроить Caddyfile!${NC}"
        echo "   sudo cp Caddyfile /etc/caddy/Caddyfile"
        echo "   sudo nano /etc/caddy/Caddyfile  # Измените yourdomain.com на ваш домен"
        echo "   sudo systemctl reload caddy"
    fi
else
    echo -e "${YELLOW}⚠️  Caddy не установлен${NC}"
    echo "   Установите Caddy:"
    echo "   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg"
    echo "   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list"
    echo "   sudo apt update"
    echo "   sudo apt install caddy"
fi

echo ""
echo -e "${GREEN}✅ Деплой завершен успешно!${NC}"
echo ""
echo "📊 Полезные команды:"
echo "  pm2 status          - статус приложения"
echo "  pm2 logs            - просмотр логов"
echo "  pm2 restart qr-generator - перезапуск"
echo "  pm2 stop qr-generator    - остановка"
echo "  pm2 monit           - мониторинг в реальном времени"
echo ""
echo "🌐 Caddy команды:"
echo "  sudo systemctl status caddy  - статус Caddy"
echo "  sudo systemctl reload caddy  - перезагрузка конфигурации"
echo "  sudo caddy fmt --overwrite /etc/caddy/Caddyfile - форматирование Caddyfile"
echo "  sudo journalctl -u caddy -f  - логи Caddy"
echo ""
echo "🌐 Приложение доступно на: http://localhost:3000"
echo "   После настройки Caddy: https://yourdomain.com"
echo ""

