# ⚡ GitHub Быстрый старт

Загрузка и деплой QR Generator через GitHub за 5 минут!

---

## 📤 Шаг 1: Загрузка на GitHub (2 минуты)

### На вашем компьютере:

```bash
cd "/Users/rostislavgolivetc/Downloads/QR generator"

# Инициализация Git
git init
git add .
git commit -m "Initial commit: QR Code Generator with Analytics"

# Создайте репозиторий на GitHub.com:
# 1. Откройте https://github.com/new
# 2. Название: qr-generator
# 3. Описание: Dynamic QR Code Generator with Analytics
# 4. Public или Private
# 5. НЕ добавляйте README, .gitignore, license (уже есть)
# 6. Нажмите Create repository

# Подключите репозиторий (замените YOUR_USERNAME):
git remote add origin https://github.com/YOUR_USERNAME/qr-generator.git
git branch -M main
git push -u origin main
```

**Готово!** Код на GitHub ✅

---

## 🚀 Шаг 2: Деплой на VPS (3 минуты)

### Подключитесь к серверу:

```bash
ssh root@YOUR_SERVER_IP
```

### Скопируйте и выполните (всё одним блоком):

```bash
# ========================================
# Полная установка (копируйте полностью)
# ========================================

# 1. Установка Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
apt install -y nodejs git

# 2. Установка Caddy
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl && \
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg && \
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list && \
apt update && apt install -y caddy

# 3. Клонирование репозитория (ЗАМЕНИТЕ на ваш!)
cd /var/www && \
git clone https://github.com/YOUR_USERNAME/qr-generator.git && \
cd qr-generator

# 4. Настройка окружения
cp .env.example .env && \
nano .env
# Нажмите Ctrl+X для выхода (можно оставить как есть)

# 5. Деплой приложения
./deploy-caddy.sh

# 6. Настройка Caddy
cp Caddyfile /etc/caddy/Caddyfile && \
nano /etc/caddy/Caddyfile
# Замените yourdomain.com на ваш домен (или настройте для IP)
# Для IP: раскомментируйте секцию :80
# Ctrl+X → Y → Enter для сохранения

systemctl reload caddy

# 7. Firewall
ufw allow ssh && \
ufw allow 80/tcp && \
ufw allow 443/tcp && \
ufw --force enable

echo "✅ Установка завершена!"
pm2 status
```

---

## 🌐 Шаг 3: Откройте в браузере

- **С доменом:** `https://yourdomain.com`
- **Без домена:** `http://YOUR_SERVER_IP`

**Работает!** 🎉

---

## 🔄 Обновление (когда внесли изменения)

### На локальном компьютере (после изменений):

```bash
cd "/Users/rostislavgolivetc/Downloads/QR generator"

git add .
git commit -m "Описание изменений"
git push origin main
```

### На сервере (применение изменений):

#### Вариант 1: Быстро (одна команда)
```bash
cd /var/www/qr-generator && ./update.sh
```

#### Вариант 2: Вручную
```bash
cd /var/www/qr-generator
git pull origin main
npm install --production
pm2 restart qr-generator
```

#### Вариант 3: Автоматически (GitHub Actions)

Настройте автоматический деплой - см. раздел ниже ⬇️

---

## 🤖 Бонус: Автоматический деплой

### Настройка (один раз):

#### 1. Создайте SSH ключ на сервере

```bash
# На сервере
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions -N ""
cat ~/.ssh/github_actions
```

Скопируйте **приватный ключ** (весь вывод)

#### 2. Добавьте секреты в GitHub

Откройте ваш репозиторий на GitHub:

**Settings → Secrets and variables → Actions → New repository secret**

Добавьте 3 секрета:

| Имя | Значение |
|-----|----------|
| `VPS_HOST` | IP адрес вашего сервера |
| `VPS_USERNAME` | `root` (или ваш пользователь) |
| `SSH_PRIVATE_KEY` | Приватный SSH ключ (из шага 1) |

#### 3. Добавьте публичный ключ в authorized_keys

