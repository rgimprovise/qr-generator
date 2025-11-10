# 🚀 Деплой через GitHub

Самый удобный способ развернуть QR Generator на VPS.

---

## ⚡ Быстрый старт (3 шага)

### Шаг 1: Загрузка на GitHub (на локальном компьютере)

```bash
cd "/Users/rostislavgolivetc/Downloads/QR generator"

# Инициализация Git (если еще не сделано)
git init

# Добавление всех файлов
git add .

# Первый коммит
git commit -m "Initial commit: QR Generator"

# Создайте репозиторий на GitHub.com (через веб-интерфейс)
# Затем добавьте remote и push:

git remote add origin https://github.com/YOUR_USERNAME/qr-generator.git
git branch -M main
git push -u origin main
```

### Шаг 2: Установка на VPS

```bash
# Подключитесь к серверу
ssh root@YOUR_SERVER_IP

# Установка необходимого ПО
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt update && apt install -y nodejs git

# Установка Caddy
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy

# Клонирование репозитория
cd /var/www
git clone https://github.com/YOUR_USERNAME/qr-generator.git
cd qr-generator

# Настройка окружения
cp .env.example .env
nano .env  # Настройте переменные

# Деплой
./deploy-caddy.sh

# Настройка Caddy
cp Caddyfile /etc/caddy/Caddyfile
nano /etc/caddy/Caddyfile  # Замените yourdomain.com
systemctl reload caddy

# Firewall
ufw allow ssh && ufw allow 80/tcp && ufw allow 443/tcp
ufw --force enable
```

### Шаг 3: Готово!

Откройте `https://yourdomain.com` в браузере 🎉

---

## 🔄 Обновление приложения

### Простое обновление (pull + restart)

```bash
# На сервере
cd /var/www/qr-generator
git pull origin main
npm install --production
pm2 restart qr-generator
```

### С помощью скрипта

Создайте скрипт обновления:

```bash
nano /var/www/qr-generator/update.sh
```

Содержимое:

```bash
#!/bin/bash
cd /var/www/qr-generator
echo "🔄 Обновление из GitHub..."
git pull origin main
echo "📦 Установка зависимостей..."
npm install --production
echo "🔄 Перезапуск приложения..."
pm2 restart qr-generator
echo "✅ Обновление завершено!"
pm2 status
```

Сделайте исполняемым и используйте:

```bash
chmod +x /var/www/qr-generator/update.sh
./update.sh
```

---

## 🤖 Автоматический деплой (GitHub Actions)

Создайте файл `.github/workflows/deploy.yml` для автоматического деплоя при push:

```yaml
name: Deploy to VPS

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Deploy to VPS
      uses: appleboy/ssh-action@master
      with:
        host: ${{ secrets.VPS_HOST }}
        username: ${{ secrets.VPS_USERNAME }}
        key: ${{ secrets.SSH_PRIVATE_KEY }}
        script: |
          cd /var/www/qr-generator
          git pull origin main
          npm install --production
          pm2 restart qr-generator
```

### Настройка секретов в GitHub:

1. Перейдите в **Settings → Secrets and variables → Actions**
2. Добавьте секреты:
   - `VPS_HOST` - IP адрес вашего сервера
   - `VPS_USERNAME` - обычно `root`
   - `SSH_PRIVATE_KEY` - ваш приватный SSH ключ

Теперь при каждом push в main - автоматический деплой!

---

## 📋 Работа с приватным репозиторием

Если ваш репозиторий приватный:

### Вариант 1: SSH ключ (рекомендуется)

```bash
# На сервере сгенерируйте SSH ключ
ssh-keygen -t ed25519 -C "server@yourserver"

# Скопируйте публичный ключ
cat ~/.ssh/id_ed25519.pub

# Добавьте ключ в GitHub:
# Settings → SSH and GPG keys → New SSH key

# Клонируйте через SSH
git clone git@github.com:YOUR_USERNAME/qr-generator.git
```

### Вариант 2: Personal Access Token

```bash
# Создайте токен на GitHub:
# Settings → Developer settings → Personal access tokens → Tokens (classic)
# Выберите права: repo

# Клонируйте с токеном
git clone https://YOUR_TOKEN@github.com/YOUR_USERNAME/qr-generator.git

# Или настройте для существующего репозитория
git remote set-url origin https://YOUR_TOKEN@github.com/YOUR_USERNAME/qr-generator.git
```

---

## 🌿 Работа с ветками

### Development ветка

```bash
# На локальном компьютере
git checkout -b development
git push -u origin development

# На сервере для тестирования
cd /var/www
git clone https://github.com/YOUR_USERNAME/qr-generator.git qr-generator-dev
cd qr-generator-dev
git checkout development

# Настройте другой порт в .env
echo "PORT=3001" > .env

# Деплой
./deploy-caddy.sh
```

### Merge в main

```bash
# На локальном компьютере
git checkout main
git merge development
git push origin main

# На production сервере обновление произойдет автоматически
# (если настроен GitHub Actions) или вручную:
cd /var/www/qr-generator
git pull origin main
pm2 restart qr-generator
```

---

## 📦 .gitignore

Проверьте, что эти файлы НЕ попадают в репозиторий:

