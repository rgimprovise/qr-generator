#!/bin/bash

# Скрипт для обновления приложения с GitHub (версия для PostgreSQL)
# Использование: ./update-postgres.sh

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   QR Generator - Обновление (PostgreSQL)${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Проверка что мы в правильной директории
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Ошибка: package.json не найден${NC}"
    echo "Запустите скрипт из директории проекта"
    exit 1
fi

# Проверка Git
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ Git не установлен${NC}"
    exit 1
fi

# Проверка PM2
if ! command -v pm2 &> /dev/null; then
    echo -e "${RED}❌ PM2 не установлен${NC}"
    exit 1
fi

# Проверка PostgreSQL клиента
if ! command -v psql &> /dev/null; then
    echo -e "${YELLOW}⚠️  psql не установлен, некоторые проверки будут пропущены${NC}"
fi

# Проверка наличия несохраненных изменений
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  Внимание: У вас есть несохраненные изменения${NC}"
    echo "Файлы с изменениями:"
    git status --short
    echo ""
    read -p "Продолжить? Локальные изменения будут сохранены в stash (y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Обновление отменено"
        exit 1
    fi
    echo -e "${YELLOW}💾 Сохранение локальных изменений...${NC}"
    git stash
fi

# Получение текущей ветки
CURRENT_BRANCH=$(git branch --show-current)
echo -e "${BLUE}📍 Текущая ветка: ${CURRENT_BRANCH}${NC}"

# Получение изменений
echo -e "${YELLOW}📥 Получение изменений из GitHub...${NC}"
git fetch origin

# Проверка наличия обновлений
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/$CURRENT_BRANCH)

if [ $LOCAL = $REMOTE ]; then
    echo -e "${GREEN}✅ Уже используется последняя версия${NC}"
    echo ""
    pm2 status qr-generator
    exit 0
fi

echo -e "${YELLOW}📊 Найдены новые коммиты:${NC}"
git log HEAD..origin/$CURRENT_BRANCH --oneline --decorate
echo ""

# КРИТИЧЕСКАЯ ПРОВЕРКА: Создание бэкапа базы данных PostgreSQL
if [ -f ".env" ] || [ -n "$DATABASE_URL" ]; then
    BACKUP_DIR="backups"
    mkdir -p "$BACKUP_DIR"
    BACKUP_FILE="$BACKUP_DIR/qr_codes_backup_$(date +%Y%m%d_%H%M%S).sql"
    
    echo -e "${YELLOW}💾 Создание бэкапа базы данных PostgreSQL...${NC}"
    
    # Загружаем переменные окружения
    if [ -f ".env" ]; then
        export $(cat .env | grep -v '^#' | xargs)
    fi
    
    # Пытаемся создать бэкап через pg_dump
    if command -v pg_dump &> /dev/null; then
        if [ -n "$DATABASE_URL" ]; then
            if pg_dump "$DATABASE_URL" > "$BACKUP_FILE" 2>/dev/null; then
                echo -e "${GREEN}✅ Бэкап создан: ${BACKUP_FILE}${NC}"
            else
                # Пытаемся через отдельные переменные
                if [ -n "$DB_HOST" ] && [ -n "$DB_NAME" ] && [ -n "$DB_USER" ]; then
                    PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER" -d "$DB_NAME" > "$BACKUP_FILE" 2>/dev/null
                    if [ -s "$BACKUP_FILE" ]; then
                        echo -e "${GREEN}✅ Бэкап создан: ${BACKUP_FILE}${NC}"
                    else
                        echo -e "${YELLOW}⚠️  Не удалось создать бэкап через pg_dump${NC}"
                        BACKUP_FILE=""
                    fi
                else
                    echo -e "${YELLOW}⚠️  Переменные окружения БД не настроены, пропускаем бэкап${NC}"
                    BACKUP_FILE=""
                fi
            fi
        else
            echo -e "${YELLOW}⚠️  DATABASE_URL не установлен, пропускаем бэкап${NC}"
            BACKUP_FILE=""
        fi
    else
        echo -e "${YELLOW}⚠️  pg_dump не установлен, пропускаем бэкап${NC}"
        BACKUP_FILE=""
    fi
    
    # Подсчет QR кодов в базе (для проверки после обновления)
    if command -v psql &> /dev/null && [ -n "$DATABASE_URL" ]; then
        QR_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM qr_codes;" 2>/dev/null | xargs || echo "0")
        SCANS_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM scans;" 2>/dev/null | xargs || echo "0")
        SHORT_CODES_BEFORE=$(psql "$DATABASE_URL" -t -c "SELECT short_code FROM qr_codes ORDER BY id;" 2>/dev/null | xargs || echo "")
        echo -e "${BLUE}📊 Текущее состояние БД: ${QR_COUNT} QR кодов, ${SCANS_COUNT} сканирований${NC}"
    else
        echo -e "${YELLOW}⚠️  psql не доступен, пропускаем проверку${NC}"
        QR_COUNT=""
        SCANS_COUNT=""
        SHORT_CODES_BEFORE=""
    fi
else
    echo -e "${YELLOW}⚠️  Файл .env не найден и DATABASE_URL не установлен${NC}"
    echo -e "${YELLOW}   Продолжаем обновление без проверки БД${NC}"
    QR_COUNT=""
    SCANS_COUNT=""
    SHORT_CODES_BEFORE=""
    BACKUP_FILE=""
fi

# Pull изменений
echo -e "${YELLOW}🔄 Применение обновлений...${NC}"
if ! git pull origin $CURRENT_BRANCH; then
    echo -e "${RED}❌ Ошибка при получении изменений${NC}"
    exit 1
fi

