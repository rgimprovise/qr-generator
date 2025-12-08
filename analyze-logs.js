#!/usr/bin/env node

/**
 * Скрипт для анализа логов приложения
 * Подсчитывает сканирования из логов, находит ошибки и сравнивает с БД
 * 
 * Использование: 
 *   node analyze-logs.js [--log-dir=/path/to/logs]
 * 
 * Где искать логи:
 *   1. PM2 логи: ./logs/ или ~/.pm2/logs/
 *   2. Nginx access log: /var/log/nginx/access.log
 *   3. Caddy logs: /var/log/caddy/
 *   4. Systemd logs: journalctl -u qr-generator > /tmp/qr-generator.log
 * 
 * Для получения логов PM2:
 *   pm2 logs qr-generator --lines 10000 --nostream > /var/www/qr-generator/logs/pm2-export.log
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const sqlite3 = require('sqlite3').verbose();
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Парсинг аргументов командной строки
const args = process.argv.slice(2);
let logDir = null;
args.forEach(arg => {
  if (arg.startsWith('--log-dir=')) {
    logDir = arg.split('=')[1];
  }
});

// Возможные места расположения логов
const possibleLogPaths = [
  logDir || path.join(__dirname, 'logs'),
  path.join(__dirname, 'logs'),
  path.join(process.env.HOME || '/root', '.pm2', 'logs'),
  '/var/log/qr-generator',
  '/var/www/qr-generator/logs',
  '/var/log/nginx',  // Nginx access logs
  '/var/log/caddy'   // Caddy logs
];

// Статистика
const stats = {
  totalScansFromLogs: 0,
  totalErrors: 0,
  dbErrors: 0,
  insertErrors: 0,
  updateErrors: 0,
  redirectErrors: 0,
  scansByQR: new Map(), // shortCode -> count
  scansByDate: new Map(), // date -> count
  errors: [],
  scanRequests: [], // Все запросы на сканирование
  timestamps: {
    firstScan: null,
    lastScan: null
  }
};

// Регулярные выражения
// Паттерны для разных форматов логов
const scanPatterns = [
  /GET\s+\/r\/([a-zA-Z0-9_-]+)/i,  // Express/стандартный формат
  /"GET\s+\/r\/([a-zA-Z0-9_-]+)/i,  // Nginx access log
  /\/r\/([a-zA-Z0-9_-]+)/i,         // Упрощенный паттерн (самый общий)
  /GET.*\/r\/([a-zA-Z0-9_-]+)/i,    // Более гибкий
  /\/r\/([a-zA-Z0-9_-]+)[\s"?#]/,   // С учетом конца строки или параметров
  /uri.*\/r\/([a-zA-Z0-9_-]+)/i,    // Для JSON логов с полем uri
  /path.*\/r\/([a-zA-Z0-9_-]+)/i    // Для JSON логов с полем path
];

const errorPattern = /(error|Error|ERROR|ошибка|Ошибка)/i;
const dbErrorPattern = /(Ошибка сохранения данных сканирования|Ошибка при сохранении в БД|Ошибка обновления|Cannot find module|MODULE_NOT_FOUND|SQLITE|database|SQLITE_ERROR)/i;
const insertErrorPattern = /(Ошибка сохранения данных сканирования|INSERT INTO scans|SQLITE_ERROR.*scans)/i;
const updateErrorPattern = /(Ошибка обновления|UPDATE.*total_scans|SQLITE_ERROR.*qr_codes)/i;
const timestampPattern = /(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2})|(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})|(\[\d{2}\/\w+\/\d{4}:\d{2}:\d{2}:\d{2})/;

// Nginx/Caddy access log patterns
const nginxLogPattern = /(\d+\.\d+\.\d+\.\d+)\s+-\s+-\s+\[([^\]]+)\]\s+"(GET|POST|HEAD)\s+(\/r\/([a-zA-Z0-9_-]+))/i;

/**
 * Парсит JSON строку лога Caddy
 */