```gitignore
# Зависимости
node_modules/
package-lock.json

# База данных
*.db
*.db-journal

# Логи
logs/
*.log
npm-debug.log*

# Переменные окружения
.env

# Системные файлы
.DS_Store
Thumbs.db

# Временные файлы
*.tmp
*.temp
.cache/

# Архивы для деплоя
*.tar.gz
qr-generator-deploy.tar.gz

# IDE
.vscode/
.idea/
*.swp
*.swo
*~
```

---

## 🔐 Безопасность

### Никогда не коммитьте:

- ❌ `.env` файлы с паролями
- ❌ SSH ключи
- ❌ Базу данных с реальными данными
- ❌ `node_modules/`
- ❌ Логи с чувствительными данными

### Используйте .env.example:

```env
# .env.example
PORT=3000
NODE_ENV=production
DOMAIN=yourdomain.com
```

Этот файл коммитьте, а `.env` - нет!

---

## 🎯 Структура репозитория

```
qr-generator/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── .gitignore                  # Игнорируемые файлы
├── .env.example                # Пример переменных окружения
├── server.js                   # Основной сервер
├── database.js                 # База данных
├── package.json                # Зависимости
├── Caddyfile                   # Конфигурация Caddy
├── deploy-caddy.sh             # Скрипт деплоя
├── README.md                   # Документация
└── ... другие файлы
```

---

## 📝 Полезные команды Git

```bash
# Статус репозитория
git status

# Просмотр изменений
git diff

# Добавить все изменения
git add .

# Коммит
git commit -m "Описание изменений"

# Push на GitHub
git push origin main

# Pull с GitHub
git pull origin main

# Просмотр истории
git log --oneline

# Создание ветки
git checkout -b feature-name

# Переключение на ветку
git checkout main

# Удаление ветки
git branch -d feature-name

# Отмена изменений
git checkout -- filename

# Отмена последнего коммита (мягкая)
git reset --soft HEAD~1

# Просмотр удаленных репозиториев
git remote -v

# Обновление URL репозитория
git remote set-url origin https://github.com/NEW_URL/repo.git
```

---

## 🚀 Workflow разработки

### 1. Локальная разработка

```bash
cd "/Users/rostislavgolivetc/Downloads/QR generator"
npm run dev  # Запуск в dev режиме

# Внесите изменения
# Протестируйте локально
```

### 2. Коммит и push

```bash
git add .
git commit -m "feat: добавлена новая функция"
git push origin main
```

### 3. Автоматический деплой

GitHub Actions автоматически развернет на сервере (если настроен)

### 4. Или ручное обновление

```bash
# На сервере
cd /var/www/qr-generator
./update.sh
```

---

## 🏷️ Версионирование

### Semantic Versioning

```bash
# Обновите версию в package.json
npm version patch  # 1.0.0 → 1.0.1
npm version minor  # 1.0.1 → 1.1.0
npm version major  # 1.1.0 → 2.0.0

# Создайте тег
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0

# Список тегов
git tag

# Деплой конкретной версии
git checkout v1.0.0
```

---

## 🔧 Решение проблем

### Конфликты при pull

```bash
# Посмотреть конфликты
git status

# Отменить локальные изменения и взять с сервера
git fetch origin
git reset --hard origin/main

# Или сохранить локальные изменения
git stash
git pull origin main
git stash pop
```

### Проблемы с правами

```bash
# На сервере
sudo chown -R $USER:$USER /var/www/qr-generator
```

### Git не найден

```bash
# Установите Git
sudo apt update
sudo apt install -y git

# Проверка
git --version
```

---

## 📊 CI/CD расширенный (опционально)

### Добавьте тесты и проверки:

`.github/workflows/test.yml`:

```yaml
name: Tests

on:
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm install
    
    - name: Run tests
      run: npm test
    
    - name: Lint code
      run: npm run lint
```

---

## 📱 GitHub Mobile

Управляйте репозиторием с телефона:

1. Установите GitHub Mobile
2. Просматривайте коммиты
3. Merge pull requests
4. Проверяйте статус деплоя

---

## ✅ Чек-лист

- [ ] Создан репозиторий на GitHub
- [ ] Код загружен в репозиторий
- [ ] `.gitignore` настроен правильно
- [ ] `.env` НЕ в репозитории
- [ ] На сервере установлен Git
- [ ] Репозиторий склонирован на сервер
- [ ] Приложение запущено через PM2
- [ ] Caddy настроен
- [ ] GitHub Actions настроен (опционально)
- [ ] SSH ключ добавлен в GitHub (для приватного репо)

---

## 🎓 Полезные ссылки

- **GitHub Docs:** https://docs.github.com
- **GitHub Actions:** https://docs.github.com/actions
- **Git Documentation:** https://git-scm.com/doc
- **SSH Keys:** https://docs.github.com/authentication/connecting-to-github-with-ssh

---

## 💡 Советы

1. **Делайте частые коммиты** с понятными сообщениями
2. **Используйте ветки** для новых функций
3. **Тестируйте локально** перед push
4. **Настройте автоматический деплой** для удобства
5. **Делайте бэкапы** базы данных перед обновлениями

---

**GitHub настроен!** Теперь деплой - это просто `git push`! 🚀

Для быстрого старта используйте команды из раздела "Быстрый старт" выше.

