const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const QRCode = require('qrcode');
const shortid = require('shortid');
const UAParser = require('ua-parser-js');
const geoip = require('geoip-lite');
const db = require('./database');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API: Создание нового QR кода
app.post('/api/qr/create', async (req, res) => {
  try {
    const { url, title, description } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL обязателен' });
    }

    // Проверка валидности URL
    try {
      new URL(url);
    } catch (error) {
      return res.status(400).json({ error: 'Некорректный URL' });
    }

    const shortCode = shortid.generate();
    const shortUrl = `${req.protocol}://${req.get('host')}/r/${shortCode}`;

    // Сохранение в базу данных
    db.run(
      'INSERT INTO qr_codes (short_code, original_url, title, description) VALUES (?, ?, ?, ?)',
      [shortCode, url, title || '', description || ''],
      async function(err) {
        if (err) {
          console.error('Ошибка при сохранении в БД:', err);
          return res.status(500).json({ error: 'Ошибка сервера' });
        }

        try {
          // Генерация QR кода
          const qrCodeDataUrl = await QRCode.toDataURL(shortUrl, {
            width: 300,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#ffffff'
            }
          });

          res.json({
            success: true,
            id: this.lastID,
            shortCode,
            shortUrl,
            originalUrl: url,
            qrCode: qrCodeDataUrl,
            title,
            description
          });
        } catch (qrError) {
          console.error('Ошибка генерации QR кода:', qrError);
          res.status(500).json({ error: 'Ошибка генерации QR кода' });
        }
      }
    );
  } catch (error) {
    console.error('Ошибка:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// Редирект и отслеживание
app.get('/r/:shortCode', (req, res) => {
  const { shortCode } = req.params;

  db.get('SELECT * FROM qr_codes WHERE short_code = ?', [shortCode], (err, qrCode) => {
    if (err || !qrCode) {
      return res.status(404).send('QR код не найден');
    }

    // Собираем данные о переходе
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    const parser = new UAParser(userAgent);
    const result = parser.getResult();
    const geo = geoip.lookup(ip.split(',')[0].trim());
    const referrer = req.headers['referer'] || req.headers['referrer'] || '';
    const language = req.headers['accept-language'] || '';

    // Сохраняем данные о сканировании
    const scanData = {
      qr_code_id: qrCode.id,
      ip_address: ip,
      user_agent: userAgent,
      browser: result.browser.name || '',
      browser_version: result.browser.version || '',
      os: result.os.name || '',
      os_version: result.os.version || '',
      device_type: result.device.type || 'desktop',
      device_vendor: result.device.vendor || '',
      device_model: result.device.model || '',
      country: geo ? geo.country : '',
      region: geo ? geo.region : '',
      city: geo ? geo.city : '',
      latitude: geo ? geo.ll[0] : null,
      longitude: geo ? geo.ll[1] : null,
      timezone: geo ? geo.timezone : '',
      referrer: referrer,
      language: language.split(',')[0] || ''
    };

    db.run(`
      INSERT INTO scans (
        qr_code_id, ip_address, user_agent, browser, browser_version,
        os, os_version, device_type, device_vendor, device_model,
        country, region, city, latitude, longitude, timezone, referrer, language
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, Object.values(scanData), (err) => {
      if (err) {
        console.error('Ошибка сохранения данных сканирования:', err);
      }
    });

    // Обновляем счетчик сканирований
    db.run('UPDATE qr_codes SET total_scans = total_scans + 1 WHERE id = ?', [qrCode.id]);

    // Редирект на оригинальный URL
    res.redirect(qrCode.original_url);
  });
});

// API: Получить список всех QR кодов
app.get('/api/qr/list', (req, res) => {
  db.all('SELECT * FROM qr_codes ORDER BY created_at DESC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка получения данных' });
    }
    res.json(rows);
  });
});

// API: Получить статистику по конкретному QR коду
app.get('/api/qr/:shortCode/stats', (req, res) => {
  const { shortCode } = req.params;

  db.get('SELECT * FROM qr_codes WHERE short_code = ?', [shortCode], (err, qrCode) => {
    if (err || !qrCode) {
      return res.status(404).json({ error: 'QR код не найден' });
    }

    db.all('SELECT * FROM scans WHERE qr_code_id = ? ORDER BY scan_time DESC', [qrCode.id], (err, scans) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка получения статистики' });
      }

      // Аналитика
      const analytics = {
        total_scans: qrCode.total_scans,
        browsers: {},
        os: {},
        devices: {},
        countries: {},
        cities: {},
        hourly: {},
        daily: {}
      };

      scans.forEach(scan => {
        // Браузеры
        if (scan.browser) {
          analytics.browsers[scan.browser] = (analytics.browsers[scan.browser] || 0) + 1;
        }

        // ОС
        if (scan.os) {
          analytics.os[scan.os] = (analytics.os[scan.os] || 0) + 1;
        }

        // Устройства
        if (scan.device_type) {
          analytics.devices[scan.device_type] = (analytics.devices[scan.device_type] || 0) + 1;
        }

        // Страны
        if (scan.country) {
          analytics.countries[scan.country] = (analytics.countries[scan.country] || 0) + 1;
        }

        // Города
        if (scan.city) {
          analytics.cities[scan.city] = (analytics.cities[scan.city] || 0) + 1;
        }

        // Временная статистика
        if (scan.scan_time) {
          const date = new Date(scan.scan_time);
          const hour = date.getHours();
          const day = date.toISOString().split('T')[0];

          analytics.hourly[hour] = (analytics.hourly[hour] || 0) + 1;
          analytics.daily[day] = (analytics.daily[day] || 0) + 1;
        }
      });

      res.json({
        qrCode,
        scans,
        analytics
      });
    });
  });
});

// API: Получить хронологические данные для дэшборда
app.get('/api/qr/:shortCode/timeline', (req, res) => {
  const { shortCode } = req.params;
  const { period = 'days', limit = 30, dateRange = 'today' } = req.query; // period: 'days', 'hours', 'weeks', dateRange: 'today', 'yesterday', 'week', 'month'

  db.get('SELECT * FROM qr_codes WHERE short_code = ?', [shortCode], (err, qrCode) => {
    if (err || !qrCode) {
      return res.status(404).json({ error: 'QR код не найден' });
    }

    // Вычисляем диапазон дат в зависимости от выбранного периода
    const now = new Date();
    let dateFrom, dateTo;
    
    switch (dateRange) {
      case 'today':
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        dateFrom = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
        dateTo = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
        break;
      case 'week':
        // Последние 7 дней включая сегодня
        dateFrom = new Date(now);
        dateFrom.setDate(dateFrom.getDate() - 6); // -6 чтобы включить сегодня (итого 7 дней)
        dateFrom.setHours(0, 0, 0, 0);
        dateTo = new Date(now);
        dateTo.setHours(23, 59, 59, 999);
        break;
      case 'month':
        // Последние 30 дней включая сегодня
        dateFrom = new Date(now);
        dateFrom.setDate(dateFrom.getDate() - 29); // -29 чтобы включить сегодня (итого 30 дней)
        dateFrom.setHours(0, 0, 0, 0);
        dateTo = new Date(now);
        dateTo.setHours(23, 59, 59, 999);
        break;
      case 'custom':
        // Кастомный диапазон обрабатывается выше
        if (req.query.dateFrom && req.query.dateTo) {
          dateFrom = new Date(req.query.dateFrom);
          dateFrom.setHours(0, 0, 0, 0);
          dateTo = new Date(req.query.dateTo);
          dateTo.setHours(23, 59, 59, 999);
        } else {
          // Если кастомный период выбран, но даты не переданы, используем сегодня
          dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
          dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        }
        break;
      default:
        // По умолчанию - сегодня
        dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        dateTo = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    }

    // Форматируем даты для SQL запроса
    const dateFromStr = dateFrom.toISOString();
    const dateToStr = dateTo.toISOString();

    db.all(
      'SELECT scan_time FROM scans WHERE qr_code_id = ? AND scan_time >= ? AND scan_time <= ? ORDER BY scan_time ASC',
      [qrCode.id, dateFromStr, dateToStr],
      (err, scans) => {
        if (err) {
          return res.status(500).json({ error: 'Ошибка получения данных' });
        }

        const timeline = {};

        scans.forEach(scan => {
          if (!scan.scan_time) return;
          
          const date = new Date(scan.scan_time);
          let key;

          if (period === 'hours') {
            // Группировка по часам
            key = date.toISOString().slice(0, 13) + ':00:00.000Z';
          } else if (period === 'weeks') {
            // Группировка по неделям
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            key = weekStart.toISOString().split('T')[0];
          } else {
            // Группировка по дням (по умолчанию)
            key = date.toISOString().split('T')[0];
          }

          timeline[key] = (timeline[key] || 0) + 1;
        });

        // Преобразуем в массив и сортируем
        const timelineArray = Object.entries(timeline)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => new Date(a.date) - new Date(b.date));

        // Заполняем пропуски дат нулями для непрерывного графика
        const filledTimeline = [];
        if (timelineArray.length > 0) {
          const firstDate = new Date(timelineArray[0].date);
          const lastDate = new Date(timelineArray[timelineArray.length - 1].date);
          const timelineMap = {};
          timelineArray.forEach(item => {
            timelineMap[item.date] = item.count;
          });

          let currentDate = new Date(firstDate);
          while (currentDate <= lastDate) {
            let key;
            if (period === 'hours') {
              key = currentDate.toISOString().slice(0, 13) + ':00:00.000Z';
              currentDate.setHours(currentDate.getHours() + 1);
            } else if (period === 'weeks') {
              const weekStart = new Date(currentDate);
              weekStart.setDate(currentDate.getDate() - currentDate.getDay());
              key = weekStart.toISOString().split('T')[0];
              currentDate.setDate(currentDate.getDate() + 7);
            } else {
              key = currentDate.toISOString().split('T')[0];
              currentDate.setDate(currentDate.getDate() + 1);
            }

            filledTimeline.push({
              date: key,
              count: timelineMap[key] || 0
            });
          }
        }

        // Ограничиваем количество точек только если нужно
        const limitedTimeline = filledTimeline.slice(-parseInt(limit));

        res.json({
          qrCode: {
            id: qrCode.id,
            short_code: qrCode.short_code,
            title: qrCode.title,
            total_scans: qrCode.total_scans
          },
          timeline: limitedTimeline,
          period,
          dateRange,
          total_points: limitedTimeline.length
        });
      }
    );
  });
});

// API: Обновить QR код
app.put('/api/qr/:shortCode', (req, res) => {
  const { shortCode } = req.params;
  const { url, title, description } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL обязателен' });
  }

  // Проверка валидности URL
  try {
    new URL(url);
  } catch (error) {
    return res.status(400).json({ error: 'Некорректный URL' });
  }

  db.get('SELECT * FROM qr_codes WHERE short_code = ?', [shortCode], (err, qrCode) => {
    if (err || !qrCode) {
      return res.status(404).json({ error: 'QR код не найден' });
    }

    db.run(
      'UPDATE qr_codes SET original_url = ?, title = ?, description = ? WHERE short_code = ?',
      [url, title || '', description || '', shortCode],
      function(err) {
        if (err) {
          console.error('Ошибка обновления:', err);
          return res.status(500).json({ error: 'Ошибка обновления' });
        }

        res.json({
          success: true,
          message: 'QR код обновлен',
          qrCode: {
            short_code: shortCode,
            original_url: url,
            title: title || '',
            description: description || ''
          }
        });
      }
    );
  });
});

// API: Удалить QR код
app.delete('/api/qr/:shortCode', (req, res) => {
  const { shortCode } = req.params;

  db.get('SELECT id FROM qr_codes WHERE short_code = ?', [shortCode], (err, qrCode) => {
    if (err || !qrCode) {
      return res.status(404).json({ error: 'QR код не найден' });
    }

    // Удаляем все сканирования
    db.run('DELETE FROM scans WHERE qr_code_id = ?', [qrCode.id], (err) => {
      if (err) {
        return res.status(500).json({ error: 'Ошибка удаления данных' });
      }

      // Удаляем QR код
      db.run('DELETE FROM qr_codes WHERE id = ?', [qrCode.id], (err) => {
        if (err) {
          return res.status(500).json({ error: 'Ошибка удаления QR кода' });
        }
        res.json({ success: true, message: 'QR код удален' });
      });
    });
  });
});

// API: Получить список пользователей (сканирований) с фильтрацией
app.get('/api/users', (req, res) => {
  const { qrCodeId, dateRange = 'today', dateFrom, dateTo, uniqueOnly = 'false' } = req.query;

  // Вычисляем диапазон дат
  const now = new Date();
  let dateFromCalc, dateToCalc;
  
  if (dateRange === 'custom' && dateFrom && dateTo) {
    dateFromCalc = new Date(dateFrom);
    dateFromCalc.setHours(0, 0, 0, 0);
    dateToCalc = new Date(dateTo);
    dateToCalc.setHours(23, 59, 59, 999);
  } else {
    switch (dateRange) {
      case 'today':
        dateFromCalc = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        dateToCalc = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        break;
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        dateFromCalc = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
        dateToCalc = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
        break;
      case 'week':
        dateFromCalc = new Date(now);
        dateFromCalc.setDate(dateFromCalc.getDate() - 6);
        dateFromCalc.setHours(0, 0, 0, 0);
        dateToCalc = new Date(now);
        dateToCalc.setHours(23, 59, 59, 999);
        break;
      case 'month':
        dateFromCalc = new Date(now);
        dateFromCalc.setDate(dateFromCalc.getDate() - 29);
        dateFromCalc.setHours(0, 0, 0, 0);
        dateToCalc = new Date(now);
        dateToCalc.setHours(23, 59, 59, 999);
        break;
      default:
        dateFromCalc = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        dateToCalc = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    }
  }

  const dateFromStr = dateFromCalc.toISOString();
  const dateToStr = dateToCalc.toISOString();

  // Формируем SQL запрос
  let query = `
    SELECT 
      s.*,
      q.short_code,
      q.title as qr_title,
      q.original_url
    FROM scans s
    JOIN qr_codes q ON s.qr_code_id = q.id
    WHERE s.scan_time >= ? AND s.scan_time <= ?
  `;
  const params = [dateFromStr, dateToStr];

  if (qrCodeId && qrCodeId !== 'all') {
    query += ' AND s.qr_code_id = ?';
    params.push(qrCodeId);
  }

  query += ' ORDER BY s.scan_time DESC';

  db.all(query, params, (err, scans) => {
    if (err) {
      return res.status(500).json({ error: 'Ошибка получения данных' });
    }

    // Если нужны только уникальные пользователи, группируем по отпечатку
    if (uniqueOnly === 'true') {
      const uniqueMap = new Map();
      scans.forEach(scan => {
        // Создаем отпечаток: IP + User Agent (можно улучшить)
        const fingerprint = `${scan.ip_address || ''}_${scan.user_agent || ''}`;
        if (!uniqueMap.has(fingerprint)) {
          uniqueMap.set(fingerprint, scan);
        } else {
          // Если уже есть, берем самое раннее сканирование
          const existing = uniqueMap.get(fingerprint);
          if (new Date(scan.scan_time) < new Date(existing.scan_time)) {
            uniqueMap.set(fingerprint, scan);
          }
        }
      });
      scans = Array.from(uniqueMap.values());
    }

    res.json({
      users: scans,
      total: scans.length,
      dateRange: {
        from: dateFromStr,
        to: dateToStr
      }
    });
  });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  console.log(`Откройте http://localhost:${PORT} в браузере`);
});