function parseCaddyJSON(line) {
  try {
    const log = JSON.parse(line);
    
    // Проверяем структуру лога Caddy (разные варианты)
    let uri = null;
    let timestamp = null;
    
    // Вариант 1: log.request.uri
    if (log.request && log.request.uri) {
      uri = log.request.uri;
      timestamp = log.ts ? new Date(log.ts * 1000).toISOString() : null;
    }
    // Вариант 2: log.uri
    else if (log.uri) {
      uri = log.uri;
      timestamp = log.ts ? new Date(log.ts * 1000).toISOString() : null;
    }
    // Вариант 3: log.request.path или log.path
    else if (log.request && log.request.path) {
      uri = log.request.path;
      timestamp = log.ts ? new Date(log.ts * 1000).toISOString() : null;
    }
    else if (log.path) {
      uri = log.path;
      timestamp = log.ts ? new Date(log.ts * 1000).toISOString() : null;
    }
    
    if (uri) {
      // Ищем паттерн /r/shortCode в URI
      const match = uri.match(/\/r\/([a-zA-Z0-9_-]+)/);
      if (match) {
        return {
          shortCode: match[1],
          timestamp: timestamp,
          method: (log.request && log.request.method) || log.method || 'GET',
          status: log.status || null,
          ip: (log.request && log.request.remote_ip) || log.remote_ip || null
        };
      }
    }
  } catch (e) {
    // Не JSON или некорректный JSON
    return null;
  }
  return null;
}

/**
 * Парсит строку лога и извлекает информацию
 */
function parseLogLine(line, logFile) {
  // Пропускаем пустые строки
  if (!line || line.trim().length === 0) return;

  // Извлекаем timestamp
  let timestamp = null;
  const tsMatch = line.match(timestampPattern);
  if (tsMatch) {
    timestamp = tsMatch[0];
  }

  // Проверяем на запрос сканирования (разные форматы)
  let shortCode = null;
  let parsedData = null;
  
  // Сначала пробуем JSON формат (Caddy)
  if (line.trim().startsWith('{')) {
    parsedData = parseCaddyJSON(line);
    if (parsedData && parsedData.shortCode) {
      shortCode = parsedData.shortCode;
      if (parsedData.timestamp) {
        timestamp = parsedData.timestamp;
      }
    }
  }
  
  // Если не JSON, пробуем Nginx/Caddy текстовый формат
  if (!shortCode) {
    const nginxMatch = line.match(nginxLogPattern);
    if (nginxMatch) {
      shortCode = nginxMatch[5];
      if (nginxMatch[2]) {
        timestamp = nginxMatch[2];
      }
    } else {
      // Пробуем другие паттерны
      for (const pattern of scanPatterns) {
        const match = line.match(pattern);
        if (match) {
          shortCode = match[1];
          break;
        }
      }
    }
  }
  
  if (shortCode) {
    stats.totalScansFromLogs++;
    
    // Подсчет по QR-кодам
    stats.scansByQR.set(shortCode, (stats.scansByQR.get(shortCode) || 0) + 1);
    
    // Подсчет по датам
    let date = 'unknown';
    if (timestamp) {
      try {
        const dateObj = new Date(timestamp);
        if (!isNaN(dateObj.getTime())) {
          date = dateObj.toISOString().split('T')[0];
        }
      } catch (e) {
        // Используем 'unknown'
      }
    }
    stats.scansByDate.set(date, (stats.scansByDate.get(date) || 0) + 1);
    
    // Сохраняем запрос
    stats.scanRequests.push({
      shortCode,
      timestamp,
      line: line.substring(0, 200), // Первые 200 символов
      logFile: path.basename(logFile)
    });
    
    // Обновляем временные метки
    if (timestamp) {
      let ts;
      try {
        ts = new Date(timestamp);
        if (isNaN(ts.getTime())) {
          // Если не удалось распарсить, пропускаем
          return;
        }
      } catch (e) {
        return;
      }
      
      if (!stats.timestamps.firstScan || ts < stats.timestamps.firstScan) {
        stats.timestamps.firstScan = ts;
      }
      if (!stats.timestamps.lastScan || ts > stats.timestamps.lastScan) {
        stats.timestamps.lastScan = ts;
      }
    }
  }

  // Проверяем на ошибки
  if (errorPattern.test(line)) {
    stats.totalErrors++;
    
    const error = {
      type: 'general',
      message: line.substring(0, 500),
      timestamp,
      logFile: path.basename(logFile)
    };
    
    // Классификация ошибок
    if (dbErrorPattern.test(line)) {
      stats.dbErrors++;
      error.type = 'database';
      
      if (insertErrorPattern.test(line)) {
        stats.insertErrors++;
        error.subtype = 'insert';
      } else if (updateErrorPattern.test(line)) {
        stats.updateErrors++;
        error.subtype = 'update';
      }
    } else if (line.includes('redirect') || line.includes('редирект')) {
      stats.redirectErrors++;
      error.type = 'redirect';
    }
    
    stats.errors.push(error);
  }
}

