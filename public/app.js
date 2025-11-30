// Глобальные переменные
let currentQRCode = null;
let dashboardChart = null; // Chart.js instance

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
            // Здесь можно добавить логику фильтрации по периоду
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
            checkbox.addEventListener('change', loadDashboardData);
            
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

        // Если есть QR коды, выбираем первый по умолчанию
        if (qrCodes.length > 0) {
            const firstCheckbox = document.getElementById(`qr-${qrCodes[0].short_code}`);
            if (firstCheckbox) {
                firstCheckbox.checked = true;
                loadDashboardData();
            }
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

// Загрузка данных для дэшборда (для нескольких QR кодов)
async function loadDashboardData() {
    const periodSelect = document.getElementById('periodSelect');
    const dashboardContent = document.getElementById('dashboardContent');
    const period = periodSelect.value;

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
            
            return fetch(`/api/qr/${shortCode}/timeline?period=${period}&limit=100`, {
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

    // Собираем все уникальные даты из всех timeline
    const allDates = new Set();
    allData.forEach(data => {
        if (data.timeline) {
            data.timeline.forEach(item => allDates.add(item.date));
        }
    });
    
    const sortedDates = Array.from(allDates).sort((a, b) => new Date(a) - new Date(b));

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
        
        // Создаем маппинг дата -> количество
        const timelineMap = {};
        timeline.forEach(item => {
            timelineMap[item.date] = item.count;
        });

        // Создаем массив значений для всех дат
        const counts = sortedDates.map(date => timelineMap[date] || 0);
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

    // Создаем новый график
    const ctx = document.getElementById('timelineChart').getContext('2d');
    dashboardChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y} переходов`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        precision: 0
                    },
                    title: {
                        display: true,
                        text: 'Количество переходов'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: period === 'hours' ? 'Время' : period === 'weeks' ? 'Неделя' : 'Дата'
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
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
            loadDashboard();
            loadDashboardData();
            loadMetrics();
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

