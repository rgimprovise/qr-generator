#!/usr/bin/env node

/**
 * Скрипт для синхронизации total_scans с реальным количеством записей в scans
 * Использование: node sync-analytics.js [--dry-run]
 * 
 * --dry-run: только показать, что будет исправлено, без реальных изменений
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'qr_codes.db');
const isDryRun = process.argv.includes('--dry-run');

console.log('🔄 Синхронизация аналитики QR-кодов');
if (isDryRun) {
  console.log('⚠️  РЕЖИМ ПРОВЕРКИ (--dry-run): изменения не будут применены\n');
} else {
  console.log('⚠️  РЕЖИМ ИСПРАВЛЕНИЯ: изменения будут применены к базе данных\n');
}
console.log('='.repeat(60));

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Ошибка подключения к базе данных:', err.message);
    process.exit(1);
  }

  console.log('✅ Подключено к базе данных\n');

  // Находим все расхождения
  db.all(`
    SELECT 
      q.id,
      q.short_code,
      q.title,
      q.total_scans as stored_count,
      COUNT(s.id) as real_count,
      (COUNT(s.id) - q.total_scans) as difference
    FROM qr_codes q
    LEFT JOIN scans s ON q.id = s.qr_code_id
    GROUP BY q.id
    HAVING difference != 0
    ORDER BY q.id
  `, [], (err, rows) => {
    if (err) {
      console.error('❌ Ошибка при получении данных:', err);
      db.close();
      process.exit(1);
    }

    if (rows.length === 0) {
      console.log('✅ Расхождений не обнаружено. База данных синхронизирована!');
      db.close();
      return;
    }

    console.log(`📋 Найдено ${rows.length} QR-кодов с расхождениями:\n`);

    let totalFixed = 0;
    let totalUnder = 0;
    let totalOver = 0;

    // Обрабатываем каждый QR-код
    const processNext = (index) => {
      if (index >= rows.length) {
        // Все обработано
        console.log('\n' + '='.repeat(60));
        console.log('📊 ИТОГИ СИНХРОНИЗАЦИИ:');
        console.log('-'.repeat(60));
        console.log(`Всего QR-кодов обработано: ${rows.length}`);
        console.log(`Исправлено недоучетов: ${totalUnder}`);
        console.log(`Исправлено переучетов: ${totalOver}`);
        console.log(`Всего исправлений: ${totalFixed}`);
        
        if (!isDryRun) {
          console.log('\n✅ Синхронизация завершена успешно!');
        } else {
          console.log('\n💡 Это был режим проверки. Для применения изменений запустите без --dry-run');
        }
        
        db.close();
        return;
      }

      const row = rows[index];
      const { id, short_code, title, stored_count, real_count, difference } = row;

      console.log(`${index + 1}. ${title || 'Без названия'} (${short_code})`);
      console.log(`   ID: ${id}`);
      console.log(`   Было (total_scans): ${stored_count}`);
      console.log(`   Должно быть (реальное количество): ${real_count}`);
      console.log(`   Разница: ${difference > 0 ? '+' : ''}${difference}`);

      if (difference > 0) {
        totalUnder += difference;
        console.log(`   ⚠️  Недоучет: ${difference} сканирований`);
      } else {
        totalOver += Math.abs(difference);
        console.log(`   ⚠️  Переучет: ${Math.abs(difference)} сканирований`);
      }

      if (isDryRun) {
        console.log(`   💡 Будет обновлено: total_scans = ${real_count}\n`);
        totalFixed++;
        processNext(index + 1);
      } else {
        // Обновляем total_scans
        db.run(
          'UPDATE qr_codes SET total_scans = ? WHERE id = ?',
          [real_count, id],
          function(err) {
            if (err) {
              console.error(`   ❌ Ошибка обновления: ${err.message}\n`);
            } else {
              console.log(`   ✅ Обновлено: total_scans = ${real_count}\n`);
              totalFixed++;
            }
            processNext(index + 1);
          }
        );
      }
    };

    // Начинаем обработку
    processNext(0);
  });
});

