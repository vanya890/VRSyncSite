// Analytics Modal Component for displaying video view charts
const AnalyticsModal = {
  // Modal elements
  modal: null,
  modalContent: null,
  closeBtn: null,
  chartCanvas: null,
  chart: null,

  // Initialize modal
  init: function() {
    this.createModal();
    this.bindEvents();
  },

  // Create modal HTML structure
  createModal: function() {
    // Create modal container
    this.modal = document.createElement('div');
    this.modal.id = 'analyticsModal';
    this.modal.className = 'analytics-modal';
    this.modal.innerHTML = `
      <div class="analytics-modal-content">
        <div class="analytics-modal-header">
          <h3>Аналитика просмотров</h3>
          <span class="analytics-modal-close">&times;</span>
        </div>
        <div class="analytics-modal-body">
          <div class="analytics-info">
            <div class="analytics-video-title"></div>
            <div class="analytics-total-views"></div>
          </div>
          <div class="analytics-chart-container">
            <canvas id="analyticsChart"></canvas>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);

    // Get references to elements
    this.modalContent = this.modal.querySelector('.analytics-modal-content');
    this.closeBtn = this.modal.querySelector('.analytics-modal-close');
    this.chartCanvas = this.modal.querySelector('#analyticsChart');
  },

  // Bind event listeners
  bindEvents: function() {
    // Close modal when clicking close button
    this.closeBtn.addEventListener('click', () => this.close());

    // Close modal when clicking outside
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });

    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });
  },

  // Show modal with analytics for specific video
  show: function(videoFilename) {
    this.loadAnalytics(videoFilename);
    this.modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
  },

  // Close modal
  close: function() {
    this.modal.style.display = 'none';
    document.body.style.overflow = ''; // Restore scrolling

    // Destroy chart to free memory
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  },

  // Check if modal is open
  isOpen: function() {
    return this.modal.style.display === 'flex';
  },

  // Load analytics data and render chart
  loadAnalytics: function(videoFilename) {
    console.log('[DEBUG] loadAnalytics called with videoFilename:', videoFilename);

    // Show loading state
    const bodyElement = this.modal.querySelector('.analytics-modal-body');
    console.log('[DEBUG] Setting loading state, bodyElement found:', !!bodyElement);
    bodyElement.innerHTML = `
      <div class="analytics-loading">
        <p>Загрузка аналитики...</p>
      </div>
    `;

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('[DEBUG] Fetch timeout triggered after 10 seconds');
      controller.abort();
    }, 10000); // 10 second timeout

    const fetchUrl = `/analytics/${encodeURIComponent(videoFilename)}`;
    console.log('[DEBUG] Starting fetch to URL:', fetchUrl);

    fetch(fetchUrl, {
      signal: controller.signal
    })
    .then(response => {
      console.log('[DEBUG] Fetch response received, status:', response.status, 'ok:', response.ok);
      clearTimeout(timeoutId);
      if (!response.ok) {
        console.log('[DEBUG] Response not ok, throwing error');
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      console.log('[DEBUG] Response ok, parsing JSON');
      return response.json();
    })
    .then(data => {
      console.log('[DEBUG] JSON parsed successfully, data:', data);
      this.renderAnalytics(data);
    })
    .catch(error => {
      console.log('[DEBUG] Fetch error caught:', error.name, error.message);
      clearTimeout(timeoutId);
      console.error('Error loading analytics:', error);

      let errorMessage = 'Ошибка загрузки аналитики';
      if (error.name === 'AbortError') {
        errorMessage = 'Превышено время ожидания. Попробуйте снова.';
      } else if (error.message) {
        errorMessage += ': ' + error.message;
      }

      this.showError(errorMessage);
    });
  },

  // Render analytics data and chart
  renderAnalytics: function(data) {
    console.log('[DEBUG] renderAnalytics called with data:', data);
    try {
      // Recreate the full modal body structure
      const bodyElement = this.modal.querySelector('.analytics-modal-body');
      bodyElement.innerHTML = `
        <div class="analytics-info">
          <div class="analytics-video-title">Видео: ${data.video}</div>
          <div class="analytics-total-views">Всего просмотров: ${data.totalViews}</div>
        </div>
        <div class="analytics-chart-container">
          <canvas id="analyticsChart"></canvas>
        </div>
      `;

      // Update chart canvas reference
      this.chartCanvas = this.modal.querySelector('#analyticsChart');

      console.log('[DEBUG] Modal structure recreated, chart canvas updated');

      // Check if Chart.js is loaded
      console.log('[DEBUG] Checking Chart.js availability, typeof Chart:', typeof Chart);
      if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded');
        this.showError('Chart.js не загружен. Попробуйте обновить страницу.');
        return;
      }
      console.log('[DEBUG] Chart.js is available');

      // Check if we have data
      console.log('[DEBUG] Checking data.dailyViews:', data.dailyViews, 'keys length:', data.dailyViews ? Object.keys(data.dailyViews).length : 'N/A');
      if (!data.dailyViews || Object.keys(data.dailyViews).length === 0) {
        console.log('[DEBUG] No daily views data, showing error');
        this.showError('Нет данных для отображения графика.');
        return;
      }

      // Prepare chart data
      const dates = Object.keys(data.dailyViews).sort();
      const views = dates.map(date => data.dailyViews[date]);
      console.log('[DEBUG] Prepared chart data - dates:', dates, 'views:', views);

      // Format dates for display
      const formattedDates = dates.map(date => {
        try {
          const d = new Date(date);
          return d.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
        } catch (e) {
          console.warn('Error formatting date:', date, e);
          return date; // Fallback to original date
        }
      });
      console.log('[DEBUG] Formatted dates:', formattedDates);

      // Destroy existing chart
      if (this.chart) {
        console.log('[DEBUG] Destroying existing chart');
        try {
          this.chart.destroy();
        } catch (e) {
          console.warn('Error destroying chart:', e);
        }
        this.chart = null;
      }

      // Create new chart
      console.log('[DEBUG] Creating new chart with canvas:', this.chartCanvas);
      this.chart = new Chart(this.chartCanvas, {
        type: 'line',
        data: {
          labels: formattedDates,
          datasets: [{
            label: 'Просмотры',
            data: views,
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#667eea',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: '#fff',
              bodyColor: '#fff',
              cornerRadius: 6,
              displayColors: false
            }
          },
          scales: {
            x: {
              grid: {
                display: false
              },
              ticks: {
                maxTicksLimit: 7
              }
            },
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(0, 0, 0, 0.1)'
              },
              ticks: {
                stepSize: 1
              }
            }
          },
          interaction: {
            intersect: false,
            mode: 'index'
          }
        }
      });
      console.log('[DEBUG] Chart created successfully');

    } catch (error) {
      console.error('[DEBUG] Error in renderAnalytics:', error);
      console.error('Error rendering analytics:', error);
      this.showError('Ошибка отображения аналитики: ' + error.message);
    }
  },

  // Show error message
  showError: function(message) {
    const bodyElement = this.modal.querySelector('.analytics-modal-body');
    bodyElement.innerHTML = `
      <div class="analytics-error">
        <p>${message}</p>
      </div>
    `;
  }
};

// Initialize modal when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  AnalyticsModal.init();
});
