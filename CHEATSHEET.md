# 📋 Шпаргалка по командам

Быстрый справочник самых важных команд для работы с QR Generator.

---

## 🚀 Быстрый деплой (3 шага)

```bash
# 1. На локальном компьютере
cd "/Users/rostislavgolivetc/Downloads/QR generator"
./package-for-deploy.sh
scp qr-generator-deploy.tar.gz root@YOUR_SERVER_IP:/tmp/

# 2. На VPS сервере - установка Node.js
ssh root@YOUR_SERVER_IP
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs git nginx

# 3. На VPS сервере - деплой
mkdir -p /var/www/qr-generator
tar -xzf /tmp/qr-generator-deploy.tar.gz -C /var/www/qr-generator
cd /var/www/qr-generator
./deploy.sh
```

**Готово!** Откройте `http://YOUR_SERVER_IP`

---

## 📦 Управление приложением (PM2)

```bash
# Статус
pm2 status

# Логи (в реальном времени)
pm2 logs qr-generator

# Логи (последние 100 строк)
pm2 logs qr-generator --lines 100

# Перезапуск
pm2 restart qr-generator

# Остановка
pm2 stop qr-generator

# Запуск
pm2 start qr-generator

# Удаление из PM2
pm2 delete qr-generator

# Мониторинг
pm2 monit

# Информация о процессе
pm2 info qr-generator

# Сохранить список процессов
pm2 save

# Список всех процессов
pm2 list
```

---

## 🌐 Управление веб-сервером

### Caddy (рекомендуется)

```bash
# Проверка конфигурации
sudo caddy validate --config /etc/caddy/Caddyfile

# Форматирование конфигурации
sudo caddy fmt --overwrite /etc/caddy/Caddyfile

# Перезапуск
sudo systemctl restart caddy

# Остановка
sudo systemctl stop caddy

# Запуск
sudo systemctl start caddy

# Статус
sudo systemctl status caddy

# Перезагрузка конфигурации (без остановки - рекомендуется)
sudo systemctl reload caddy

# Просмотр логов (в реальном времени)
sudo journalctl -u caddy -f

# Последние 100 строк логов
sudo journalctl -u caddy -n 100

# Редактирование конфигурации
sudo nano /etc/caddy/Caddyfile

# Версия Caddy
caddy version
```

### Nginx (альтернатива)

```bash
# Проверка конфигурации
sudo nginx -t

# Перезапуск
sudo systemctl restart nginx

# Остановка
sudo systemctl stop nginx

# Запуск
sudo systemctl start nginx

# Статус
sudo systemctl status nginx

# Перезагрузка конфигурации (без остановки)
sudo systemctl reload nginx

# Просмотр логов (ошибки)
sudo tail -f /var/log/nginx/error.log

# Просмотр логов (доступ)
sudo tail -f /var/log/nginx/access.log

# Последние 100 строк логов
sudo tail -100 /var/log/nginx/error.log
```

---

## 🔒 SSL сертификат

### Caddy (автоматический SSL)

```bash
# SSL настраивается АВТОМАТИЧЕСКИ!
# Просто укажите домен в /etc/caddy/Caddyfile:
# yourdomain.com {
#     reverse_proxy localhost:3000
# }

# Перезагрузите Caddy
sudo systemctl reload caddy

# Сертификаты хранятся в:
# /var/lib/caddy/.local/share/caddy/certificates/

# Проверка SSL
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com
```

### Nginx + Certbot (ручная настройка)

```bash
# Установка Certbot
sudo apt install -y certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Проверка сертификатов
sudo certbot certificates

# Тестовое обновление
sudo certbot renew --dry-run

# Обновление сертификата
sudo certbot renew

# Удаление сертификата
sudo certbot delete --cert-name yourdomain.com
```

---

## 🔥 Firewall (UFW)

```bash
# Статус
sudo ufw status

# Включить
sudo ufw enable

# Выключить
sudo ufw disable

# Разрешить SSH
sudo ufw allow ssh

# Разрешить HTTP и HTTPS
sudo ufw allow 'Nginx Full'

# Разрешить конкретный порт
sudo ufw allow 3000

# Заблокировать порт
sudo ufw deny 3000

# Удалить правило
sudo ufw delete allow 3000

# Список правил с номерами
sudo ufw status numbered

# Удалить правило по номеру
sudo ufw delete 1

# Сбросить все правила
sudo ufw reset
```

---

## 📊 Мониторинг системы

