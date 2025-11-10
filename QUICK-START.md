# 🚀 Быстрый старт - Деплой на VPS

## 📋 Что вам нужно:
- VPS сервер (Ubuntu/Debian)
- SSH доступ к серверу
- Домен (опционально)

---

## ⚡ Способ 1: Быстрая загрузка (SCP)

### На вашем локальном компьютере:

```bash
# 1. Упакуйте проект
cd "/Users/rostislavgolivetc/Downloads/QR generator"
./package-for-deploy.sh

# 2. Загрузите на сервер
scp qr-generator-deploy.tar.gz your-user@your-server-ip:/tmp/
```

### На VPS сервере:

```bash
# 1. Установите Node.js (если не установлен)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 2. Распакуйте проект
sudo mkdir -p /var/www/qr-generator
sudo tar -xzf /tmp/qr-generator-deploy.tar.gz -C /var/www/qr-generator
cd /var/www/qr-generator

# 3. Запустите автоматический деплой
./deploy.sh

# 4. Установите Nginx (опционально)
sudo apt install -y nginx
sudo cp nginx.conf /etc/nginx/sites-available/qr-generator
sudo ln -s /etc/nginx/sites-available/qr-generator /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Отредактируйте конфигурацию (замените yourdomain.com на ваш домен или IP)
sudo nano /etc/nginx/sites-available/qr-generator

# Перезапустите Nginx
sudo nginx -t
sudo systemctl restart nginx

# 5. Настройте firewall
sudo ufw allow 'Nginx Full'
sudo ufw allow ssh
sudo ufw enable
```

---

## 🔄 Способ 2: Через rsync (для обновлений)

```bash
# Синхронизация с сервером
rsync -avz --exclude='node_modules' --exclude='qr_codes.db' \
  "/Users/rostislavgolivetc/Downloads/QR generator/" \
  your-user@your-server-ip:/var/www/qr-generator/

# Затем на сервере
ssh your-user@your-server-ip
cd /var/www/qr-generator
./deploy.sh
```

---

## 📦 Способ 3: Через Git

```bash
# 1. Создайте репозиторий на GitHub/GitLab
# 2. Загрузите код в репозиторий

# На сервере:
cd /var/www
sudo git clone https://github.com/your-username/qr-generator.git
cd qr-generator
./deploy.sh
```

---

## 🔒 Установка SSL (HTTPS)

```bash
# Установите Certbot
sudo apt install -y certbot python3-certbot-nginx

# Получите сертификат (замените yourdomain.com)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Автоматическое обновление уже настроено!
```

---

## ✅ Проверка работы

Откройте в браузере:
- **Без домена:** `http://your-server-ip`
- **С доменом:** `http://yourdomain.com`
- **С SSL:** `https://yourdomain.com`

---

## 📊 Полезные команды

```bash
# Статус приложения
pm2 status

# Логи в реальном времени
pm2 logs qr-generator

# Перезапуск
pm2 restart qr-generator

# Остановка
pm2 stop qr-generator

# Мониторинг
pm2 monit
```

---

## 🔧 Если что-то пошло не так

```bash
# Проверьте логи
pm2 logs qr-generator --lines 100

# Проверьте статус Nginx
sudo systemctl status nginx
sudo nginx -t

# Перезапустите всё
pm2 restart qr-generator
sudo systemctl restart nginx

# Проверьте порт
sudo netstat -tulpn | grep 3000
```

---

## 📝 Настройка домена

### В панели управления доменом добавьте A-запись:

```
Тип: A
Имя: @
Значение: YOUR_SERVER_IP

Тип: A
Имя: www
Значение: YOUR_SERVER_IP
```

Подождите 5-30 минут для распространения DNS.

---

## 🎯 Быстрая шпаргалка команд

```bash
# На локальном компьютере
./package-for-deploy.sh                    # Упаковать проект
scp qr-generator-deploy.tar.gz user@ip:/tmp/  # Загрузить

# На сервере
sudo tar -xzf /tmp/qr-generator-deploy.tar.gz -C /var/www/qr-generator
cd /var/www/qr-generator
./deploy.sh                                # Деплой

# Для обновлений
git pull && ./deploy.sh                    # Через Git
# или
rsync ... && ./deploy.sh                   # Через rsync
```

---

## 💡 Совет

Для первого раза используйте **Способ 1 (SCP)** - это самый простой и надежный способ!

Подробная документация: см. файл `DEPLOY.md`

---

Удачи! 🚀

