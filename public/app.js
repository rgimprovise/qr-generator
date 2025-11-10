// Глобальные переменные
let currentQRCode = null;

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    loadQRList();
    
    // Обработчик формы создания QR кода
    document.getElementById('createForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await createQRCode();
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
            
            // Обновление списка
            loadQRList();
            
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
    qrListDiv.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Загрузка...</div>';

    try {
        const response = await fetch('/api/qr/list');
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
        qrListDiv.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Ошибка загрузки данных</p>
            </div>
        `;
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
            
            // Скрыть результат, если он был отображен
            if (currentQRCode && currentQRCode.shortCode === shortCode) {
                document.getElementById('result').style.display = 'none';
                currentQRCode = null;
            }
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