```bash
# Использование диска
df -h

# Использование памяти
free -m

# Использование CPU и памяти (в реальном времени)
htop
# или
top

# Все процессы Node.js
ps aux | grep node

# Открытые порты
sudo netstat -tulpn
# или
sudo ss -tulpn

# Проверка порта 3000
sudo lsof -i :3000

# Убить процесс на порту 3000
sudo kill -9 $(sudo lsof -t -i:3000)

# Информация о системе
uname -a

# Время работы сервера
uptime

# Версия Node.js
node -v

# Версия npm
npm -v

# Версия Nginx
nginx -v
```

---

## 📁 Работа с файлами

```bash
# Перейти в директорию проекта
cd /var/www/qr-generator

# Посмотреть содержимое
ls -la

# Права доступа
chmod 755 deploy.sh
chmod 600 .env
chmod 644 qr_codes.db

# Владелец файлов
sudo chown -R $USER:$USER /var/www/qr-generator

# Просмотр файла
cat server.js
# или с пагинацией
less server.js

# Редактирование
nano .env
# Сохранить: Ctrl+X, Y, Enter

# Поиск файла
find /var/www -name "qr_codes.db"

# Размер файла/директории
du -sh /var/www/qr-generator
```

---

## 💾 Резервное копирование

```bash
# Создать бэкап базы данных
cp /var/www/qr-generator/qr_codes.db ~/qr_backup_$(date +%Y%m%d).db

# Архивировать с сжатием
tar -czf ~/qr-backup-$(date +%Y%m%d).tar.gz /var/www/qr-generator

# Скачать на локальный компьютер
# На локальном компьютере:
scp root@YOUR_SERVER_IP:~/qr_backup_*.db ~/Desktop/

# Загрузить бэкап на сервер
scp ~/backup.db root@YOUR_SERVER_IP:/tmp/

# Восстановить базу данных
cp /tmp/backup.db /var/www/qr-generator/qr_codes.db
pm2 restart qr-generator
```

---

## 🔄 Обновление приложения

### Способ 1: Через rsync

```bash
# На локальном компьютере
rsync -avz --exclude='node_modules' --exclude='qr_codes.db' \
  "/Users/rostislavgolivetc/Downloads/QR generator/" \
  root@YOUR_SERVER_IP:/var/www/qr-generator/

# На сервере
ssh root@YOUR_SERVER_IP
cd /var/www/qr-generator
npm install --production
pm2 restart qr-generator
```

### Способ 2: Через Git

```bash
# На сервере
cd /var/www/qr-generator
git pull origin main
npm install --production
pm2 restart qr-generator
```

### Способ 3: Полный деплой

```bash
cd /var/www/qr-generator
./deploy.sh
```

---

## 🐛 Отладка проблем

```bash
# Проверить логи приложения
pm2 logs qr-generator --lines 200

# Проверить логи Nginx
sudo tail -100 /var/log/nginx/error.log

# Проверить системные логи
sudo journalctl -xe

# Проверить логи SSH
sudo tail -50 /var/log/auth.log

# Проверить запущено ли приложение
pm2 status

# Проверить слушает ли приложение порт
sudo netstat -tulpn | grep 3000

# Тест Nginx конфигурации
sudo nginx -t

# Перезапуск всего
pm2 restart qr-generator
sudo systemctl restart caddy  # или nginx

# Полная перезагрузка сервера (осторожно!)
sudo reboot
```

---

## 📝 Управление логами

```bash
# Очистить логи PM2
pm2 flush

# Ротация логов PM2
pm2 install pm2-logrotate

# Очистить логи Nginx
sudo truncate -s 0 /var/log/nginx/access.log
sudo truncate -s 0 /var/log/nginx/error.log

# Размер логов
du -sh /var/log/nginx/
du -sh /var/www/qr-generator/logs/

# Удалить старые логи
find /var/www/qr-generator/logs/ -name "*.log" -mtime +7 -delete
```

---

## 🔧 Системные операции

```bash
# Обновление системы
sudo apt update
sudo apt upgrade -y

# Установка пакетов
sudo apt install -y package-name

# Очистка системы
sudo apt autoremove -y
sudo apt clean

# Проверка дискового пространства
df -h

# Освобождение места
sudo journalctl --vacuum-time=3d

# Перезагрузка
sudo reboot

# Выключение
sudo shutdown now

# Проверка времени и даты
date
timedatectl

# Установка часового пояса
sudo timedatectl set-timezone Europe/Moscow
```

---

## 🔑 SSH и безопасность

