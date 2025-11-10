# 🌐 Настройка Caddy для QR Generator

Caddy - современный веб-сервер с автоматическим SSL! Намного проще, чем Nginx.

---

## ⚡ Преимущества Caddy

- ✅ **Автоматический HTTPS** - SSL сертификаты устанавливаются автоматически
- ✅ **Простая конфигурация** - понятный синтаксис
- ✅ **Автоматическое обновление сертификатов** - не нужен Certbot
- ✅ **HTTP/2 по умолчанию**
- ✅ **Встроенное сжатие**

---

## 🚀 Быстрая установка (3 шага)

### Шаг 1: Установка Caddy на сервере

```bash
# Подключитесь к серверу
ssh root@your-server-ip

# Установка Caddy (Ubuntu/Debian)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

# Проверка установки
caddy version
```

### Шаг 2: Установка Node.js и деплой приложения

```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs git

# Загрузка проекта (через SCP или Git)
sudo mkdir -p /var/www/qr-generator
cd /var/www/qr-generator

# Запуск деплоя
./deploy-caddy.sh
```

### Шаг 3: Настройка Caddy

```bash
# Скопируйте Caddyfile
sudo cp /var/www/qr-generator/Caddyfile /etc/caddy/Caddyfile

# Отредактируйте - замените yourdomain.com на ваш домен
sudo nano /etc/caddy/Caddyfile

# Проверьте конфигурацию
sudo caddy validate --config /etc/caddy/Caddyfile

# Перезапустите Caddy
sudo systemctl reload caddy
```

**Готово!** Откройте `https://yourdomain.com` - SSL уже работает! 🎉

---

## 📝 Конфигурация Caddyfile

### Вариант 1: С доменом (рекомендуется)

```caddy
# /etc/caddy/Caddyfile

yourdomain.com {
    reverse_proxy localhost:3000
    
    # Caddy автоматически добавит HTTPS!
    
    encode gzip
    
    header {
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
    }
}
```

### Вариант 2: Только IP адрес (без SSL)

```caddy
# /etc/caddy/Caddyfile

:80 {
    reverse_proxy localhost:3000
    encode gzip
}
```

### Вариант 3: Несколько доменов

```caddy
# /etc/caddy/Caddyfile

yourdomain.com, anotherdomain.com {
    reverse_proxy localhost:3000
    encode gzip
}
```

### Вариант 4: С редиректом www

```caddy
# /etc/caddy/Caddyfile

www.yourdomain.com {
    redir https://yourdomain.com{uri} permanent
}

yourdomain.com {
    reverse_proxy localhost:3000
    encode gzip
}
```

---

## 🔧 Управление Caddy

### Основные команды

```bash
# Статус
sudo systemctl status caddy

# Запуск
sudo systemctl start caddy

# Остановка
sudo systemctl stop caddy

# Перезапуск
sudo systemctl restart caddy

# Перезагрузка конфигурации (без остановки)
sudo systemctl reload caddy

# Автозапуск при загрузке системы
sudo systemctl enable caddy
```

### Проверка и форматирование

```bash
# Проверка конфигурации
sudo caddy validate --config /etc/caddy/Caddyfile

# Автоматическое форматирование Caddyfile
sudo caddy fmt --overwrite /etc/caddy/Caddyfile

# Просмотр конфигурации
cat /etc/caddy/Caddyfile

# Редактирование
sudo nano /etc/caddy/Caddyfile
```

### Логи

```bash
# Логи Caddy (в реальном времени)
sudo journalctl -u caddy -f

# Последние 100 строк
sudo journalctl -u caddy -n 100

# Логи доступа (если настроены в Caddyfile)
sudo tail -f /var/log/caddy/qr-generator-access.log

# Все системные логи
sudo journalctl -xe
```

---

## 🔒 SSL сертификаты

### Автоматическое получение SSL

Caddy **автоматически** получит SSL сертификат от Let's Encrypt, если:

1. ✅ У вас есть домен
2. ✅ Домен указывает на ваш сервер (A-запись)
3. ✅ Порты 80 и 443 открыты
4. ✅ Caddy может получить доступ к портам

**Не нужно ничего делать!** Просто укажите домен в Caddyfile и запустите Caddy.

### Где хранятся сертификаты

```bash
# Сертификаты хранятся в:
/var/lib/caddy/.local/share/caddy/certificates/

# Просмотр сертификатов
sudo ls -la /var/lib/caddy/.local/share/caddy/certificates/acme-v02.api.letsencrypt.org-directory/
```

### Ручное обновление сертификата

```bash
# Caddy обновляет автоматически, но можно и вручную:
sudo systemctl reload caddy
```

### Проверка SSL

```bash
# Проверка онлайн
# https://www.ssllabs.com/ssltest/

# Проверка локально
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Дата истечения сертификата
echo | openssl s_client -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates
```

---

## 🔥 Настройка Firewall

```bash
# Установка UFW
sudo apt install -y ufw

# Разрешить SSH (ВАЖНО - сделайте это первым!)
sudo ufw allow ssh

# Разрешить HTTP и HTTPS для Caddy
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Включить firewall
sudo ufw enable

# Проверить статус
sudo ufw status
```

---

## 🎯 Продвинутая конфигурация

### С логированием