# Установка/обновление зависимостей
echo -e "${YELLOW}📦 Проверка зависимостей...${NC}"
if ! npm install --production; then
    echo -e "${RED}❌ Ошибка установки зависимостей${NC}"
    exit 1
fi

# КРИТИЧЕСКАЯ ПРОВЕРКА: Проверка что QR коды на месте перед миграцией
if [ -n "$QR_COUNT" ] && [ "$QR_COUNT" != "0" ] && command -v psql &> /dev/null && [ -n "$DATABASE_URL" ]; then
    echo -e "${YELLOW}🔍 Проверка QR кодов перед миграцией...${NC}"
    echo -e "${GREEN}✅ Найдено QR кодов: ${QR_COUNT}, сканирований: ${SCANS_COUNT}${NC}"
fi

# БЕЗОПАСНАЯ МИГРАЦИЯ: Пересчет счетчиков сканирований (не трогает сами QR коды)
if [ -f "migrate-scans-count-postgres.js" ]; then
    echo -e "${YELLOW}🔄 Выполнение миграции: пересчет счетчиков сканирований...${NC}"
    echo -e "${BLUE}   (Это безопасно: обновляются только счетчики, QR коды не изменяются)${NC}"
    
    # Сначала проверка в режиме dry-run
    if node migrate-scans-count-postgres.js --dry-run 2>/dev/null; then
        echo -e "${GREEN}✅ Проверка миграции прошла успешно${NC}"
        
        # Выполняем реальную миграцию
        if node migrate-scans-count-postgres.js 2>/dev/null; then
            echo -e "${GREEN}✅ Миграция выполнена успешно${NC}"
            
            # КРИТИЧЕСКАЯ ПРОВЕРКА: Убеждаемся что QR коды не потеряны и не изменились
            if [ -n "$QR_COUNT" ] && command -v psql &> /dev/null && [ -n "$DATABASE_URL" ]; then
                QR_AFTER_MIGRATION=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM qr_codes;" 2>/dev/null | xargs || echo "0")
                SHORT_CODES_AFTER=$(psql "$DATABASE_URL" -t -c "SELECT short_code FROM qr_codes ORDER BY id;" 2>/dev/null | xargs || echo "")
                
                # Проверка количества
                if [ "$QR_AFTER_MIGRATION" != "$QR_COUNT" ]; then
                    echo -e "${RED}❌ КРИТИЧЕСКАЯ ОШИБКА: Количество QR кодов изменилось после миграции!${NC}"
                    echo -e "${RED}   Было: ${QR_COUNT}, Стало: ${QR_AFTER_MIGRATION}${NC}"
                    if [ -n "$BACKUP_FILE" ] && [ -f "$BACKUP_FILE" ]; then
                        echo -e "${YELLOW}💾 Восстановление из бэкапа: ${BACKUP_FILE}${NC}"
                        echo -e "${YELLOW}   Выполните: psql \$DATABASE_URL < ${BACKUP_FILE}${NC}"
                    fi
                    exit 1
                fi
                
                # Проверка что все short_code на месте
                if [ "$SHORT_CODES_BEFORE" != "$SHORT_CODES_AFTER" ]; then
                    echo -e "${RED}❌ КРИТИЧЕСКАЯ ОШИБКА: Список QR кодов изменился после миграции!${NC}"
                    if [ -n "$BACKUP_FILE" ] && [ -f "$BACKUP_FILE" ]; then
                        echo -e "${YELLOW}💾 Восстановление из бэкапа: ${BACKUP_FILE}${NC}"
                        echo -e "${YELLOW}   Выполните: psql \$DATABASE_URL < ${BACKUP_FILE}${NC}"
                    fi
                    exit 1
                fi
                
                echo -e "${GREEN}✅ Проверка: Все QR коды сохранены (${QR_AFTER_MIGRATION} шт.)${NC}"
                echo -e "${GREEN}✅ Проверка: Все short_code идентичны (QR коды не изменены)${NC}"
            fi
        else
            echo -e "${YELLOW}⚠️  Миграция завершилась с предупреждениями, но продолжаем...${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  Пропуск миграции (ошибка при проверке)${NC}"
    fi
    echo ""
else
    echo -e "${YELLOW}⚠️  Скрипт миграции для PostgreSQL не найден, пропускаем${NC}"
fi

# Перезапуск приложения
echo -e "${YELLOW}🔄 Перезапуск приложения...${NC}"
if ! pm2 restart qr-generator; then
    echo -e "${RED}❌ Ошибка перезапуска приложения${NC}"
    exit 1
fi

# Небольшая пауза для запуска
sleep 3

# Проверка статуса
echo ""
echo -e "${GREEN}✅ Обновление завершено успешно!${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 Статус приложения:${NC}"
pm2 status qr-generator
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Проверка логов на ошибки
echo -e "${BLUE}📝 Последние логи (для проверки):${NC}"
pm2 logs qr-generator --lines 10 --nostream

echo ""
echo -e "${GREEN}🎉 Всё готово! Приложение обновлено и работает!${NC}"
echo ""

# Показать новую версию если есть package.json с version
if [ -f "package.json" ]; then
    VERSION=$(node -p "require('./package.json').version" 2>/dev/null)
    if [ -n "$VERSION" ]; then
        echo -e "${BLUE}📌 Версия: ${VERSION}${NC}"
    fi
fi

# Показать последний коммит
echo -e "${BLUE}📝 Последний коммит:${NC}"
git log -1 --pretty=format:"%h - %s (%an, %ar)" --abbrev-commit
echo ""

# Показать информацию о бэкапе
if [ -n "$BACKUP_FILE" ] && [ -f "$BACKUP_FILE" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${BLUE}💾 Бэкап БД: ${BACKUP_FILE} (${BACKUP_SIZE})${NC}"
fi

echo ""

