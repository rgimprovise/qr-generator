#!/bin/bash

# Скрипт для инициализации Git и загрузки на GitHub
# Использование: ./init-github.sh

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   QR Generator - Инициализация GitHub         ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════╝${NC}"
echo ""

# Проверка Git
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git не установлен${NC}"
    echo "Установите Git: https://git-scm.com/downloads"
    exit 1
fi

echo -e "${GREEN}✅ Git установлен: $(git --version)${NC}"
echo ""

# Проверка существующего репозитория
if [ -d ".git" ]; then
    echo -e "${YELLOW}⚠️  Git репозиторий уже инициализирован${NC}"
    echo ""
    echo "Текущий remote:"
    git remote -v
    echo ""
    read -p "Хотите переинициализировать? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Удаление существующего репозитория...${NC}"
        rm -rf .git
    else
        echo "Отменено"
        exit 0
    fi
fi

# Инициализация Git
echo -e "${YELLOW}📦 Инициализация Git репозитория...${NC}"
git init

# Добавление всех файлов
echo -e "${YELLOW}📝 Добавление файлов...${NC}"
git add .

# Проверка что добавлено
echo ""
echo -e "${BLUE}Файлы для коммита:${NC}"
git status --short | head -20
TOTAL_FILES=$(git status --short | wc -l)
echo "... всего файлов: $TOTAL_FILES"
echo ""

# Первый коммит
echo -e "${YELLOW}💾 Создание первого коммита...${NC}"
git commit -m "Initial commit: QR Code Generator with Analytics

Полнофункциональный генератор динамических QR кодов с:
- Генерацией QR кодов и коротких ссылок
- Детальной аналитикой переходов
- Отслеживанием геолокации, устройств, браузеров
- Современным UI/UX
- Поддержкой Caddy и Nginx
- Автоматическим деплоем через GitHub Actions"

echo -e "${GREEN}✅ Локальный репозиторий создан!${NC}"
echo ""

# Настройка GitHub
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 Следующие шаги:${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "1. Создайте новый репозиторий на GitHub:"
echo -e "   ${BLUE}https://github.com/new${NC}"
echo ""
echo "2. Параметры репозитория:"
echo "   - Repository name: qr-generator"
echo "   - Description: Dynamic QR Code Generator with Analytics"
echo "   - Public или Private (на ваш выбор)"
echo "   - ❌ НЕ добавляйте README, .gitignore, license"
echo ""
echo "3. После создания, выполните команды:"
echo ""

# Запрос имени пользователя GitHub
read -p "Введите ваш GitHub username (или нажмите Enter для пропуска): " GITHUB_USER

if [ -n "$GITHUB_USER" ]; then
    REPO_URL="https://github.com/$GITHUB_USER/qr-generator.git"
    
    echo ""
    echo -e "${YELLOW}🔗 Подключение к GitHub...${NC}"
    git remote add origin $REPO_URL
    git branch -M main
    
    echo ""
    echo -e "${GREEN}✅ Remote добавлен: $REPO_URL${NC}"
    echo ""
    echo -e "${YELLOW}Теперь выполните push:${NC}"
    echo ""
    echo -e "${BLUE}git push -u origin main${NC}"
    echo ""
    
    read -p "Выполнить push сейчас? (y/n): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}📤 Загрузка на GitHub...${NC}"
        if git push -u origin main; then
            echo ""
            echo -e "${GREEN}🎉 Успешно загружено на GitHub!${NC}"
            echo ""
            echo -e "${BLUE}Ваш репозиторий: ${NC}https://github.com/$GITHUB_USER/qr-generator"
        else
            echo ""
            echo -e "${RED}❌ Ошибка при push${NC}"
            echo "Возможно, нужно настроить аутентификацию:"
            echo "  - Personal Access Token: https://github.com/settings/tokens"
            echo "  - SSH ключ: https://github.com/settings/keys"
        fi
    fi
else
    echo ""
    echo -e "${BLUE}Выполните эти команды после создания репозитория:${NC}"
    echo ""
    echo -e "${YELLOW}git remote add origin https://github.com/YOUR_USERNAME/qr-generator.git${NC}"
    echo -e "${YELLOW}git branch -M main${NC}"
    echo -e "${YELLOW}git push -u origin main${NC}"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✅ Git инициализация завершена!${NC}"
echo ""
echo -e "${BLUE}📚 Документация:${NC}"
echo "  - GITHUB-QUICKSTART.md  - быстрый старт"
echo "  - GITHUB-DEPLOY.md      - подробная инструкция"
echo ""
echo -e "${BLUE}🚀 Следующий шаг: Деплой на VPS${NC}"
echo "Смотрите: GITHUB-QUICKSTART.md"
echo ""