```caddy
yourdomain.com {
    log {
        output file /var/log/caddy/access.log {
            roll_size 10MB
            roll_keep 10
        }
        format json
    }
    
    reverse_proxy localhost:3000
}
```

### С кэшированием

```caddy
yourdomain.com {
    reverse_proxy localhost:3000
    
    @static {
        path *.jpg *.jpeg *.png *.gif *.ico *.css *.js *.svg *.woff *.woff2
    }
    
    header @static {
        Cache-Control "public, max-age=2592000, immutable"
    }
}
```

### С rate limiting (требует плагин)

```caddy
yourdomain.com {
    rate_limit {
        zone dynamic {
            key {remote_host}
            events 100
            window 1m
        }
    }
    
    reverse_proxy localhost:3000
}
```

### С несколькими приложениями

```caddy
# Приложение 1
app1.yourdomain.com {
    reverse_proxy localhost:3000
}

# Приложение 2
app2.yourdomain.com {
    reverse_proxy localhost:4000
}

# Статический сайт
yourdomain.com {
    root * /var/www/html
    file_server
}
```

---

## 🐛 Решение проблем

### Caddy не запускается

```bash
# Проверьте статус
sudo systemctl status caddy

# Проверьте логи
sudo journalctl -u caddy -n 50

# Проверьте конфигурацию
sudo caddy validate --config /etc/caddy/Caddyfile

# Проверьте, свободен ли порт 80
sudo netstat -tulpn | grep :80

# Убедитесь, что Nginx не запущен
sudo systemctl stop nginx
sudo systemctl disable nginx
```

### SSL не работает

```bash
# Проверьте, что домен указывает на сервер
dig yourdomain.com A +short
# Должен показать IP вашего сервера

# Проверьте порты
sudo ufw status
# 80 и 443 должны быть открыты

# Проверьте логи
sudo journalctl -u caddy -f

# Попробуйте перезапустить
sudo systemctl restart caddy
```

### 502 Bad Gateway

```bash
# Приложение не запущено?
pm2 status

# Перезапустите приложение
pm2 restart qr-generator

# Проверьте, что приложение слушает порт 3000
sudo netstat -tulpn | grep :3000

# Проверьте логи приложения
pm2 logs qr-generator
```

### "Permission denied" при доступе к портам

```bash
# Дайте Caddy права на порты 80 и 443
sudo setcap 'cap_net_bind_service=+ep' $(which caddy)

# Или запустите как root (не рекомендуется)
sudo systemctl restart caddy
```

---

## 🔄 Обновление Caddy

```bash
# Обновление через apt
sudo apt update
sudo apt upgrade caddy

# Проверка версии
caddy version

# После обновления перезапустите
sudo systemctl restart caddy
```

---

## 📊 Мониторинг

### Проверка работы

```bash
# Статус сервиса
sudo systemctl status caddy

# Открытые порты
sudo netstat -tulpn | grep caddy

# Процессы
ps aux | grep caddy

# Использование ресурсов
sudo systemctl status caddy | grep -i memory
```

### Тестирование

```bash
# HTTP
curl -I http://yourdomain.com

# HTTPS
curl -I https://yourdomain.com

# Проверка редиректа
curl -I http://yourdomain.com

# Проверка заголовков
curl -I https://yourdomain.com | grep -i "X-"
```

---

## 📋 Чек-лист установки Caddy

- [ ] Caddy установлен (`caddy version`)
- [ ] Приложение запущено (`pm2 status`)
- [ ] Caddyfile настроен с вашим доменом
- [ ] Домен указывает на сервер (A-запись)
- [ ] Firewall настроен (порты 80, 443)
- [ ] Caddy запущен (`systemctl status caddy`)
- [ ] SSL сертификат получен (откройте https://)
- [ ] Сайт доступен через HTTPS

---

## 🆚 Caddy vs Nginx

| Особенность | Caddy | Nginx |
|-------------|-------|-------|
| **SSL** | Автоматический | Ручной (Certbot) |
| **Конфигурация** | Простая | Сложная |
| **Обновление SSL** | Автоматическое | Cron задача |
| **HTTP/2** | По умолчанию | Нужно включать |
| **Производительность** | Отличная | Отличная |
| **Документация** | Современная | Обширная |

---

## 🎓 Полезные ресурсы

- **Официальная документация:** https://caddyserver.com/docs/
- **Примеры конфигураций:** https://github.com/caddyserver/examples
- **Форум сообщества:** https://caddy.community/
- **GitHub:** https://github.com/caddyserver/caddy

---

## 💡 Советы

1. **Используйте домен** - для автоматического SSL
2. **Форматируйте Caddyfile** - `caddy fmt --overwrite`
3. **Проверяйте перед перезапуском** - `caddy validate`
4. **Используйте reload вместо restart** - без простоя
5. **Мониторьте логи** - `journalctl -u caddy -f`

---

## ⚡ Быстрые команды

```bash
# Самые частые операции
sudo nano /etc/caddy/Caddyfile          # Редактировать
sudo caddy fmt --overwrite /etc/caddy/Caddyfile  # Форматировать
sudo caddy validate --config /etc/caddy/Caddyfile # Проверить
sudo systemctl reload caddy              # Применить изменения
sudo journalctl -u caddy -f              # Смотреть логи
```

---

**Caddy настроен!** Наслаждайтесь автоматическим HTTPS! 🔒✨

Если возникли проблемы - смотрите раздел "Решение проблем" выше.

