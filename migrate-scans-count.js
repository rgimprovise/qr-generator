#!/usr/bin/env node

/**
 * Скрипт миграции для пересчета total_scans на основе реальных записей в таблице scans
 * 
 * Этот скрипт:
 * 1. Сравнивает total_scans с реальным COUNT(*) из таблицы scans
 * 2. Исправляет рассинхронизации
 * 3. Безопасен - не удаляет данные, только обновляет счетчики
 * 
 * Использование:
 *   node migrate-scans-count.js
 *   node migrate-scans-count.js --dry-run  (только проверка, без изменений)
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');
const DB_PATH = path.join(__dirname, 'qr_codes.db');

console.log('╔═══════════════════════════════════════════════════════════╗');
console.log('║   Миграция: Пересчет total_scans для всех QR кодов       ║');
console.log('╚═══════════════════════════════════════════════════════════╝');
console.log('');

if (DRY_RUN) {
  console.log('🔍 РЕЖИМ ПРОВЕРКИ (без изменений)');
  console.log('');
}

// Проверка существования базы данных
const fs = require('fs');
if (!fs.existsSync(DB_PATH)) {
  console.error('❌ Ошибка: База данных не найдена:', DB_PATH);
  process.exit(1);
}

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Ошибка подключения к базе данных:', err.message);
    process.exit(1);
  }
  console.log('✅ Подключено к базе данных');
  console.log('');
});

// Функция для пересчета счетчиков
function recalculateScans() {
  return new Promise((resolve, reject) => {
    console.log('📊 Анализ данных...');
    console.log('');

    // Получаем все QR коды с их реальным количеством сканирований
    db.all(`
      SELECT 
        q.id,
        q.short_code,
        q.title,
        q.total_scans as stored_count,
        COUNT(s.id) as actual_count,
        (q.total_scans - COUNT(s.id)) as difference
      FROM qr_codes q
      LEFT JOIN scans s ON q.id = s.qr_code_id
      GROUP BY q.id, q.short_code, q.title, q.total_scans
      ORDER BY ABS(q.total_scans - COUNT(s.id)) DESC
    `, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      if (rows.length === 0) {
        console.log('⚠️  В базе данных нет QR кодов');
        resolve({ fixed: 0, issues: [] });
        return;
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
        resolve({ fixed: 0, issues: [] });
        return;
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
        resolve({ fixed: 0, issues: issues });
        return;
      }

      // Исправляем рассинхронизации
      console.log('🔧 Исправление рассинхронизаций...');
      console.log('');

      const fixPromises = issues.map((issue, index) => {
        return new Promise((resolveFix, rejectFix) => {
          db.run(
            'UPDATE qr_codes SET total_scans = ? WHERE id = ?',
            [issue.actual_count, issue.id],
            function(updateErr) {
              if (updateErr) {
                console.error(`❌ Ошибка при исправлении QR кода ${issue.short_code}:`, updateErr);
                rejectFix(updateErr);
              } else {
                console.log(`✅ [${index + 1}/${issues.length}] Исправлен: ${issue.title || issue.short_code}`);
                console.log(`   ${issue.stored_count} → ${issue.actual_count} (разница: ${issue.difference})`);
                resolveFix({ id: issue.id, short_code: issue.short_code, fixed: true });
              }
            }
          );
        });
      });

      Promise.all(fixPromises)
        .then(fixed => {
          console.log('');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`✅ Успешно исправлено: ${fixed.length} QR кодов`);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log('');
          resolve({ fixed: fixed.length, issues: issues });
        })
        .catch(reject);
    });
  });
}

// Проверка целостности после миграции
function verifyIntegrity() {
  return new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        q.id,
        q.short_code,
        q.total_scans as stored_count,
        COUNT(s.id) as actual_count
      FROM qr_codes q
      LEFT JOIN scans s ON q.id = s.qr_code_id
      GROUP BY q.id, q.short_code, q.total_scans
      HAVING q.total_scans != COUNT(s.id)
    `, [], (err, remainingIssues) => {
      if (err) {
        reject(err);
        return;
      }

      if (remainingIssues.length > 0) {
        console.log('⚠️  ВНИМАНИЕ: После миграции остались рассинхронизации:');
        remainingIssues.forEach(issue => {
          console.log(`   - ${issue.short_code}: хранится ${issue.stored_count}, реально ${issue.actual_count}`);
        });
        console.log('');
      } else {
        console.log('✅ Проверка целостности: Все счетчики синхронизированы!');
        console.log('');
      }

      resolve(remainingIssues.length === 0);
    });
  });
}

// Главная функция
async function main() {
  try {
    const result = await recalculateScans();
    
    if (!DRY_RUN && result.fixed > 0) {
      const isOk = await verifyIntegrity();
      if (!isOk) {
        console.error('❌ После миграции остались проблемы. Проверьте логи выше.');
        process.exit(1);
      }
    }

    // Финальная статистика
    db.get('SELECT COUNT(*) as total_qr FROM qr_codes', [], (err, qrResult) => {
      if (err) {
        console.error('Ошибка получения статистики:', err);
        db.close();
        process.exit(1);
      }

      db.get('SELECT COUNT(*) as total_scans FROM scans', [], (err, scansResult) => {
        if (err) {
          console.error('Ошибка получения статистики:', err);
          db.close();
          process.exit(1);
        }

        console.log('📊 Финальная статистика:');
        console.log(`   QR кодов: ${qrResult.total_qr}`);
        console.log(`   Всего сканирований: ${scansResult.total_scans}`);
        console.log('');

        db.close((err) => {
          if (err) {
            console.error('Ошибка закрытия БД:', err);
            process.exit(1);
          }

          if (DRY_RUN) {
            console.log('🔍 Проверка завершена. Для применения изменений запустите без --dry-run');
          } else {
            console.log('✅ Миграция успешно завершена!');
          }
          console.log('');
          process.exit(0);
        });
      });
    });
  } catch (error) {
    console.error('❌ Критическая ошибка при миграции:', error);
    db.close();
    process.exit(1);
  }
}

// Запуск
main();