/**
 * Читает файл лога построчно (поддерживает .gz)
 */
async function readLogFile(filePath) {
  return new Promise(async (resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      resolve(); // Файл не существует, пропускаем
      return;
    }

    let fileStream;
    
    // Обработка сжатых файлов
    if (filePath.endsWith('.gz')) {
      try {
        // Используем gunzip через pipe
        const { stdout } = await execAsync(`gunzip -c "${filePath}"`);
        // Создаем временный поток из stdout
        const lines = stdout.split('\n');
        let lineCount = 0;
        for (const line of lines) {
          if (line.trim()) {
            lineCount++;
            parseLogLine(line, filePath);
          }
        }
        console.log(`   ✅ Обработано строк: ${lineCount.toLocaleString()}`);
        resolve();
        return;
      } catch (err) {
        console.log(`   ⚠️  Не удалось распаковать .gz файл: ${err.message}`);
        resolve(); // Пропускаем файл, но не останавливаем обработку
        return;
      }
    }

    // Обычный файл
    try {
      fileStream = fs.createReadStream(filePath);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      let lineCount = 0;
      rl.on('line', (line) => {
        lineCount++;
        parseLogLine(line, filePath);
      });

      rl.on('close', () => {
        console.log(`   ✅ Обработано строк: ${lineCount.toLocaleString()}`);
        resolve();
      });

      rl.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Находит все файлы логов
 */
function findLogFiles() {
  const logFiles = [];
  
  for (const logPath of possibleLogPaths) {
    if (fs.existsSync(logPath)) {
      const stat = fs.statSync(logPath);
      
      if (stat.isDirectory()) {
        // Ищем все .log файлы в директории
        const files = fs.readdirSync(logPath);
        files.forEach(file => {
          if (file.endsWith('.log') || file.includes('access') || file.includes('qr')) {
            const fullPath = path.join(logPath, file);
            // Пропускаем слишком большие файлы (>500MB) или предлагаем их обработать отдельно
            try {
              const fileStat = fs.statSync(fullPath);
              if (fileStat.size < 500 * 1024 * 1024) { // 500MB
                logFiles.push(fullPath);
              } else {
                console.log(`   ⚠️  Пропущен большой файл: ${file} (${(fileStat.size / 1024 / 1024).toFixed(2)} MB)`);
              }
            } catch (e) {
              // Игнорируем ошибки доступа
            }
          }
        });
      } else if (stat.isFile() && (logPath.endsWith('.log') || logPath.includes('access'))) {
        logFiles.push(logPath);
      }
    }
  }
  
  // Также пробуем PM2 логи через команду
  // Но для этого нужен доступ к PM2, поэтому просто добавим в список возможных путей
  
  return [...new Set(logFiles)]; // Убираем дубликаты
}

/**
 * Сравнивает данные из логов с БД
 */
function compareWithDatabase(callback) {
  const dbPath = path.join(__dirname, 'qr_codes.db');
  
  if (!fs.existsSync(dbPath)) {
    console.log('⚠️  База данных не найдена, пропускаем сравнение');
    callback();
    return;
  }

  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('❌ Ошибка подключения к БД:', err);
      callback();
      return;
    }

    // Получаем данные из БД
    db.all(`
      SELECT 
        q.short_code,
        q.total_scans as db_count,
        COUNT(s.id) as real_count
      FROM qr_codes q
      LEFT JOIN scans s ON q.id = s.qr_code_id
      GROUP BY q.id, q.short_code
    `, [], (err, rows) => {
      if (err) {
        console.error('❌ Ошибка запроса к БД:', err);
        db.close();
        callback();
        return;
      }

      console.log('\n📊 СРАВНЕНИЕ С БАЗОЙ ДАННЫХ:');
      console.log('='.repeat(60));
      
      const dbStats = {
        totalQR: rows.length,
        totalFromDB: rows.reduce((sum, r) => sum + (r.db_count || 0), 0),
        totalReal: rows.reduce((sum, r) => sum + (r.real_count || 0), 0),
        qrCodes: new Map()
      };

      rows.forEach(row => {
        dbStats.qrCodes.set(row.short_code, {
          dbCount: row.db_count || 0,
          realCount: row.real_count || 0
        });
      });

      console.log(`Всего QR-кодов в БД: ${dbStats.totalQR}`);
      console.log(`Сумма total_scans из БД: ${dbStats.totalFromDB}`);
      console.log(`Реальное количество записей в scans: ${dbStats.totalReal}`);
      console.log(`Сканирований из логов: ${stats.totalScansFromLogs}`);
      
      console.log('\n📋 ДЕТАЛЬНОЕ СРАВНЕНИЕ ПО QR-КОДАМ:');
      console.log('-'.repeat(60));
      
      const allQRCodes = new Set([
        ...stats.scansByQR.keys(),
        ...dbStats.qrCodes.keys()
      ]);

      let discrepancies = 0;
      allQRCodes.forEach(shortCode => {
        const logCount = stats.scansByQR.get(shortCode) || 0;
        const dbData = dbStats.qrCodes.get(shortCode);
        
        if (dbData) {
          const dbCount = dbData.dbCount;
          const realCount = dbData.realCount;
          
          if (logCount !== dbCount || logCount !== realCount) {
            discrepancies++;
            console.log(`\n⚠️  ${shortCode}:`);
            console.log(`   Из логов: ${logCount}`);
            console.log(`   total_scans в БД: ${dbCount}`);
            console.log(`   Реальных записей в БД: ${realCount}`);
            
            if (logCount > dbCount) {
              console.log(`   ⚠️  В логах БОЛЬШЕ на ${logCount - dbCount} сканирований!`);
            } else if (logCount < dbCount) {
              console.log(`   ⚠️  В БД БОЛЬШЕ на ${dbCount - logCount} сканирований!`);
            }
          }
        } else {
          console.log(`\n⚠️  ${shortCode}: Найдено в логах (${logCount}), но нет в БД!`);
        }
      });

      if (discrepancies === 0) {
        console.log('\n✅ Расхождений не обнаружено!');
      }

      // Общая статистика
      console.log('\n📈 ОБЩАЯ СТАТИСТИКА:');
      console.log('-'.repeat(60));
      console.log(`Разница (логи - БД total_scans): ${stats.totalScansFromLogs - dbStats.totalFromDB}`);
      console.log(`Разница (логи - БД реальные): ${stats.totalScansFromLogs - dbStats.totalReal}`);
      
      if (stats.totalScansFromLogs !== dbStats.totalFromDB) {
        const percent = dbStats.totalFromDB > 0 
          ? (((stats.totalScansFromLogs - dbStats.totalFromDB) / dbStats.totalFromDB) * 100).toFixed(2)
          : 'N/A';
        console.log(`Процент расхождения: ${percent}%`);
      }

      db.close();
      callback();
    });
  });
}