```bash
# На сервере
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
```

#### 4. Готово!

Теперь при каждом `git push` - автоматический деплой!

Проверить: **Actions** таб в репозитории на GitHub.

---

## 🔐 Приватный репозиторий

Если ваш репозиторий приватный:

### На сервере создайте SSH ключ для GitHub:

```bash
ssh-keygen -t ed25519 -C "server@yourserver" -N ""
cat ~/.ssh/id_ed25519.pub
```

### Добавьте ключ в GitHub:

**Settings → SSH and GPG keys → New SSH key**

Вставьте содержимое `id_ed25519.pub`

### Клонируйте через SSH:

```bash
cd /var/www
git clone git@github.com:YOUR_USERNAME/qr-generator.git
```

---

## 📋 Полезные команды

```bash
# На сервере

# Проверка статуса
pm2 status
sudo systemctl status caddy

# Обновление
cd /var/www/qr-generator && ./update.sh

# Логи
pm2 logs qr-generator
sudo journalctl -u caddy -f

# Перезапуск
pm2 restart qr-generator
sudo systemctl reload caddy

# Перейти в проект
cd /var/www/qr-generator

# Посмотреть последние изменения
git log --oneline -10
```

---

## 🐛 Решение проблем

### Не работает клонирование

```bash
# Проверьте Git
git --version

# Установите если нужно
apt install -y git
```

### Ошибка прав доступа

```bash
sudo chown -R $USER:$USER /var/www/qr-generator
```

### Приложение не запускается

```bash
cd /var/www/qr-generator
pm2 logs qr-generator --lines 50
```

### Caddy не работает

```bash
sudo systemctl status caddy
sudo journalctl -u caddy -n 50
sudo caddy validate --config /etc/caddy/Caddyfile
```

### Нужно откатить изменения

```bash
cd /var/www/qr-generator

# Посмотреть историю
git log --oneline

# Откатиться на конкретный коммит
git checkout COMMIT_HASH

# Или на предыдущий коммит
git checkout HEAD~1

# Перезапустить
pm2 restart qr-generator
```

---

## 📊 Проверка работы

```bash
# Статус приложения
pm2 status

# Проверка порта
curl http://localhost:3000

# Проверка через домен/IP
curl http://YOUR_SERVER_IP
curl https://yourdomain.com
```

---

## ✅ Чек-лист

**На локальном компьютере:**
- [ ] Git установлен
- [ ] Репозиторий создан на GitHub
- [ ] Код загружен (`git push`)

**На VPS сервере:**
- [ ] Node.js установлен
- [ ] Git установлен
- [ ] Caddy установлен
- [ ] Репозиторий склонирован
- [ ] `.env` файл настроен
- [ ] Приложение запущено (PM2)
- [ ] Caddy настроен
- [ ] Firewall настроен
- [ ] Сайт открывается в браузере

**Опционально:**
- [ ] SSH ключи настроены для приватного репо
- [ ] GitHub Actions настроен
- [ ] Автоматический деплой работает

---

## 💡 Следующие шаги

После базовой установки:

1. ✅ Прочитайте `SECURITY.md` - настройте безопасность
2. ✅ Настройте резервное копирование
3. ✅ Установите мониторинг
4. ✅ Проверьте SSL на ssllabs.com

---

## 📚 Документация

- **`GITHUB-DEPLOY.md`** - подробная документация по GitHub
- **`CADDY-SETUP.md`** - настройка Caddy
- **`SECURITY.md`** - безопасность
- **`CHEATSHEET.md`** - шпаргалка команд

---

## 🎯 Самые важные команды

```bash
# Обновление (на сервере)
cd /var/www/qr-generator && ./update.sh

# Статус
pm2 status

# Логи
pm2 logs qr-generator

# Перезапуск
pm2 restart qr-generator
```

---

**GitHub деплой настроен!** 🚀

Теперь разработка и деплой стали простыми:
1. Меняйте код локально
2. `git push`
3. На сервере: `./update.sh` (или автоматически через Actions)

Готово! ✨

