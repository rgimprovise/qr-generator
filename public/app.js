// Глобальные переменные
let currentQRCode = null;
let dashboardChart = null; // Chart.js instance
let selectedQRCodes = new Set(); // Сохраняем выбранные QR коды
let customDateRange = null; // Кастомный диапазон дат {from, to}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    loadQRList();
    loadDashboard();
    loadMetrics();
    
    // Обработчик формы создания QR кода
    document.getElementById('createForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await createQRCode();
    });
    
    // Обработчики кнопок периода
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            // Перезагружаем данные дэшборда с новым периодом
            if (document.getElementById('dashboard-section').classList.contains('active')) {
                loadDashboardData();
            }
        });
    });
});

// Создание QR кода
async function createQRCode() {
    const url = document.getElementById('url').value;
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;

    const submitBtn = document.querySelector('#createForm button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Генерация...';

    try {
        const response = await fetch('/api/qr/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url, title, description })
        });

        const data = await response.json();

        if (data.success) {
            currentQRCode = data;
            displayQRResult(data);
            
            // Очистка формы
            document.getElementById('createForm').reset();
            
            // Обновление списка и дэшборда
            loadQRList();
            loadDashboard();
            loadMetrics();
            
            // Прокрутка к результату
            document.getElementById('result').scrollIntoView({ behavior: 'smooth' });
        } else {
            alert('Ошибка: ' + (data.error || 'Неизвестная ошибка'));
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка создания QR кода: ' + error.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-magic"></i> Сгенерировать QR код';
    }
}

// Отображение результата
function displayQRResult(data) {
    const resultDiv = document.getElementById('result');
    resultDiv.style.display = 'block';
    
    document.getElementById('qrImage').src = data.qrCode;
    document.getElementById('shortUrl').href = data.shortUrl;
    document.getElementById('shortUrl').textContent = data.shortUrl;
    document.getElementById('originalUrl').textContent = data.originalUrl;
    document.getElementById('shortCode').textContent = data.shortCode;
}

// Загрузка списка QR кодов
async function loadQRList() {
    const qrListDiv = document.getElementById('qrList');
    
    if (!qrListDiv) {
        console.error('Элемент qrList не найден');
        return;
    }
    
    qrListDiv.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Загрузка...</div>';

    try {
        // Создаем AbortController для таймаута
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch('/api/qr/list', {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const qrCodes = await response.json();

        if (qrCodes.length === 0) {
            qrListDiv.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>Пока нет созданных QR кодов</p>
                </div>
            `;
            return;
        }

        qrListDiv.innerHTML = '';
        
        qrCodes.forEach(qr => {
            const qrItem = document.createElement('div');
            qrItem.className = 'qr-item';
            
            const shortUrl = `${window.location.origin}/r/${qr.short_code}`;
            const createdDate = new Date(qr.created_at).toLocaleString('ru-RU');
            
            qrItem.innerHTML = `
                <img src="${generateQRCodeDataURL(shortUrl)}" alt="QR Code">
                <div class="qr-item-info">
                    <h3>${qr.title || 'Без названия'}</h3>
                    ${qr.description ? `<p>${qr.description}</p>` : ''}
                    <p class="url">${qr.original_url}</p>
                    <div class="qr-item-stats">
                        <span class="stat-badge">
                            <i class="fas fa-chart-line"></i> ${qr.total_scans} переходов
                        </span>
                        <span class="stat-badge">
                            <i class="fas fa-calendar"></i> ${createdDate}
                        </span>
                    </div>
                </div>
                <div class="qr-item-actions">
                    <button class="btn btn-info btn-sm" onclick="viewStatsModal('${qr.short_code}')">
                        <i class="fas fa-chart-bar"></i> Статистика
                    </button>
                    <button class="btn btn-primary btn-sm" onclick="editQRCode('${qr.short_code}')">
                        <i class="fas fa-edit"></i> Редактировать
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="copyToClipboard('', '${shortUrl}')">
                        <i class="fas fa-copy"></i> Копировать
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteQRCode('${qr.short_code}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            
            qrListDiv.appendChild(qrItem);
        });
    } catch (error) {
        console.error('Ошибка загрузки списка:', error);
        
        if (error.name === 'AbortError') {
            qrListDiv.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Превышено время ожидания загрузки</p>
                    <button class="btn btn-secondary btn-sm" onclick="loadQRList()" style="margin-top: 1rem;">
                        <i class="fas fa-redo"></i> Попробовать снова
                    </button>
                </div>
            `;
        } else {
            qrListDiv.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Ошибка загрузки данных: ${error.message}</p>
                    <button class="btn btn-secondary btn-sm" onclick="loadQRList()" style="margin-top: 1rem;">
                        <i class="fas fa-redo"></i> Попробовать снова
                    </button>
                </div>
            `;
        }
    }
}

// Генерация QR кода для превью (синхронная версия для списка)
function generateQRCodeDataURL(text) {
    // Используем уже созданные QR коды или placeholder
    return `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(text)}`;
}

// Копирование в буфер обмена
async function copyToClipboard(elementId, text = null) {
    try {
        const textToCopy = text || document.getElementById(elementId).textContent;
        await navigator.clipboard.writeText(textToCopy);
        
        // Визуальная обратная связь
        const btn = event.target.closest('button');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Скопировано!';
        btn.style.background = 'var(--success-color)';
        
        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.style.background = '';
        }, 2000);
    } catch (error) {
        console.error('Ошибка копирования:', error);
        alert('Не удалось скопировать');
    }
}

// Скачивание QR кода
function downloadQR() {
    if (!currentQRCode) return;
    
    const link = document.createElement('a');
    link.download = `qr-code-${currentQRCode.shortCode}.png`;
    link.href = currentQRCode.qrCode;
    link.click();
}

// Просмотр статистики (из результата)
function viewStats() {
    if (!currentQRCode) return;
    viewStatsModal(currentQRCode.shortCode);
}

// Просмотр статистики в модальном окне
async function viewStatsModal(shortCode) {
    const modal = document.getElementById('statsModal');
    const statsContent = document.getElementById('statsContent');
    
    modal.style.display = 'block';
    statsContent.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Загрузка статистики...</div>';

    try {
        const response = await fetch(`/api/qr/${shortCode}/stats`);
        const data = await response.json();

        if (data.error) {
            statsContent.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>${data.error}</p>
                </div>
            `;
            return;
        }

        displayStats(data);
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
        statsContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Ошибка загрузки статистики</p>
            </div>
        `;
    }
}

// Отображение статистики
function displayStats(data) {
    const { qrCode, scans, analytics } = data;
    const statsContent = document.getElementById('statsContent');
    
    // Общая информация
    let html = `
        <div class="stats-overview">
            <div class="stat-card">
                <h3>${qrCode.total_scans}</h3>
                <p>Всего переходов</p>
            </div>
            <div class="stat-card" style="background: linear-gradient(135deg, #10b981, #059669);">
                <h3>${scans.length}</h3>
                <p>Уникальных сканирований</p>
            </div>
            <div class="stat-card" style="background: linear-gradient(135deg, #f59e0b, #d97706);">
                <h3>${Object.keys(analytics.countries).length}</h3>
                <p>Стран</p>
            </div>
            <div class="stat-card" style="background: linear-gradient(135deg, #ef4444, #dc2626);">
                <h3>${Object.keys(analytics.devices).length}</h3>
                <p>Типов устройств</p>
            </div>
        </div>

        <div class="stats-section">
            <h3><i class="fas fa-info-circle"></i> Информация о QR коде</h3>
            <div class="info-item">
                <strong>Название:</strong>
                <span>${qrCode.title || 'Без названия'}</span>
            </div>
            <div class="info-item">
                <strong>Оригинальный URL:</strong>
                <a href="${qrCode.original_url}" target="_blank">${qrCode.original_url}</a>
            </div>
            <div class="info-item">
                <strong>Короткая ссылка:</strong>
                <a href="${window.location.origin}/r/${qrCode.short_code}" target="_blank">
                    ${window.location.origin}/r/${qrCode.short_code}
                </a>
            </div>
            <div class="info-item">
                <strong>Создан:</strong>
                <span>${new Date(qrCode.created_at).toLocaleString('ru-RU')}</span>
            </div>
        </div>
    `;

    // Статистика по категориям
    html += '<div class="stats-grid">';
    
    // Браузеры
    if (Object.keys(analytics.browsers).length > 0) {
        html += createStatBlock('Браузеры', analytics.browsers, 'fa-globe');
    }
    
    // ОС
    if (Object.keys(analytics.os).length > 0) {
        html += createStatBlock('Операционные системы', analytics.os, 'fa-desktop');
    }
    
    // Устройства
    if (Object.keys(analytics.devices).length > 0) {
        html += createStatBlock('Устройства', analytics.devices, 'fa-mobile-alt');
    }
    
    // Страны
    if (Object.keys(analytics.countries).length > 0) {
        html += createStatBlock('Страны', analytics.countries, 'fa-globe-americas');
    }
    
    // Города
    if (Object.keys(analytics.cities).length > 0) {
        html += createStatBlock('Города', analytics.cities, 'fa-city');
    }
    
    html += '</div>';

    // Таблица всех сканирований
    if (scans.length > 0) {
        html += `
            <div class="stats-section">
                <h3><i class="fas fa-table"></i> Детальная информация о всех переходах</h3>
                <div style="overflow-x: auto;">
                    <table class="scans-table">
                        <thead>
                            <tr>
                                <th>Дата и время</th>
                                <th>IP адрес</th>
                                <th>Браузер</th>
                                <th>ОС</th>
                                <th>Устройство</th>
                                <th>Локация</th>
                                <th>Язык</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        scans.forEach(scan => {
            const location = [scan.city, scan.region, scan.country].filter(Boolean).join(', ') || 'Неизвестно';
            html += `
                <tr>
                    <td>${new Date(scan.scan_time).toLocaleString('ru-RU')}</td>
                    <td>${scan.ip_address || 'N/A'}</td>
                    <td>${scan.browser ? `${scan.browser} ${scan.browser_version || ''}` : 'N/A'}</td>
                    <td>${scan.os ? `${scan.os} ${scan.os_version || ''}` : 'N/A'}</td>
                    <td>${scan.device_type || 'N/A'}</td>
                    <td>${location}</td>
                    <td>${scan.language || 'N/A'}</td>
                </tr>
            `;
        });

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    statsContent.innerHTML = html;
}

// Создание блока статистики
function createStatBlock(title, data, icon) {
    const sortedData = Object.entries(data)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    let html = `
        <div class="stat-item">
            <h4><i class="fas ${icon}"></i> ${title}</h4>
            <div class="stat-list">
    `;

    sortedData.forEach(([key, value]) => {
        const percentage = ((value / Object.values(data).reduce((a, b) => a + b, 0)) * 100).toFixed(1);
        html += `
            <div class="stat-list-item">
                <span>${key || 'Неизвестно'}</span>
                <span>${value} (${percentage}%)</span>
            </div>
        `;
    });

    html += '</div></div>';
    return html;
}

// Закрытие модального окна
function closeStatsModal() {
    document.getElementById('statsModal').style.display = 'none';
}

// Закрытие модального окна при клике вне его
window.onclick = function(event) {
    const modal = document.getElementById('statsModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}

// Удаление QR кода
async function deleteQRCode(shortCode) {
    if (!confirm('Вы уверены, что хотите удалить этот QR код? Все данные и статистика будут потеряны.')) {
        return;
    }

    try {
        const response = await fetch(`/api/qr/${shortCode}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            alert('QR код успешно удален');
            loadQRList();
            loadDashboard(); // Обновляем дэшборд
            
            // Скрыть результат, если он был отображен
            if (currentQRCode && currentQRCode.shortCode === shortCode) {
                document.getElementById('result').style.display = 'none';
                currentQRCode = null;
            }
            
            // Обновляем дэшборд (чекбоксы обновятся автоматически)
            loadDashboard();
        } else {
            alert('Ошибка: ' + (data.error || 'Не удалось удалить QR код'));
        }
    } catch (error) {
        console.error('Ошибка удаления:', error);
        alert('Ошибка удаления QR кода');
    }
}

// Редактирование QR кода
async function editQRCode(shortCode) {
  // Получаем данные текущего QR кода
  try {
    const response = await fetch(`/api/qr/list`);
    const qrCodes = await response.json();
    const qrCode = qrCodes.find(qr => qr.short_code === shortCode);
    
    if (!qrCode) {
      alert('QR код не найден');
      return;
    }

    // Создаем модальное окно для редактирования
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2><i class="fas fa-edit"></i> Редактировать QR код</h2>
          <button class="close-btn" onclick="this.closest('.modal').remove()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <form id="editForm" onsubmit="return false;">
            <div class="form-group">
              <label for="edit-url">
                <i class="fas fa-link"></i> Целевой URL *
              </label>
              <input 
                type="url" 
                id="edit-url" 
                value="${qrCode.original_url}"
                required
              >
            </div>

            <div class="form-group">
              <label for="edit-title">
                <i class="fas fa-heading"></i> Название
              </label>
              <input 
                type="text" 
                id="edit-title" 
                value="${qrCode.title || ''}"
              >
            </div>

            <div class="form-group">
              <label for="edit-description">
                <i class="fas fa-align-left"></i> Описание
              </label>
              <textarea 
                id="edit-description" 
                rows="3"
              >${qrCode.description || ''}</textarea>
            </div>

            <div class="action-buttons">
              <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                <i class="fas fa-times"></i> Отмена
              </button>
              <button type="submit" class="btn btn-primary">
                <i class="fas fa-save"></i> Сохранить изменения
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Обработчик отправки формы
    document.getElementById('editForm').onsubmit = async (e) => {
      e.preventDefault();
      
      const url = document.getElementById('edit-url').value;
      const title = document.getElementById('edit-title').value;
      const description = document.getElementById('edit-description').value;

      const submitBtn = e.target.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Сохранение...';

      try {
        const response = await fetch(`/api/qr/${shortCode}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url, title, description })
        });

        const data = await response.json();

        if (data.success) {
          alert('✅ QR код успешно обновлен!');
          modal.remove();
          loadQRList();
          loadDashboard(); // Обновляем дэшборд
        } else {
          alert('Ошибка: ' + (data.error || 'Не удалось обновить'));
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить изменения';
        }
      } catch (error) {
        console.error('Ошибка:', error);
        alert('Ошибка обновления QR кода');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Сохранить изменения';
      }
    };

    // Закрытие по клику вне модального окна
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    };
  } catch (error) {
    console.error('Ошибка загрузки QR кода:', error);
    alert('Не удалось загрузить данные QR кода');
  }
}

// Обработка нажатия Escape для закрытия модального окна
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeStatsModal();
        // Закрыть модальное окно редактирования если открыто
        const editModal = document.querySelector('.modal');
        if (editModal) {
            editModal.remove();
        }
    }
});

// ==================== ДЭШБОРД АНАЛИТИКИ ====================

// Загрузка дэшборда (заполнение списка QR кодов с чекбоксами)
async function loadDashboard() {
    const qrCodesCheckboxes = document.getElementById('qrCodesCheckboxes');
    
    if (!qrCodesCheckboxes) {
        console.error('Элемент qrCodesCheckboxes не найден');
        return;
    }
    
    // Показываем загрузку только если список пустой
    if (qrCodesCheckboxes.children.length === 0 || qrCodesCheckboxes.querySelector('.loading')) {
        qrCodesCheckboxes.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Загрузка QR кодов...</div>';
    }
    
    try {
        // Создаем AbortController для таймаута
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch('/api/qr/list', {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const qrCodes = await response.json();

        if (qrCodes.length === 0) {
            qrCodesCheckboxes.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>Нет созданных QR кодов</p>
                </div>
            `;
            return;
        }

        // Очищаем и заполняем чекбоксы
        qrCodesCheckboxes.innerHTML = '';
        
        qrCodes.forEach(qr => {
            const checkboxContainer = document.createElement('div');
            checkboxContainer.className = 'qr-checkbox-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `qr-${qr.short_code}`;
            checkbox.value = qr.short_code;
            checkbox.className = 'qr-checkbox';
            
            // Восстанавливаем выбранные QR коды
            if (selectedQRCodes.has(qr.short_code)) {
                checkbox.checked = true;
            }
            
            checkbox.addEventListener('change', function() {
                if (this.checked) {
                    selectedQRCodes.add(qr.short_code);
                } else {
                    selectedQRCodes.delete(qr.short_code);
                }
                loadDashboardData();
            });
            
            const label = document.createElement('label');
            label.htmlFor = `qr-${qr.short_code}`;
            label.innerHTML = `
                <span class="qr-checkbox-title">${qr.title || 'Без названия'}</span>
                <span class="qr-checkbox-meta">${qr.total_scans} переходов</span>
            `;
            
            checkboxContainer.appendChild(checkbox);
            checkboxContainer.appendChild(label);
            qrCodesCheckboxes.appendChild(checkboxContainer);
        });

        // Если нет выбранных QR кодов и есть доступные, выбираем первый по умолчанию
        if (qrCodes.length > 0 && selectedQRCodes.size === 0) {
            const firstCode = qrCodes[0].short_code;
            selectedQRCodes.add(firstCode);
            const firstCheckbox = document.getElementById(`qr-${firstCode}`);
            if (firstCheckbox) {
                firstCheckbox.checked = true;
                loadDashboardData();
            }
        } else if (selectedQRCodes.size > 0) {
            // Если есть сохраненные выбранные коды, загружаем данные
            loadDashboardData();
        }
    } catch (error) {
        console.error('Ошибка загрузки QR кодов для дэшборда:', error);
        
        if (error.name === 'AbortError') {
            qrCodesCheckboxes.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Превышено время ожидания загрузки</p>
                    <button class="btn btn-secondary btn-sm" onclick="loadDashboard()" style="margin-top: 1rem;">
                        <i class="fas fa-redo"></i> Попробовать снова
                    </button>
                </div>
            `;
        } else {
            qrCodesCheckboxes.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Ошибка загрузки QR кодов: ${error.message}</p>
                    <button class="btn btn-secondary btn-sm" onclick="loadDashboard()" style="margin-top: 1rem;">
                        <i class="fas fa-redo"></i> Попробовать снова
                    </button>
                </div>
            `;
        }
    }
}

// Обработка изменения периода группировки
function handlePeriodGroupChange() {
    const periodSelect = document.getElementById('periodSelect');
    const period = periodSelect.value;
    
    // Если выбран "По часам", автоматически переключаем на "Сегодня" для лучшей визуализации
    if (period === 'hours') {
        const todayBtn = document.querySelector('.period-btn[data-period="today"]');
        if (todayBtn) {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            todayBtn.classList.add('active');
        }
    }
    
    // Перезагружаем данные
    loadDashboardData();
}

// Загрузка данных для дэшборда (для нескольких QR кодов)
async function loadDashboardData() {
    const periodSelect = document.getElementById('periodSelect');
    const dashboardContent = document.getElementById('dashboardContent');
    const period = periodSelect.value;
    
    // Получаем выбранный временной период (Сегодня, Вчера, Неделя, Месяц, custom)
    const activePeriodBtn = document.querySelector('.period-btn.active');
    let dateRange = activePeriodBtn ? activePeriodBtn.dataset.period : 'today';
    
    // Если выбран кастомный период, используем сохраненные даты
    if (dateRange === 'custom' && customDateRange) {
        dateRange = 'custom';
    } else if (dateRange === 'custom') {
        // Если кастомный период выбран, но даты не заданы, переключаемся на сегодня
        dateRange = 'today';
        const todayBtn = document.querySelector('.period-btn[data-period="today"]');
        if (todayBtn) {
            document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
            todayBtn.classList.add('active');
        }
    }

    // Получаем все выбранные QR коды
    const selectedCheckboxes = document.querySelectorAll('.qr-checkbox:checked');
    const selectedCodes = Array.from(selectedCheckboxes).map(cb => cb.value);

    if (selectedCodes.length === 0) {
        dashboardContent.innerHTML = `
            <div class="dashboard-placeholder">
                <i class="fas fa-chart-area"></i>
                <p>Выберите один или несколько QR кодов для отображения на диаграмме</p>
            </div>
        `;
        
        // Уничтожаем график если есть
        if (dashboardChart) {
            dashboardChart.destroy();
            dashboardChart = null;
        }
        return;
    }

    // Показываем загрузку
    dashboardContent.innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner fa-spin"></i> Загрузка данных для ${selectedCodes.length} QR кодов...
        </div>
    `;

    try {
        // Загружаем данные для всех выбранных QR кодов параллельно
        const promises = selectedCodes.map(shortCode => {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            // Формируем URL с параметрами
            let url = `/api/qr/${shortCode}/timeline?period=${period}&dateRange=${dateRange}&limit=100`;
            if (dateRange === 'custom' && customDateRange) {
                url += `&dateFrom=${customDateRange.from}&dateTo=${customDateRange.to}`;
            }
            
            return fetch(url, {
                signal: controller.signal
            })
                .then(res => {
                    clearTimeout(timeoutId);
                    if (!res.ok) {
                        throw new Error(`HTTP error! status: ${res.status}`);
                    }
                    return res.json();
                })
                .catch(error => {
                    clearTimeout(timeoutId);
                    console.error(`Ошибка загрузки данных для ${shortCode}:`, error);
                    return { error: error.message, shortCode };
                });
        });

        const allData = await Promise.all(promises);

        // Проверяем на ошибки
        const errors = allData.filter(data => data.error);
        if (errors.length > 0) {
            dashboardContent.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Ошибка загрузки данных для некоторых QR кодов</p>
                </div>
            `;
            return;
        }

        // Отображаем дэшборд с графиками для всех выбранных QR кодов
        displayDashboard(allData, period);
    } catch (error) {
        console.error('Ошибка загрузки данных дэшборда:', error);
        dashboardContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Ошибка загрузки данных</p>
            </div>
        `;
    }
}

// Отображение дэшборда с графиками для нескольких QR кодов
function displayDashboard(allData, period) {
    const dashboardContent = document.getElementById('dashboardContent');

    // Проверяем что есть данные
    const hasData = allData.some(data => data.timeline && data.timeline.length > 0);
    
    if (!hasData) {
        dashboardContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-chart-line"></i>
                <p>Нет данных для отображения</p>
                <p style="font-size: 0.875rem; margin-top: 0.5rem; opacity: 0.7;">
                    Сканируйте QR коды, чтобы увидеть статистику
                </p>
            </div>
        `;
        return;
    }

    // Цвета для разных QR кодов
    const colors = [
        { border: 'rgb(99, 102, 241)', background: 'rgba(99, 102, 241, 0.1)' },
        { border: 'rgb(16, 185, 129)', background: 'rgba(16, 185, 129, 0.1)' },
        { border: 'rgb(245, 158, 11)', background: 'rgba(245, 158, 11, 0.1)' },
        { border: 'rgb(239, 68, 68)', background: 'rgba(239, 68, 68, 0.1)' },
        { border: 'rgb(139, 92, 246)', background: 'rgba(139, 92, 246, 0.1)' },
        { border: 'rgb(59, 130, 246)', background: 'rgba(59, 130, 246, 0.1)' },
        { border: 'rgb(236, 72, 153)', background: 'rgba(236, 72, 153, 0.1)' },
        { border: 'rgb(14, 165, 233)', background: 'rgba(14, 165, 233, 0.1)' }
    ];

    // ВАЖНО: Используем dateFrom и dateTo из ответа API для создания полного диапазона
    // Это гарантирует что график покажет весь выбранный период, а не только даты со сканированиями
    let minDate = null;
    let maxDate = null;
    
    // Получаем диапазон дат из первого ответа API (все QR коды используют один период)
    if (allData.length > 0 && allData[0].dateFrom && allData[0].dateTo) {
        minDate = new Date(allData[0].dateFrom);
        maxDate = new Date(allData[0].dateTo);
    } else {
        // Fallback: используем даты из timeline если dateFrom/dateTo не переданы
        allData.forEach(data => {
            if (data.timeline && data.timeline.length > 0) {
                data.timeline.forEach(item => {
                    const date = new Date(item.date);
                    if (!minDate || date < minDate) minDate = new Date(date);
                    if (!maxDate || date > maxDate) maxDate = new Date(date);
                });
            }
        });
    }
    
    // Заполняем пропуски дат для непрерывного графика на основе полного периода
    const sortedDates = [];
    if (minDate && maxDate) {
        let currentDate = new Date(minDate);
        while (currentDate <= maxDate) {
            let key;
            if (period === 'hours') {
                key = currentDate.toISOString().slice(0, 13) + ':00:00.000Z';
                currentDate.setHours(currentDate.getHours() + 1);
            } else if (period === 'weeks') {
                const weekStart = new Date(currentDate);
                weekStart.setDate(currentDate.getDate() - currentDate.getDay());
                weekStart.setHours(0, 0, 0, 0);
                key = weekStart.toISOString().split('T')[0];
                currentDate.setDate(currentDate.getDate() + 7);
            } else {
                key = currentDate.toISOString().split('T')[0];
                currentDate.setDate(currentDate.getDate() + 1);
            }
            sortedDates.push(key);
        }
    }

    // Форматируем даты для подписей
    const labels = sortedDates.map(dateStr => {
        const date = new Date(dateStr);
        if (period === 'hours') {
            return date.toLocaleString('ru-RU', { 
                day: '2-digit', 
                month: '2-digit', 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        } else if (period === 'weeks') {
            return date.toLocaleDateString('ru-RU', { 
                day: '2-digit', 
                month: '2-digit' 
            });
        } else {
            return date.toLocaleDateString('ru-RU', { 
                day: '2-digit', 
                month: '2-digit',
                year: 'numeric'
            });
        }
    });

    // Создаем datasets для каждого QR кода
    const datasets = allData.map((data, index) => {
        const qrCode = data.qrCode;
        const timeline = data.timeline || [];
        
        // Создаем маппинг дата -> количество с нормализацией ключей
        const timelineMap = {};
        if (data.timeline) {
            data.timeline.forEach(item => {
                // Нормализуем ключ даты для правильного сопоставления
                const normalizedKey = normalizeDateKey(item.date, period);
                timelineMap[normalizedKey] = item.count;
            });
        }

        // Создаем массив значений для всех дат
        const counts = sortedDates.map(date => {
            // Нормализуем дату для сравнения
            const normalizedDate = normalizeDateKey(date, period);
            return timelineMap[normalizedDate] || 0;
        });
        const totalScans = counts.reduce((a, b) => a + b, 0);

        const color = colors[index % colors.length];

        return {
            label: `${qrCode.title || 'Без названия'} (${qrCode.short_code})`,
            data: counts,
            borderColor: color.border,
            backgroundColor: color.background,
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointBackgroundColor: color.border,
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            totalScans: totalScans
        };
    });

    // Подсчитываем общую статистику
    const allCounts = datasets.flatMap(d => d.data);
    const totalScans = allCounts.reduce((a, b) => a + b, 0);
    const maxScans = Math.max(...allCounts, 0);
    const avgScans = allCounts.length > 0 ? (totalScans / allCounts.length).toFixed(1) : 0;
    
    // Адаптивный stepSize для оси Y в зависимости от максимального значения
    let yAxisStepSize = 1;
    if (maxScans > 1000) {
        yAxisStepSize = 100;
    } else if (maxScans > 100) {
        yAxisStepSize = 10;
    } else if (maxScans > 50) {
        yAxisStepSize = 5;
    } else if (maxScans > 20) {
        yAxisStepSize = 2;
    }

    // HTML для дэшборда
    let html = `
        <div class="dashboard-header">
            <div class="dashboard-info">
                <h3><i class="fas fa-chart-line"></i> Сравнение ${allData.length} QR кодов</h3>
                <p class="dashboard-meta">
                    <span><i class="fas fa-chart-bar"></i> Всего переходов: ${totalScans}</span>
                </p>
            </div>
            <div class="dashboard-stats">
                <div class="dashboard-stat-item">
                    <div class="stat-value">${totalScans}</div>
                    <div class="stat-label">Всего за период</div>
                </div>
                <div class="dashboard-stat-item">
                    <div class="stat-value">${maxScans}</div>
                    <div class="stat-label">Максимум</div>
                </div>
                <div class="dashboard-stat-item">
                    <div class="stat-value">${avgScans}</div>
                    <div class="stat-label">Среднее</div>
                </div>
            </div>
        </div>

        <div class="chart-container">
            <canvas id="timelineChart"></canvas>
        </div>
    `;

    dashboardContent.innerHTML = html;

    // Уничтожаем предыдущий график если есть
    if (dashboardChart) {
        dashboardChart.destroy();
    }

    // Адаптивные настройки в зависимости от количества точек данных
    const dataPointsCount = labels.length;
    const maxPointsForFullLabels = 30; // Максимум точек для полного отображения всех подписей
    const maxPointsForMediumLabels = 60; // Максимум точек для среднего отображения
    
    // Адаптируем размер точек
    const pointRadius = dataPointsCount > 50 ? 2 : dataPointsCount > 30 ? 2.5 : 3;
    const pointHoverRadius = dataPointsCount > 50 ? 4 : dataPointsCount > 30 ? 4.5 : 5;
    
    // Адаптируем отображение подписей на оси X
    let xAxisTicksConfig = {
        maxRotation: 45,
        minRotation: 45
    };
    
    if (dataPointsCount > maxPointsForFullLabels) {
        // Пропускаем подписи - показываем каждую N-ю
        const skipStep = Math.ceil(dataPointsCount / maxPointsForFullLabels);
        xAxisTicksConfig.callback = function(value, index) {
            // Показываем подпись только для каждого N-го элемента
            if (index % skipStep === 0 || index === labels.length - 1) {
                return labels[index];
            }
            return '';
        };
        xAxisTicksConfig.maxRotation = 60;
        xAxisTicksConfig.minRotation = 60;
    }
    
    // Адаптируем размер шрифта подписей
    const fontSize = dataPointsCount > 50 ? 10 : dataPointsCount > 30 ? 11 : 12;
    
    // Создаем новый график
    const ctx = document.getElementById('timelineChart').getContext('2d');
    dashboardChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets.map(dataset => ({
                ...dataset,
                pointRadius: pointRadius,
                pointHoverRadius: pointHoverRadius
            }))
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        boxWidth: 12,
                        padding: 10,
                        font: {
                            size: fontSize
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y} переходов`;
                        }
                    },
                    titleFont: {
                        size: fontSize
                    },
                    bodyFont: {
                        size: fontSize
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: yAxisStepSize,
                        precision: 0,
                        font: {
                            size: fontSize
                        },
                        // Адаптивное форматирование больших чисел
                        callback: function(value) {
                            if (value >= 1000) {
                                return (value / 1000).toFixed(1) + 'k';
                            }
                            return value;
                        }
                    },
                    title: {
                        display: true,
                        text: 'Количество переходов',
                        font: {
                            size: fontSize + 1
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: period === 'hours' ? 'Время' : period === 'weeks' ? 'Неделя' : 'Дата',
                        font: {
                            size: fontSize + 1
                        }
                    },
                    ticks: {
                        ...xAxisTicksConfig,
                        font: {
                            size: fontSize
                        },
                        autoSkip: dataPointsCount > maxPointsForFullLabels,
                        maxTicksLimit: dataPointsCount > maxPointsForFullLabels ? maxPointsForFullLabels : undefined
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// ==================== НАВИГАЦИЯ И МЕТРИКИ ====================

// Переключение между секциями
function showSection(sectionId) {
    // Скрываем все секции
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Убираем активный класс у всех навигационных элементов
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Показываем выбранную секцию
    const section = document.getElementById(`${sectionId}-section`);
    if (section) {
        section.classList.add('active');
    }
    
    // Активируем соответствующий навигационный элемент
    const navItem = document.querySelector(`a[href="#${sectionId}"]`);
    if (navItem) {
        navItem.classList.add('active');
    }
    
    // Обновляем заголовок страницы
    const titles = {
        'create': 'Создать QR код',
        'dashboard': 'Дэшборд аналитики',
        'list': 'Все QR коды'
    };
    
    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) {
        pageTitle.textContent = titles[sectionId] || 'QR Generator';
    }
    
    // Показываем/скрываем селектор периода
    const periodSelector = document.getElementById('periodSelector');
    if (periodSelector) {
        periodSelector.style.display = sectionId === 'dashboard' ? 'flex' : 'none';
    }
    
    // Загружаем данные для дэшборда если нужно
    if (sectionId === 'dashboard') {
        loadMetrics();
        // Убеждаемся что есть активная кнопка периода
        const activePeriodBtn = document.querySelector('.period-btn.active');
        if (!activePeriodBtn) {
            const todayBtn = document.querySelector('.period-btn[data-period="today"]');
            if (todayBtn) {
                todayBtn.classList.add('active');
            }
        }
        // Загружаем данные дэшборда
        loadDashboard();
        loadDashboardData();
        loadUsersTable();
    }
}

// Обновление текущей секции
function refreshCurrentSection() {
    const activeSection = document.querySelector('.content-section.active');
    if (activeSection) {
        const sectionId = activeSection.id.replace('-section', '');
        if (sectionId === 'list') {
            loadQRList();
        } else if (sectionId === 'dashboard') {
            // Сохраняем выбранные QR коды перед обновлением
            const checkboxes = document.querySelectorAll('.qr-checkbox:checked');
            selectedQRCodes.clear();
            checkboxes.forEach(cb => selectedQRCodes.add(cb.value));
            
            loadDashboard();
            loadDashboardData();
            loadMetrics();
            loadUsersTable(); // Загружаем таблицу пользователей
        }
    }
}

// Загрузка метрик для дэшборда
async function loadMetrics() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch('/api/qr/list', {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const qrCodes = await response.json();
        
        // Подсчитываем метрики
        const totalQR = qrCodes.length;
        const totalScans = qrCodes.reduce((sum, qr) => sum + (qr.total_scans || 0), 0);
        const activeQR = qrCodes.filter(qr => (qr.total_scans || 0) > 0).length;
        const avgScans = totalQR > 0 ? Math.round(totalScans / totalQR) : 0;
        
        // Обновляем карточки метрик
        updateMetricCard('metricTotalQR', totalQR);
        updateMetricCard('metricTotalScans', totalScans);
        updateMetricCard('metricActiveQR', activeQR);
        updateMetricCard('metricAvgScans', avgScans);
        
    } catch (error) {
        console.error('Ошибка загрузки метрик:', error);
        // Оставляем значения по умолчанию
    }
}

// Обновление карточки метрики
function updateMetricCard(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value.toLocaleString('ru-RU');
    }
}

// ==================== КАСТОМНЫЙ ДИАПАЗОН ДАТ ====================

// Показать модальное окно выбора кастомного диапазона дат
function showCustomDateRange() {
    const modal = document.getElementById('customDateRangeModal');
    if (!modal) return;
    
    // Устанавливаем значения по умолчанию (последние 7 дней)
    const dateTo = new Date();
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 6);
    
    document.getElementById('dateFrom').value = dateFrom.toISOString().split('T')[0];
    document.getElementById('dateTo').value = dateTo.toISOString().split('T')[0];
    
    // Если есть сохраненный кастомный диапазон, используем его
    if (customDateRange) {
        document.getElementById('dateFrom').value = customDateRange.from;
        document.getElementById('dateTo').value = customDateRange.to;
    }
    
    modal.style.display = 'block';
}

// Закрыть модальное окно выбора дат
function closeCustomDateRange() {
    const modal = document.getElementById('customDateRangeModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Применить кастомный диапазон дат
function applyCustomDateRange() {
    const dateFrom = document.getElementById('dateFrom').value;
    const dateTo = document.getElementById('dateTo').value;
    
    if (!dateFrom || !dateTo) {
        alert('Пожалуйста, выберите обе даты');
        return;
    }
    
    if (new Date(dateFrom) > new Date(dateTo)) {
        alert('Дата начала не может быть позже даты окончания');
        return;
    }
    
    // Сохраняем кастомный диапазон
    customDateRange = {
        from: dateFrom,
        to: dateTo
    };
    
    // Активируем кнопку кастомного периода
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    const customBtn = document.getElementById('customPeriodBtn');
    if (customBtn) {
        customBtn.classList.add('active');
    }
    
    // Закрываем модальное окно
    closeCustomDateRange();
    
    // Перезагружаем данные
    loadDashboardData();
    // Обновляем фильтр дат в таблице пользователей если он установлен на custom
    const usersDateFilter = document.getElementById('usersDateRangeFilter');
    if (usersDateFilter && usersDateFilter.value === 'custom') {
        loadUsersTable();
    }
}

// Закрытие модального окна при клике вне его
window.addEventListener('click', function(event) {
    const modal = document.getElementById('customDateRangeModal');
    if (event.target === modal) {
        closeCustomDateRange();
    }
});

// ==================== ТАБЛИЦА ПОЛЬЗОВАТЕЛЕЙ ====================

let usersTableSortColumn = null;
let usersTableSortDirection = 'desc';

// Загрузка таблицы пользователей
async function loadUsersTable() {
    const container = document.getElementById('usersTableContainer');
    if (!container) return;
    
    container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Загрузка данных...</div>';
    
    try {
        const qrCodeId = document.getElementById('usersQRFilter')?.value || 'all';
        const dateRange = document.getElementById('usersDateRangeFilter')?.value || 'today';
        const uniqueOnly = document.getElementById('uniqueUsersOnly')?.checked || false;
        
        // Получаем кастомный диапазон дат если выбран
        let url = `/api/users?qrCodeId=${qrCodeId}&dateRange=${dateRange}&uniqueOnly=${uniqueOnly}`;
        if (dateRange === 'custom') {
            if (customDateRange) {
                url += `&dateFrom=${customDateRange.from}&dateTo=${customDateRange.to}`;
            } else {
                // Если кастомный период выбран, но даты не заданы, показываем сообщение
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-calendar-alt"></i>
                        <p>Выберите диапазон дат</p>
                        <button class="btn btn-primary" onclick="showCustomDateRange()">Выбрать период</button>
                    </div>
                `;
                return;
            }
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(url, {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        displayUsersTable(data.users || []);
        
        // Обновляем список QR кодов в фильтре
        updateUsersQRFilter();
        
    } catch (error) {
        if (error.name === 'AbortError') {
            container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Превышено время ожидания</p>
                    <button class="btn btn-primary" onclick="loadUsersTable()">Попробовать снова</button>
                </div>
            `;
        } else {
            console.error('Ошибка загрузки пользователей:', error);
            container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Ошибка загрузки данных</p>
                    <button class="btn btn-primary" onclick="loadUsersTable()">Попробовать снова</button>
                </div>
            `;
        }
    }
}

// Обновление списка QR кодов в фильтре таблицы пользователей
async function updateUsersQRFilter() {
    const filter = document.getElementById('usersQRFilter');
    if (!filter) return;
    
    try {
        const response = await fetch('/api/qr/list');
        if (!response.ok) return;
        
        const qrCodes = await response.json();
        const currentValue = filter.value;
        
        filter.innerHTML = '<option value="all">Все QR коды</option>';
        qrCodes.forEach(qr => {
            const option = document.createElement('option');
            option.value = qr.id;
            option.textContent = `${qr.title || 'Без названия'} (${qr.short_code})`;
            if (qr.id.toString() === currentValue) {
                option.selected = true;
            }
            filter.appendChild(option);
        });
    } catch (error) {
        console.error('Ошибка обновления фильтра QR кодов:', error);
    }
}

// Отображение таблицы пользователей
function displayUsersTable(users) {
    const container = document.getElementById('usersTableContainer');
    if (!container) return;
    
    if (users.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <p>Нет данных для отображения</p>
            </div>
        `;
        return;
    }
    
    let html = `
        <div class="table-responsive">
            <table class="users-table">
                <thead>
                    <tr>
                        <th onclick="sortUsersTable('scan_time')" class="sortable">
                            Дата/Время <i class="fas fa-sort"></i>
                        </th>
                        <th onclick="sortUsersTable('qr_title')" class="sortable">
                            QR код <i class="fas fa-sort"></i>
                        </th>
                        <th onclick="sortUsersTable('scan_count')" class="sortable">
                            Сканирований <i class="fas fa-sort"></i>
                        </th>
                        <th onclick="sortUsersTable('device_type')" class="sortable">
                            Устройство <i class="fas fa-sort"></i>
                        </th>
                        <th onclick="sortUsersTable('browser')" class="sortable">
                            Браузер <i class="fas fa-sort"></i>
                        </th>
                        <th onclick="sortUsersTable('os')" class="sortable">
                            ОС <i class="fas fa-sort"></i>
                        </th>
                        <th onclick="sortUsersTable('country')" class="sortable">
                            Страна <i class="fas fa-sort"></i>
                        </th>
                        <th onclick="sortUsersTable('city')" class="sortable">
                            Город <i class="fas fa-sort"></i>
                        </th>
                        <th>IP адрес</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    users.forEach(user => {
        const scanTime = new Date(user.scan_time);
        const formattedTime = scanTime.toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        html += `
            <tr>
                <td>${formattedTime}</td>
                <td>
                    <strong>${user.qr_title || 'Без названия'}</strong><br>
                    <small style="color: #666;">${user.short_code}</small>
                </td>
                <td>
                    <strong style="color: var(--primary-color);">${user.scan_count || 1}</strong>
                </td>
                <td>
                    <i class="fas fa-${getDeviceIcon(user.device_type)}"></i>
                    ${user.device_type || 'Неизвестно'}
                </td>
                <td>${user.browser || 'Неизвестно'} ${user.browser_version || ''}</td>
                <td>${user.os || 'Неизвестно'} ${user.os_version || ''}</td>
                <td>
                    ${user.country ? `<i class="fas fa-globe"></i> ${user.country}` : 'Неизвестно'}
                </td>
                <td>${user.city || '-'}</td>
                <td><code>${user.ip_address || '-'}</code></td>
            </tr>
        `;
    });
    
    html += `
                </tbody>
            </table>
        </div>
        <div class="table-footer">
            <p>Всего записей: <strong>${users.length}</strong></p>
        </div>
    `;
    
    container.innerHTML = html;
}

// Получить иконку для типа устройства
function getDeviceIcon(deviceType) {
    if (!deviceType) return 'desktop';
    const type = deviceType.toLowerCase();
    if (type.includes('mobile')) return 'mobile-alt';
    if (type.includes('tablet')) return 'tablet-alt';
    return 'desktop';
}

// Сортировка таблицы пользователей
function sortUsersTable(column) {
    if (usersTableSortColumn === column) {
        usersTableSortDirection = usersTableSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        usersTableSortColumn = column;
        usersTableSortDirection = 'asc';
    }
    
    // Перезагружаем таблицу с сортировкой на клиенте
    const container = document.getElementById('usersTableContainer');
    const table = container?.querySelector('.users-table tbody');
    if (!table) return;
    
    const rows = Array.from(table.querySelectorAll('tr'));
    rows.sort((a, b) => {
        const aText = a.querySelector(`td:nth-child(${getColumnIndex(column)})`)?.textContent.trim() || '';
        const bText = b.querySelector(`td:nth-child(${getColumnIndex(column)})`)?.textContent.trim() || '';
        
        // Для даты используем числовое сравнение
        if (column === 'scan_time') {
            const aDate = new Date(aText);
            const bDate = new Date(bText);
            return usersTableSortDirection === 'asc' ? aDate - bDate : bDate - aDate;
        }
        
        // Для количества сканирований используем числовое сравнение
        if (column === 'scan_count') {
            const aNum = parseInt(aText) || 0;
            const bNum = parseInt(bText) || 0;
            return usersTableSortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        }
        
        // Для остальных - текстовое сравнение
        if (usersTableSortDirection === 'asc') {
            return aText.localeCompare(bText, 'ru');
        } else {
            return bText.localeCompare(aText, 'ru');
        }
    });
    
    // Обновляем таблицу
    rows.forEach(row => table.appendChild(row));
    
    // Обновляем иконки сортировки
    document.querySelectorAll('.users-table th.sortable i').forEach(icon => {
        icon.className = 'fas fa-sort';
    });
    const header = document.querySelector(`.users-table th[onclick*="${column}"]`);
    if (header) {
        const icon = header.querySelector('i');
        if (icon) {
            icon.className = usersTableSortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
        }
    }
}

// Получить индекс колонки по названию
function getColumnIndex(column) {
    const columns = ['scan_time', 'qr_title', 'scan_count', 'device_type', 'browser', 'os', 'country', 'city', 'ip_address'];
    return columns.indexOf(column) + 1;
}

// Нормализация ключа даты для сравнения
function normalizeDateKey(dateStr, period) {
    const date = new Date(dateStr);
    if (period === 'hours') {
        return date.toISOString().slice(0, 13) + ':00:00.000Z';
    } else if (period === 'weeks') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return weekStart.toISOString().split('T')[0];
    } else {
        return date.toISOString().split('T')[0];
    }
}

