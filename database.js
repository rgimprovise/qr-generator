const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Создаем базу данных
const db = new sqlite3.Database('./qr_codes.db', (err) => {
  if (err) {
    console.error('Ошибка подключения к базе данных:', err.message);
  } else {
    console.log('Подключено к базе данных SQLite');
    initDatabase();
  }
});

// Инициализация таблиц
function initDatabase() {
  // Таблица для QR кодов
  db.run(`
    CREATE TABLE IF NOT EXISTS qr_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      short_code TEXT UNIQUE NOT NULL,
      original_url TEXT NOT NULL,
      title TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      total_scans INTEGER DEFAULT 0
    )
  `);

  // Таблица для отслеживания переходов
  db.run(`
    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      qr_code_id INTEGER NOT NULL,
      scan_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      ip_address TEXT,
      user_agent TEXT,
      browser TEXT,
      browser_version TEXT,
      os TEXT,
      os_version TEXT,
      device_type TEXT,
      device_vendor TEXT,
      device_model TEXT,
      country TEXT,
      region TEXT,
      city TEXT,
      latitude REAL,
      longitude REAL,
      timezone TEXT,
      referrer TEXT,
      language TEXT,
      screen_resolution TEXT,
      FOREIGN KEY (qr_code_id) REFERENCES qr_codes (id)
    )
  `);

  console.log('Таблицы базы данных инициализированы');
}

module.exports = db;

