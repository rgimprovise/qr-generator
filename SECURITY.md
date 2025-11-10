# 🔒 Рекомендации по безопасности

## Общие рекомендации

### 1. Настройка SSH

```bash
# Отключите вход по паролю, используйте только SSH ключи
sudo nano /etc/ssh/sshd_config
```

Измените:
```
PasswordAuthentication no
PermitRootLogin no
```

```bash
sudo systemctl restart sshd
```

### 2. Настройка Firewall (UFW)

```bash
# Установка
sudo apt install -y ufw

# Базовые правила
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Разрешить необходимые порты
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'

# Включить
sudo ufw enable
sudo ufw status
```

### 3. Установка Fail2Ban

Защита от брутфорс атак:

```bash
# Установка
sudo apt install -y fail2ban

# Создание конфигурации
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local
```

Настройте секцию SSH:
```ini
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
```

```bash
# Запуск
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
sudo fail2ban-client status
```

### 4. Автоматические обновления безопасности

```bash
# Установка
sudo apt install -y unattended-upgrades

# Настройка
sudo dpkg-reconfigure -plow unattended-upgrades
```

### 5. Настройка логов и мониторинга

```bash
# Установка logwatch
sudo apt install -y logwatch

# Настройка ежедневных отчетов
sudo nano /etc/cron.daily/00logwatch
```

Содержимое:
```bash
#!/bin/bash
/usr/sbin/logwatch --output mail --mailto your@email.com --detail high
```

```bash
chmod +x /etc/cron.daily/00logwatch
```

## Безопасность приложения

### 1. Ограничение прав доступа

```bash
# Создание отдельного пользователя для приложения
sudo useradd -r -s /bin/false qrapp

# Настройка прав
sudo chown -R qrapp:qrapp /var/www/qr-generator
sudo chmod -R 755 /var/www/qr-generator

# База данных должна быть доступна только для записи приложению
sudo chmod 600 /var/www/qr-generator/qr_codes.db
```

### 2. Переменные окружения

Никогда не храните секретные данные в коде! Используйте `.env`:

```bash
# Создайте .env файл
nano /var/www/qr-generator/.env
```

Пример:
```env
PORT=3000
NODE_ENV=production
DOMAIN=yourdomain.com
# В будущем можно добавить:
# DB_PASSWORD=your_secure_password
# API_KEY=your_api_key
# SESSION_SECRET=random_string
```

```bash
# Защитите .env файл
chmod 600 /var/www/qr-generator/.env
```

### 3. Rate Limiting

Добавьте защиту от DDoS в Nginx:

```nginx
# В конфигурацию Nginx добавьте
limit_req_zone $binary_remote_addr zone=qrlimit:10m rate=10r/s;

server {
    location / {
        limit_req zone=qrlimit burst=20 nodelay;
        # ... остальная конфигурация
    }
}
```

### 4. Заголовки безопасности

Добавьте в Nginx конфигурацию:

```nginx
server {
    # Безопасные заголовки
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval';" always;
    
    # ... остальная конфигурация
}
```

### 5. Резервное копирование

#### Автоматический бэкап базы данных:

```bash
# Создайте скрипт
sudo nano /usr/local/bin/backup-qr-db.sh
```

Содержимое:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/qr-generator"
DB_PATH="/var/www/qr-generator/qr_codes.db"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
cp $DB_PATH $BACKUP_DIR/qr_codes_$DATE.db
gzip $BACKUP_DIR/qr_codes_$DATE.db

# Удалить бэкапы старше 30 дней
find $BACKUP_DIR -name "qr_codes_*.db.gz" -mtime +30 -delete

echo "Backup created: qr_codes_$DATE.db.gz"
```

```bash
# Сделайте исполняемым
sudo chmod +x /usr/local/bin/backup-qr-db.sh

# Добавьте в cron (ежедневно в 2:00)
sudo crontab -e
# Добавьте:
0 2 * * * /usr/local/bin/backup-qr-db.sh >> /var/log/qr-backup.log 2>&1
```

#### Бэкап на удаленный сервер:

```bash
# Через rsync на другой сервер
rsync -avz /var/backups/qr-generator/ backup-user@backup-server:/backups/qr-generator/
```

## Мониторинг безопасности

### 1. Проверка открытых портов

```bash
sudo netstat -tulpn
# или
sudo ss -tulpn
```

### 2. Проверка запущенных процессов

```bash
ps aux | grep node
pm2 status
```

### 3. Проверка логов

```bash
# Логи приложения
pm2 logs qr-generator --lines 100

# Логи Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Системные логи
sudo journalctl -xe
sudo tail -f /var/log/auth.log
```

### 4. Проверка на вирусы (опционально)

```bash
# Установка ClamAV
sudo apt install -y clamav clamav-daemon

# Обновление базы
sudo freshclam

# Сканирование
sudo clamscan -r /var/www/qr-generator
```

## SSL/TLS настройки

### Усиленная конфигурация SSL в Nginx:

```nginx
server {
    listen 443 ssl http2;
    
    # SSL сертификаты
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # Современные SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/letsencrypt/live/yourdomain.com/chain.pem;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;
    
    # Остальная конфигурация...
}
```

### Тест SSL конфигурации:

```bash
# Используйте SSL Labs
# https://www.ssllabs.com/ssltest/

# Или локально
openssl s_client -connect yourdomain.com:443 -tls1_2
```

## Регулярное обслуживание

### Еженедельный чек-лист:

```bash
# 1. Обновление системы
sudo apt update && sudo apt upgrade -y

# 2. Проверка логов
sudo tail -100 /var/log/auth.log
pm2 logs --lines 100

# 3. Проверка дискового пространства
df -h

# 4. Проверка памяти
free -m

# 5. Проверка fail2ban
sudo fail2ban-client status

# 6. Проверка SSL сертификата
sudo certbot certificates

# 7. Проверка бэкапов
ls -lh /var/backups/qr-generator/
```

## Контакты для сообщения о проблемах безопасности

Если вы обнаружили уязвимость, пожалуйста, свяжитесь с администратором напрямую, а не публикуйте информацию публично.

## Дополнительные ресурсы

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- Mozilla Security Guidelines: https://infosec.mozilla.org/guidelines/
- Nginx Security: https://nginx.org/en/docs/http/ngx_http_ssl_module.html
- Let's Encrypt Best Practices: https://letsencrypt.org/docs/

---

**Помните:** Безопасность - это постоянный процесс, а не одноразовая настройка!

Последнее обновление: Ноябрь 2025