/**
 * Главная функция
 */
async function main() {
  console.log('🔍 Анализ логов приложения QR Generator');
  console.log('='.repeat(60));
  console.log('\n📂 Поиск файлов логов...\n');

  const logFiles = findLogFiles();

  if (logFiles.length === 0) {
    console.log('⚠️  Файлы логов не найдены в стандартных местах:');
    possibleLogPaths.forEach(p => console.log(`   - ${p}`));
    console.log('\n💡 Попробуйте указать путь вручную:');
    console.log('   node analyze-logs.js --log-dir=/path/to/logs');
    process.exit(1);
  }

  console.log(`✅ Найдено ${logFiles.length} файл(ов) логов:\n`);
  logFiles.forEach(file => {
    const size = fs.statSync(file).size;
    const sizeMB = (size / 1024 / 1024).toFixed(2);
    console.log(`   📄 ${file} (${sizeMB} MB)`);
  });

  console.log('\n📖 Обработка логов...\n');

  // Обрабатываем все файлы
  for (const logFile of logFiles) {
    console.log(`📄 Обработка: ${path.basename(logFile)}`);
    try {
      await readLogFile(logFile);
    } catch (err) {
      console.error(`   ❌ Ошибка при чтении файла: ${err.message}`);
    }
  }

  // Выводим статистику
  console.log('\n\n📊 СТАТИСТИКА ИЗ ЛОГОВ:');
  console.log('='.repeat(60));
  console.log(`Всего сканирований найдено в логах: ${stats.totalScansFromLogs}`);
  
  if (stats.timestamps.firstScan) {
    console.log(`Период: ${stats.timestamps.firstScan.toISOString()} - ${stats.timestamps.lastScan.toISOString()}`);
  }

  console.log(`\n📋 Сканирования по QR-кодам:`);
  const sortedQR = Array.from(stats.scansByQR.entries())
    .sort((a, b) => b[1] - a[1]);
  sortedQR.forEach(([shortCode, count]) => {
    console.log(`   ${shortCode}: ${count}`);
  });

  console.log(`\n📅 Сканирования по датам (топ 10):`);
  const sortedDates = Array.from(stats.scansByDate.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  sortedDates.forEach(([date, count]) => {
    console.log(`   ${date}: ${count}`);
  });

  // Статистика по ошибкам
  console.log(`\n\n⚠️  ОШИБКИ В ЛОГАХ:`);
  console.log('='.repeat(60));
  console.log(`Всего ошибок: ${stats.totalErrors}`);
  console.log(`Ошибок БД: ${stats.dbErrors}`);
  console.log(`  - Ошибки INSERT: ${stats.insertErrors}`);
  console.log(`  - Ошибки UPDATE: ${stats.updateErrors}`);
  console.log(`Ошибок редиректа: ${stats.redirectErrors}`);

  if (stats.errors.length > 0) {
    console.log(`\n📋 Последние 10 ошибок:`);
    stats.errors.slice(-10).forEach((error, index) => {
      console.log(`\n${index + 1}. [${error.type}${error.subtype ? '/' + error.subtype : ''}] ${error.timestamp || 'без даты'}`);
      console.log(`   ${error.message.substring(0, 150)}...`);
      console.log(`   Файл: ${error.logFile}`);
    });
  }

  // Сравнение с БД
  compareWithDatabase(() => {
    console.log('\n\n💡 РЕКОМЕНДАЦИИ:');
    console.log('='.repeat(60));
    
    if (stats.insertErrors > 0 || stats.updateErrors > 0) {
      console.log('⚠️  Обнаружены ошибки БД при сохранении сканирований!');
      console.log('   Рекомендуется:');
      console.log('   1. Проверить целостность базы данных');
      console.log('   2. Убедиться, что используются транзакции');
      console.log('   3. Проверить права доступа к БД');
    }
    
    if (stats.totalScansFromLogs === 0) {
      console.log('⚠️  В логах не найдено сканирований!');
      console.log('   Возможные причины:');
      console.log('   1. Логи не содержат HTTP запросы (нужен middleware для логирования)');
      console.log('   2. Логи находятся в другом месте');
      console.log('   3. Приложение использует другой формат логирования');
    }
    
    console.log('\n✅ Анализ завершен!');
  });
}

// Запуск
main().catch(err => {
  console.error('❌ Критическая ошибка:', err);
  process.exit(1);
});

