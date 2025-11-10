# 🌐 Инструкции для популярных VPS провайдеров

Пошаговые инструкции для деплоя на различных VPS провайдерах.

---

## 🔷 DigitalOcean

### 1. Создание Droplet

1. Войдите на https://digitalocean.com
2. Нажмите **Create → Droplets**
3. Выберите:
   - **Image:** Ubuntu 22.04 LTS
   - **Plan:** Basic ($6/месяц, 1GB RAM)
   - **Datacenter:** Ближайший к вашей аудитории
   - **Authentication:** SSH Key (рекомендуется)
4. Нажмите **Create Droplet**

### 2. Подключение

```bash
ssh root@your-droplet-ip
```

### 3. Настройка

```bash
# Обновление системы
apt update && apt upgrade -y

# Установка Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs git nginx

# Создание пользователя
adduser qrapp
usermod -aG sudo qrapp
su - qrapp

# Загрузка проекта
cd ~
# Загрузите архив через scp или git clone

# Деплой
cd qr-generator
./deploy.sh
```

### 4. Настройка домена

В панели DigitalOcean:
1. **Networking → Domains**
2. Добавьте ваш домен
3. Создайте A-запись:
   - Hostname: `@`
   - Will Direct To: Выберите ваш Droplet

### 5. SSL сертификат

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

**Готово!** Приложение доступно на `https://yourdomain.com`

---

## 🔷 AWS EC2

### 1. Создание инстанса

1. Войдите в AWS Console
2. **EC2 → Launch Instance**
3. Выберите:
   - **AMI:** Ubuntu Server 22.04 LTS
   - **Instance Type:** t2.micro (бесплатный тир) или t2.small
   - **Key Pair:** Создайте или выберите существующую
   - **Security Group:** Разрешите порты 22 (SSH), 80 (HTTP), 443 (HTTPS)
4. **Launch Instance**

### 2. Подключение

```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@your-ec2-public-ip
```

### 3. Настройка

```bash
# Обновление
sudo apt update && sudo apt upgrade -y

# Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs git nginx build-essential

# Загрузка проекта
cd /var/www
sudo mkdir qr-generator
sudo chown ubuntu:ubuntu qr-generator
# Загрузите проект

# Деплой
cd qr-generator
./deploy.sh
```

### 4. Elastic IP (опционально)

В AWS Console:
1. **EC2 → Elastic IPs**
2. **Allocate Elastic IP address**
3. **Associate** с вашим инстансом

### 5. Route 53 для домена

1. **Route 53 → Hosted zones → Create hosted zone**
2. Создайте A-запись на Elastic IP

**Стоимость:** ~$5-15/месяц

---

## 🔷 Vultr

### 1. Создание сервера

1. https://vultr.com
2. **Deploy → Deploy New Server**
3. Выберите:
   - **Type:** Cloud Compute
   - **Location:** Ближайший
   - **Server Type:** Ubuntu 22.04
   - **Plan:** $6/месяц (1GB RAM)
4. **Deploy Now**

### 2. Подключение и настройка

```bash
ssh root@your-vultr-ip

# Настройка
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs git nginx

# Загрузка и деплой проекта
mkdir -p /var/www
cd /var/www
# Загрузите проект
cd qr-generator
./deploy.sh
```

### 3. Firewall

В панели Vultr:
1. **Firewall → Add Firewall Group**
2. Разрешите: SSH (22), HTTP (80), HTTPS (443)
3. Примените к серверу

**Готово!**

---

## 🔷 Linode (Akamai)

### 1. Создание Linode

1. https://linode.com
2. **Create → Linode**
3. Выберите:
   - **Distribution:** Ubuntu 22.04 LTS
   - **Region:** Ближайший
   - **Plan:** Nanode 1GB ($5/месяц)
   - **Root Password:** Создайте надежный
4. **Create Linode**

### 2. Подключение

```bash
ssh root@your-linode-ip
```