```bash
# Генерация SSH ключа (на локальном компьютере)
ssh-keygen -t rsa -b 4096

# Копирование ключа на сервер
ssh-copy-id root@YOUR_SERVER_IP

# Подключение с ключом
ssh -i ~/.ssh/id_rsa root@YOUR_SERVER_IP

# Проверка Fail2Ban
sudo fail2ban-client status

# Статус SSH бана
sudo fail2ban-client status sshd

# Разблокировать IP
sudo fail2ban-client set sshd unbanip IP_ADDRESS

# Список заблокированных IP
sudo fail2ban-client get sshd banned
```

---

## 🌐 Работа с доменом

```bash
# Проверка DNS
dig yourdomain.com
nslookup yourdomain.com

# Проверка A-записи
dig yourdomain.com A +short

# Проверка всех записей
dig yourdomain.com ANY

# Проверка с конкретного DNS сервера
dig @8.8.8.8 yourdomain.com

# Ping домена
ping yourdomain.com

# Traceroute
traceroute yourdomain.com

# Проверка доступности
curl -I http://yourdomain.com
```

---

## 📱 Тестирование приложения

```bash
# Проверка локально
curl http://localhost:3000

# Проверка извне
curl http://YOUR_SERVER_IP

# Проверка с доменом
curl http://yourdomain.com

# Проверка HTTPS
curl https://yourdomain.com

# Проверка API
curl -X POST http://localhost:3000/api/qr/create \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","title":"Test"}'

# Список QR кодов
curl http://localhost:3000/api/qr/list
```

---

## 💡 Полезные алиасы

Добавьте в `~/.bashrc` для быстрого доступа:

```bash
# Редактировать
nano ~/.bashrc

# Добавьте (для Caddy):
alias qr='cd /var/www/qr-generator'
alias qrlogs='pm2 logs qr-generator'
alias qrrestart='pm2 restart qr-generator'
alias qrstatus='pm2 status'
alias caddyreload='sudo systemctl reload caddy'
alias caddytest='sudo caddy validate --config /etc/caddy/Caddyfile'
alias caddylogs='sudo journalctl -u caddy -f'

# Или для Nginx:
alias nginxreload='sudo systemctl reload nginx'
alias nginxtest='sudo nginx -t'
alias nginxlogs='sudo tail -f /var/log/nginx/error.log'

# Сохраните и примените
source ~/.bashrc
```

Теперь используйте:
```bash
qr            # перейти в директорию
qrlogs        # посмотреть логи приложения
qrrestart     # перезапустить приложение
caddyreload   # перезагрузить Caddy
caddylogs     # логи Caddy
```

---

## 🆘 Экстренные команды

```bash
# Приложение не работает
pm2 restart qr-generator
pm2 logs qr-generator

# Caddy не работает
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl restart caddy
sudo journalctl -u caddy -n 50

# Nginx не работает (если используете)
sudo nginx -t
sudo systemctl restart nginx

# Порт занят
sudo lsof -ti:3000 | xargs kill -9

# Места нет на диске
df -h
sudo apt clean
sudo journalctl --vacuum-time=3d

# Сервер не отвечает (только из другого терминала!)
sudo reboot

# Забыли пароль root (обратитесь в поддержку хостинга)
```

---

## 📞 Быстрые ссылки на документацию

- Полная инструкция: `cat DEPLOY.md`
- Быстрый старт: `cat QUICK-START.md`
- Безопасность: `cat SECURITY.md`
- Провайдеры: `cat VPS-PROVIDERS.md`
- Файлы проекта: `cat FILES-OVERVIEW.md`

---

## ✅ Ежедневный чек-лист

```bash
# Утренняя проверка
pm2 status                          # Приложение работает?
df -h                               # Есть место на диске?
free -m                             # Достаточно памяти?
sudo fail2ban-client status         # Firewall в порядке?
curl http://yourdomain.com          # Сайт доступен?
```

---

## 🎯 Самые важные команды (топ-10)

```bash
pm2 status                                    # 1. Статус приложения
pm2 logs qr-generator                        # 2. Логи приложения
pm2 restart qr-generator                     # 3. Перезапуск приложения
sudo systemctl restart caddy                 # 4. Перезапуск Caddy
sudo caddy validate --config /etc/caddy/Caddyfile  # 5. Проверка конфигурации
df -h                                        # 6. Проверка диска
cd /var/www/qr-generator                    # 7. Переход в проект
./deploy-caddy.sh                           # 8. Деплой
sudo ufw status                             # 9. Статус firewall
sudo journalctl -u caddy -f                 # 10. Логи Caddy
```

---

**Сохраните эту шпаргалку!** 🔖

Распечатайте или держите под рукой для быстрого доступа к командам.

