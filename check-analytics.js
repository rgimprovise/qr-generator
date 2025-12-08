#!/usr/bin/env node

/**
 * Скрипт для проверки расхождений между total_scans и реальным количеством сканирований
 * Использование: node check-analytics.js
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'qr_codes.db');

console.log('🔍 Проверка точности аналитики QR-кодов\n');
console.log('=' .repeat(60));

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Ошибка подключения к базе данных:', err.message);
    process.exit(1);
  }

  console.log('✅ Подключено к базе данных\n');

  // 1. Общая статистика
  console.log('📊 ОБЩАЯ СТАТИСТИКА:');
  console.log('-'.repeat(60));
  
  db.get('SELECT COUNT(*) as total_qr FROM qr_codes', [], (err, row) => {
    if (err) {
      console.error('Ошибка:', err);
      return;
    }
    const totalQR = row.total_qr;
    console.log(`Всего QR-кодов: ${totalQR}`);

    db.get('SELECT SUM(total_scans) as total_from_counter FROM qr_codes', [], (err, row) => {
      if (err) {
        console.error('Ошибка:', err);
        return;
      }
      const totalFromCounter = row.total_from_counter || 0;
      console.log(`Сумма total_scans (из счетчика): ${totalFromCounter}`);

      db.get('SELECT COUNT(*) as total_real FROM scans', [], (err, row) => {
        if (err) {
          console.error('Ошибка:', err);
          return;
        }
        const totalReal = row.total_real;
        console.log(`Реальное количество записей в scans: ${totalReal}`);
        
        const difference = totalReal - totalFromCounter;
        console.log(`\n📈 РАСХОЖДЕНИЕ: ${difference > 0 ? '+' : ''}${difference}`);
        
        if (difference !== 0) {
          const percent = totalFromCounter > 0 
            ? ((difference / totalFromCounter) * 100).toFixed(2)
            : 'N/A';
          console.log(`   Процент расхождения: ${percent}%`);
          
          if (difference > 0) {
            console.log('   ⚠️  ВНИМАНИЕ: Реальных записей БОЛЬШЕ, чем в счетчике!');
            console.log('   Это означает, что некоторые сканирования не были учтены в total_scans.');
          } else {
            console.log('   ⚠️  ВНИМАНИЕ: В счетчике БОЛЬШЕ, чем реальных записей!');
            console.log('   Это означает, что счетчик был обновлен, но запись не сохранилась.');
          }
        } else {
          console.log('   ✅ Расхождений не обнаружено!');
        }

        // 2. Детальная проверка по каждому QR-коду
        console.log('\n\n📋 ДЕТАЛЬНАЯ ПРОВЕРКА ПО QR-КОДАМ:');
        console.log('-'.repeat(60));
        
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
          ORDER BY ABS(difference) DESC, q.id
        `, [], (err, rows) => {
          if (err) {
            console.error('Ошибка:', err);
            db.close();
            return;
          }

          const withDiscrepancies = rows.filter(r => r.difference !== 0);
          
          if (withDiscrepancies.length === 0) {
            console.log('✅ Все QR-коды синхронизированы!');
          } else {
            console.log(`⚠️  Найдено ${withDiscrepancies.length} QR-кодов с расхождениями:\n`);
            
            withDiscrepancies.forEach((row, index) => {
              console.log(`${index + 1}. ${row.title || 'Без названия'} (${row.short_code})`);
              console.log(`   ID: ${row.id}`);
              console.log(`   Счетчик (total_scans): ${row.stored_count}`);
              console.log(`   Реальное количество: ${row.real_count}`);
              console.log(`   Расхождение: ${row.difference > 0 ? '+' : ''}${row.difference}`);
              console.log('');
            });
          }

          // 3. Статистика по расхождениям
          if (withDiscrepancies.length > 0) {
            console.log('\n📊 СТАТИСТИКА ПО РАСХОЖДЕНИЯМ:');
            console.log('-'.repeat(60));
            
            const totalUnder = withDiscrepancies
              .filter(r => r.difference > 0)
              .reduce((sum, r) => sum + r.difference, 0);
            const totalOver = Math.abs(withDiscrepancies
              .filter(r => r.difference < 0)
              .reduce((sum, r) => sum + r.difference, 0));
            
            console.log(`QR-кодов с недоучетом (real_count > stored_count): ${withDiscrepancies.filter(r => r.difference > 0).length}`);
            console.log(`   Всего недоучтено сканирований: ${totalUnder}`);
            console.log(`QR-кодов с переучетом (stored_count > real_count): ${withDiscrepancies.filter(r => r.difference < 0).length}`);
            console.log(`   Всего переучтено сканирований: ${totalOver}`);
          }

          // 4. Рекомендации
          console.log('\n\n💡 РЕКОМЕНДАЦИИ:');
          console.log('-'.repeat(60));
          
          if (difference !== 0 || withDiscrepancies.length > 0) {
            console.log('1. Обнаружены расхождения в данных!');
            console.log('2. Рекомендуется запустить скрипт синхронизации: node sync-analytics.js');
            console.log('3. Проверить логи сервера на наличие ошибок БД');
            console.log('4. Убедиться, что используются транзакции при сохранении сканирований');
          } else {
            console.log('✅ Данные синхронизированы. Рекомендуется:');
            console.log('1. Регулярно запускать проверку (например, раз в день)');
            console.log('2. Мониторить логи на наличие ошибок БД');
            console.log('3. Убедиться, что используются транзакции при сохранении сканирований');
          }

          console.log('\n' + '='.repeat(60));
          db.close();
        });
      });
    });
  });
});

