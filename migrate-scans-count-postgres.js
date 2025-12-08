#!/usr/bin/env node

/**
 * Скрипт миграции для пересчета total_scans на основе реальных записей в таблице scans
 * ВЕРСИЯ ДЛЯ POSTGRESQL
 * 
 * Этот скрипт:
 * 1. Сравнивает total_scans с реальным COUNT(*) из таблицы scans
 * 2. Исправляет рассинхронизации
 * 3. Безопасен - не удаляет данные, только обновляет счетчики
 * 
 * Использование:
 *   node migrate-scans-count-postgres.js
 *   node migrate-scans-count-postgres.js --dry-run  (только проверка, без изменений)
 * 
 * Переменные окружения:
 *   DATABASE_URL - строка подключения PostgreSQL (postgresql://user:pass@host:port/dbname)
 *   или
 *   DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 */

const { Client } = require('pg');
require('dotenv').config();

const DRY_RUN = process.argv.includes('--dry-run');

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║   Миграция: Пересчет total_scans для всех QR кодов       ║');
console.log('║   PostgreSQL версия                                      ║');
console.log('╚═══════════════════════════════════════════════════════════╝');
console.log('');

if (DRY_RUN) {
  console.log('🔍 РЕЖИМ ПРОВЕРКИ (без изменений)');
  console.log('');
}

// Получение строки подключения
function getConnectionString() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'qr_generator',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || ''
  };
  
  return `postgresql://${config.user}:${config.password}@${config.host}:${config.port}/${config.database}`;
}

const client = new Client({
  connectionString: getConnectionString()
});

// Функция для пересчета счетчиков
async function recalculateScans() {
  try {
    console.log('📊 Анализ данных...');
    console.log('');

    // Получаем все QR коды с их реальным количеством сканирований
    const result = await client.query(`
      SELECT 
        q.id,
        q.short_code,
        q.title,
        q.total_scans as stored_count,
        COUNT(s.id)::integer as actual_count,
        (q.total_scans - COUNT(s.id)::integer) as difference
      FROM qr_codes q
      LEFT JOIN scans s ON q.id = s.qr_code_id
      GROUP BY q.id, q.short_code, q.title, q.total_scans
      ORDER BY ABS(q.total_scans - COUNT(s.id)::integer) DESC
    `);

    const rows = result.rows;

    if (rows.length === 0) {
      console.log('⚠️  В базе данных нет QR кодов');
      return { fixed: 0, issues: [] };
    }

    // Находим рассинхронизации
    const issues = rows.filter(row => row.difference !== 0);
    const synced = rows.filter(row => row.difference === 0);

    console.log(`📈 Всего QR кодов: ${rows.length}`);
    console.log(`✅ Синхронизировано: ${synced.length}`);
    console.log(`⚠️  Требуют исправления: ${issues.length}`);
    console.log('');

    if (issues.length === 0) {
      console.log('✅ Все счетчики синхронизированы! Никаких исправлений не требуется.');
      return { fixed: 0, issues: [] };
    }

    // Показываем детали проблем
    console.log('🔍 Детали рассинхронизаций:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    issues.forEach((issue, index) => {
      const status = issue.difference > 0 
        ? `📊 Счетчик больше на ${issue.difference}` 
        : `📉 Счетчик меньше на ${Math.abs(issue.difference)}`;
      console.log(`${index + 1}. ${issue.title || issue.short_code}`);
      console.log(`   ID: ${issue.id} | Short Code: ${issue.short_code}`);
      console.log(`   Хранится: ${issue.stored_count} | Реально: ${issue.actual_count} | ${status}`);
      console.log('');
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    if (DRY_RUN) {
      console.log('🔍 РЕЖИМ ПРОВЕРКИ: Изменения не будут применены');
      console.log(`   Будет исправлено: ${issues.length} QR кодов`);
      return { fixed: 0, issues: issues };
    }

    // Исправляем рассинхронизации в транзакции
    console.log('🔧 Исправление рассинхронизаций...');
    console.log('');

    await client.query('BEGIN');

    try {
      for (let index = 0; index < issues.length; index++) {
        const issue = issues[index];
        
        await client.query(
          'UPDATE qr_codes SET total_scans = $1 WHERE id = $2',
          [issue.actual_count, issue.id]
        );
        
        console.log(`✅ [${index + 1}/${issues.length}] Исправлен: ${issue.title || issue.short_code}`);
        console.log(`   ${issue.stored_count} → ${issue.actual_count} (разница: ${issue.difference})`);
      }

      await client.query('COMMIT');
      
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`✅ Успешно исправлено: ${issues.length} QR кодов`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
      
      return { fixed: issues.length, issues: issues };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    throw error;
  }
}

// Проверка целостности после миграции
async function verifyIntegrity() {
  try {
    const result = await client.query(`
      SELECT 
        q.id,
        q.short_code,
        q.total_scans as stored_count,
        COUNT(s.id)::integer as actual_count
      FROM qr_codes q
      LEFT JOIN scans s ON q.id = s.qr_code_id
      GROUP BY q.id, q.short_code, q.total_scans
      HAVING q.total_scans != COUNT(s.id)::integer
    `);

    const remainingIssues = result.rows;

    if (remainingIssues.length > 0) {
      console.log('⚠️  ВНИМАНИЕ: После миграции остались рассинхронизации:');
      remainingIssues.forEach(issue => {
        console.log(`   - ${issue.short_code}: хранится ${issue.stored_count}, реально ${issue.actual_count}`);
      });
      console.log('');
      return false;
    } else {
      console.log('✅ Проверка целостности: Все счетчики синхронизированы!');
      console.log('');
      return true;
    }
  } catch (error) {
    console.error('❌ Ошибка при проверке целостности:', error);
    return false;
  }
}

// Главная функция
async function main() {
  try {
    await client.connect();
    console.log('✅ Подключено к базе данных PostgreSQL');
    console.log('');

    const result = await recalculateScans();
    
    if (!DRY_RUN && result.fixed > 0) {
      const isOk = await verifyIntegrity();
      if (!isOk) {
        console.error('❌ После миграции остались проблемы. Проверьте логи выше.');
        process.exit(1);
      }
    }

    // Финальная статистика
    const qrResult = await client.query('SELECT COUNT(*) as total_qr FROM qr_codes');
    const scansResult = await client.query('SELECT COUNT(*) as total_scans FROM scans');

    console.log('📊 Финальная статистика:');
    console.log(`   QR кодов: ${qrResult.rows[0].total_qr}`);
    console.log(`   Всего сканирований: ${scansResult.rows[0].total_scans}`);
    console.log('');

    await client.end();

    if (DRY_RUN) {
      console.log('🔍 Проверка завершена. Для применения изменений запустите без --dry-run');
    } else {
      console.log('✅ Миграция успешно завершена!');
    }
    console.log('');
    process.exit(0);
  } catch (error) {
    console.error('❌ Критическая ошибка при миграции:', error);
    if (client) {
      await client.end();
    }
    process.exit(1);
  }
}

// Запуск
main();

