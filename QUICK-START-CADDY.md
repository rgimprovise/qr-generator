# 🚀 Быстрый старт с Caddy

Развертывание QR Generator с Caddy за 5 минут!

---

## ⚡ Супер-быстрая установка (копируй-вставляй)

### 1️⃣ На вашем компьютере (упаковка)

```bash
cd "/Users/rostislavgolivetc/Downloads/QR generator"
./package-for-deploy.sh
scp qr-generator-deploy.tar.gz root@YOUR_SERVER_IP:/tmp/
```

### 2️⃣ На VPS сервере (установка всего)

```bash
# Подключитесь к серверу
ssh root@YOUR_SERVER_IP

# === Установка Node.js ===
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs git

# === Установка Caddy ===
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install -y caddy

# === Деплой приложения ===
mkdir -p /var/www/qr-generator
tar -xzf /tmp/qr-generator-deploy.tar.gz -C /var/www/qr-generator
cd /var/www/qr-generator
./deploy-caddy.sh

# === Настройка Caddy ===
cp Caddyfile /etc/caddy/Caddyfile

# ВАЖНО: Замените yourdomain.com на ваш домен!
nano /etc/caddy/Caddyfile
# Или если НЕТ домена, раскомментируйте секцию с :80

# Применить конфигурацию
systemctl reload caddy

# === Настройка Firewall ===
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

### 3️⃣ Откройте в браузере

- **С доменом:** `https://yourdomain.com` (SSL уже работает!)
- **Без домена:** `http://YOUR_SERVER_IP`

**Готово!** 🎉

---

## 📝 Если нет домена

Измените `/etc/caddy/Caddyfile`:

```caddy
:80 {
    reverse_proxy localhost:3000
    encode gzip
}
```

Затем:
```bash
sudo systemctl reload caddy
```

Откройте: `http://YOUR_SERVER_IP`

---

## 🔒 Если есть домен

### Настройте DNS (в панели домена):

```
Тип: A
Имя: @
Значение: YOUR_SERVER_IP

Тип: A  
Имя: www
Значение: YOUR_SERVER_IP
```

### Настройте Caddyfile:

```caddy
yourdomain.com {
    reverse_proxy localhost:3000
    encode gzip
}
```

**SSL настроится автоматически!** Просто подождите 1-2 минуты.

---

## ✅ Проверка работы

```bash
# Статус приложения
pm2 status

# Статус Caddy
sudo systemctl status caddy

# Логи
pm2 logs qr-generator
sudo journalctl -u caddy -f

# Тест
curl http://localhost:3000
```

---

## 🔧 Основные команды

```bash
# Перезапуск приложения
pm2 restart qr-generator

# Перезапуск Caddy (с простоем)
sudo systemctl restart caddy

# Перезагрузка Caddy (без простоя)
sudo systemctl reload caddy

# Просмотр логов
pm2 logs qr-generator
sudo journalctl -u caddy -f
```

---

## 🐛 Если что-то не работает

```bash
# 1. Проверьте приложение
pm2 status
pm2 logs qr-generator

# 2. Проверьте Caddy
sudo systemctl status caddy
sudo journalctl -u caddy -n 50

# 3. Проверьте конфигурацию
sudo caddy validate --config /etc/caddy/Caddyfile

# 4. Проверьте порты
sudo netstat -tulpn | grep -E ':(80|443|3000)'

# 5. Проверьте firewall
sudo ufw status

# 6. Перезапустите всё
pm2 restart qr-generator
sudo systemctl restart caddy
```

---

## 🔄 Обновление приложения

```bash
# Через rsync (с локального компьютера)
rsync -avz --exclude='node_modules' --exclude='qr_codes.db' \
  "/Users/rostislavgolivetc/Downloads/QR generator/" \
  root@YOUR_SERVER_IP:/var/www/qr-generator/

# На сервере
cd /var/www/qr-generator
npm install --production
pm2 restart qr-generator
```

---

## 💡 Полезные файлы

- `CADDY-SETUP.md` - детальная инструкция по Caddy
- `DEPLOY.md` - полная документация по деплою
- `CHEATSHEET.md` - шпаргалка по командам
- `SECURITY.md` - настройка безопасности

---

## 📊 Что дальше?

После базовой установки рекомендуется:

1. ✅ Настроить резервное копирование (`SECURITY.md`)
2. ✅ Установить Fail2Ban
3. ✅ Настроить мониторинг
4. ✅ Проверить SSL на ssllabs.com

---

**Всё работает!** 🚀 Наслаждайтесь вашим QR Generator с автоматическим HTTPS!