### 3. Настройка

```bash
# Обновление и установка
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs git nginx ufw

# Firewall
ufw allow ssh
ufw allow 'Nginx Full'
ufw enable

# Загрузка проекта
cd /var/www
# Загрузите проект
cd qr-generator
./deploy.sh
```

### 4. Домен в Linode

1. **Domains → Create Domain**
2. Добавьте A-запись на IP вашего Linode

**Отличный выбор!** Linode известен надежностью.

---

## 🔷 Hetzner

### 1. Создание сервера

1. https://hetzner.com
2. **Cloud → Servers → Add Server**
3. Выберите:
   - **Location:** Германия/Финляндия
   - **Image:** Ubuntu 22.04
   - **Type:** CX11 (€4.15/месяц)
   - **SSH Key:** Добавьте ваш ключ
4. **Create & Buy now**

### 2. Настройка

```bash
ssh root@your-hetzner-ip

# Стандартная настройка
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs git nginx

# Загрузка и деплой
cd /var/www
# Загрузите проект
cd qr-generator
./deploy.sh
```

**Преимущество:** Очень выгодные цены, особенно для Европы!

---

## 🔷 Contabo

### 1. Заказ VPS

1. https://contabo.com
2. **VPS → VPS S SSD** (~€5/месяц)
3. Выберите Ubuntu 22.04
4. Оформите заказ

### 2. Получение данных

После оплаты получите email с:
- IP адрес
- Логин (обычно root)
- Пароль

### 3. Настройка

```bash
ssh root@your-contabo-ip

# Смените пароль!
passwd

# Стандартная установка
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs git nginx

# Проект
cd /var/www
# Загрузите проект
cd qr-generator
./deploy.sh
```

**Преимущество:** Очень дешево, но может быть медленнее.

---

## 🔷 Timeweb (Российский провайдер)

### 1. Создание сервера

1. https://timeweb.com
2. **Облачные серверы → Заказать**
3. Выберите:
   - **ОС:** Ubuntu 22.04
   - **Конфигурация:** 1GB RAM
   - **Локация:** Москва/Санкт-Петербург

### 2. Настройка

```bash
ssh root@your-server-ip

# Установка (на русском языке всё работает)
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs git nginx

# Загрузка проекта
cd /var/www
# Загрузите ваш проект
cd qr-generator
./deploy.sh
```

**Преимущество:** Российская локация, рубли, русская поддержка.

---

## 🔷 REG.RU (Российский провайдер)

### Настройка аналогична Timeweb

1. https://reg.ru → VPS
2. Выберите конфигурацию
3. Следуйте инструкциям выше для Timeweb

---

## 📋 Общая инструкция для любого VPS

### Требования к серверу:
- **ОС:** Ubuntu 20.04/22.04 (рекомендуется) или Debian
- **RAM:** Минимум 1GB
- **Диск:** Минимум 10GB
- **CPU:** 1 ядро достаточно

### Универсальная команда установки:

```bash
# После подключения к любому VPS:
ssh root@your-server-ip

# Выполните эти команды
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs git nginx build-essential ufw

# Firewall
ufw allow ssh
ufw allow 'Nginx Full'
ufw enable

# Создайте директорию
mkdir -p /var/www/qr-generator
cd /var/www/qr-generator

# ТЕПЕРЬ загрузите проект одним из способов:
```

#### Способ 1: SCP с локального компьютера

На вашем компьютере:
```bash
cd "/Users/rostislavgolivetc/Downloads/QR generator"
./package-for-deploy.sh
scp qr-generator-deploy.tar.gz root@your-server-ip:/tmp/
```

На сервере:
```bash
cd /var/www/qr-generator
tar -xzf /tmp/qr-generator-deploy.tar.gz
./deploy.sh
```

#### Способ 2: Git

```bash
git clone https://github.com/your-username/qr-generator.git /var/www/qr-generator
cd /var/www/qr-generator
./deploy.sh
```

### Настройка Nginx:

```bash
cd /var/www/qr-generator
cp nginx.conf /etc/nginx/sites-available/qr-generator
ln -s /etc/nginx/sites-available/qr-generator /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default

# Отредактируйте домен
nano /etc/nginx/sites-available/qr-generator
# Замените yourdomain.com на ваш домен или IP

nginx -t
systemctl restart nginx
```

### SSL сертификат:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 💰 Сравнение цен (примерно)

| Провайдер | Цена/месяц | RAM | Локация | Примечание |
|-----------|------------|-----|---------|------------|
| **DigitalOcean** | $6 | 1GB | По всему миру | Надежный, популярный |
| **AWS EC2** | $5-10 | 1GB | По всему миру | Бесплатный год для новых |
| **Vultr** | $6 | 1GB | По всему миру | Хорошая скорость |
| **Linode** | $5 | 1GB | По всему миру | Отличная репутация |
| **Hetzner** | €4 | 2GB | Европа | Очень выгодно! |
| **Contabo** | €5 | 4GB | Европа/США | Дешево, много ресурсов |
| **Timeweb** | ~400₽ | 1GB | Россия | Русская поддержка |
| **REG.RU** | ~500₽ | 1GB | Россия | Оплата в рублях |

---

## 🔍 Как выбрать провайдера?

### Выбирайте DigitalOcean, если:
- ✅ Вам нужна надежность
- ✅ Хотите простой интерфейс
- ✅ Готовы платить немного больше

### Выбирайте Hetzner, если:
- ✅ Вам нужна Европа
- ✅ Хотите сэкономить
- ✅ Нужны хорошие характеристики

### Выбирайте AWS, если:
- ✅ Планируете масштабирование
- ✅ Нужны дополнительные сервисы
- ✅ Первый год бесплатно

### Выбирайте Timeweb/REG.RU, если:
- ✅ Ваша аудитория в России
- ✅ Нужна оплата в рублях
- ✅ Важна русская поддержка

---

## 🛠️ Решение типичных проблем

### "Permission denied" при подключении SSH

```bash
# Проверьте права на ключ
chmod 400 your-key.pem
# Или используйте правильного пользователя
ssh ubuntu@ip  # для AWS/Ubuntu
ssh root@ip    # для других
```

### Порт 80/443 заблокирован

```bash
# Проверьте firewall провайдера в веб-панели
# Локальный firewall:
sudo ufw status
sudo ufw allow 80
sudo ufw allow 443
```

### Node.js не устанавливается

```bash
# Попробуйте альтернативный способ через nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
```

### Nginx показывает ошибку

```bash
# Проверьте конфигурацию
sudo nginx -t
# Проверьте логи
sudo tail -f /var/log/nginx/error.log
```

---

## 📞 Полезные ссылки

- **DigitalOcean:** https://digitalocean.com
- **AWS:** https://aws.amazon.com/free
- **Vultr:** https://vultr.com
- **Linode:** https://linode.com
- **Hetzner:** https://hetzner.com
- **Contabo:** https://contabo.com
- **Timeweb:** https://timeweb.com
- **REG.RU:** https://reg.ru

---

## ✅ Итоговый чек-лист

- [ ] Выбран и оплачен VPS
- [ ] Подключение по SSH работает
- [ ] Обновлена система
- [ ] Установлен Node.js
- [ ] Установлен Nginx
- [ ] Проект загружен на сервер
- [ ] Выполнен `./deploy.sh`
- [ ] Настроен Nginx
- [ ] Настроен домен (если есть)
- [ ] Установлен SSL сертификат
- [ ] Настроен firewall
- [ ] Приложение доступно в браузере

---

**Готово!** Ваше приложение работает в продакшене! 🎉

Если возникли проблемы, смотрите `DEPLOY.md` для детальных инструкций.

