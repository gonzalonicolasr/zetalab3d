/* ==============================
   ZETALAB Admin Charts
   Advanced data visualization with Chart.js
============================== */

class AdminCharts {
  constructor() {
    this.charts = new Map();
    this.chartData = new Map();
    this.defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#b9c7bf',
            font: {
              family: "'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace"
            }
          }
        },
        tooltip: {
          backgroundColor: '#13251f',
          titleColor: '#e8efe9',
          bodyColor: '#b9c7bf',
          borderColor: '#385f4d',
          borderWidth: 1
        }
      },
      scales: {
        y: {
          ticks: {
            color: '#b9c7bf',
            font: {
              family: "'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace"
            }
          },
          grid: {
            color: '#385f4d'
          }
        },
        x: {
          ticks: {
            color: '#b9c7bf',
            font: {
              family: "'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace"
            }
          },
          grid: {
            color: '#385f4d'
          }
        }
      }
    };
  }

  // Initialize all charts
  init() {
    console.log('Initializing Admin Charts...');
    
    if (typeof Chart === 'undefined') {
      console.error('Chart.js not loaded');
      return;
    }

    // Set global Chart.js defaults for ZETALAB theme
    this.setChartDefaults();
    
    // Initialize dashboard charts
    this.initDashboardCharts();
  }

  setChartDefaults() {
    Chart.defaults.font.family = "'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace";
    Chart.defaults.color = '#b9c7bf';
    Chart.defaults.borderColor = '#385f4d';
    Chart.defaults.backgroundColor = '#13251f';
  }

  // Dashboard Charts
  initDashboardCharts() {
    this.initUserGrowthChart();
    this.initSubscriptionDistributionChart();
    this.initRevenueChart();
    this.initActivityChart();
  }

  async initUserGrowthChart() {
    const canvas = document.getElementById('userGrowthChart');
    if (!canvas) return;

    try {
      const data = await this.generateUserGrowthData();
      
      const config = {
        type: 'line',
        data: {
          labels: data.labels,
          datasets: [{
            label: 'Usuarios Nuevos',
            data: data.values,
            borderColor: ADMIN_CONFIG.CHART_COLORS.primary,
            backgroundColor: this.addAlpha(ADMIN_CONFIG.CHART_COLORS.primary, 0.1),
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: ADMIN_CONFIG.CHART_COLORS.primary,
            pointBorderColor: '#e8efe9',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6
          }]
        },
        options: {
          ...this.defaultOptions,
          plugins: {
            ...this.defaultOptions.plugins,
            legend: {
              display: false
            },
            tooltip: {
              ...this.defaultOptions.plugins.tooltip,
              callbacks: {
                title: (items) => `Fecha: ${items[0].label}`,
                label: (item) => `Nuevos usuarios: ${item.parsed.y}`
              }
            }
          },
          scales: {
            ...this.defaultOptions.scales,
            y: {
              ...this.defaultOptions.scales.y,
              beginAtZero: true,
              title: {
                display: true,
                text: 'Usuarios',
                color: '#b9c7bf'
              }
            },
            x: {
              ...this.defaultOptions.scales.x,
              title: {
                display: true,
                text: 'Fecha',
                color: '#b9c7bf'
              }
            }
          },
          interaction: {
            intersect: false,
            mode: 'index'
          }
        }
      };

      this.charts.set('userGrowth', new Chart(canvas, config));
      this.chartData.set('userGrowth', data);

    } catch (error) {
      console.error('Error creating user growth chart:', error);
    }
  }

  async initSubscriptionDistributionChart() {
    const canvas = document.getElementById('subscriptionChart');
    if (!canvas) return;

    try {
      const data = await this.generateSubscriptionData();
      
      const config = {
        type: 'doughnut',
        data: {
          labels: data.labels,
          datasets: [{
            data: data.values,
            backgroundColor: [
              ADMIN_CONFIG.CHART_COLORS.primary,
              ADMIN_CONFIG.CHART_COLORS.secondary,
              ADMIN_CONFIG.CHART_COLORS.warning,
              ADMIN_CONFIG.CHART_COLORS.error
            ],
            borderWidth: 0,
            hoverBorderWidth: 2,
            hoverBorderColor: '#e8efe9'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: '#b9c7bf',
                padding: 20,
                usePointStyle: true,
                font: {
                  family: "'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace",
                  size: 12
                }
              }
            },
            tooltip: {
              ...this.defaultOptions.plugins.tooltip,
              callbacks: {
                label: (item) => {
                  const total = item.dataset.data.reduce((sum, value) => sum + value, 0);
                  const percentage = ((item.parsed / total) * 100).toFixed(1);
                  return `${item.label}: ${item.parsed} (${percentage}%)`;
                }
              }
            }
          },
          cutout: '60%',
          layout: {
            padding: 10
          }
        }
      };

      this.charts.set('subscription', new Chart(canvas, config));
      this.chartData.set('subscription', data);

    } catch (error) {
      console.error('Error creating subscription chart:', error);
    }
  }

  async initRevenueChart() {
    const canvas = document.getElementById('revenueChart');
    if (!canvas) return;

    try {
      const data = await this.generateRevenueData();
      
      const config = {
        type: 'bar',
        data: {
          labels: data.labels,
          datasets: [{
            label: 'Ingresos Mensuales',
            data: data.values,
            backgroundColor: this.addAlpha(ADMIN_CONFIG.CHART_COLORS.secondary, 0.8),
            borderColor: ADMIN_CONFIG.CHART_COLORS.secondary,
            borderWidth: 2,
            borderRadius: 6,
            borderSkipped: false
          }]
        },
        options: {
          ...this.defaultOptions,
          plugins: {
            ...this.defaultOptions.plugins,
            legend: {
              display: false
            },
            tooltip: {
              ...this.defaultOptions.plugins.tooltip,
              callbacks: {
                label: (item) => `Ingresos: ${AdminUtils.formatCurrency(item.parsed.y)}`
              }
            }
          },
          scales: {
            ...this.defaultOptions.scales,
            y: {
              ...this.defaultOptions.scales.y,
              beginAtZero: true,
              title: {
                display: true,
                text: 'Ingresos (ARS)',
                color: '#b9c7bf'
              },
              ticks: {
                ...this.defaultOptions.scales.y.ticks,
                callback: (value) => AdminUtils.formatCurrency(value)
              }
            }
          }
        }
      };

      this.charts.set('revenue', new Chart(canvas, config));
      this.chartData.set('revenue', data);

    } catch (error) {
      console.error('Error creating revenue chart:', error);
    }
  }

  async initActivityChart() {
    const canvas = document.getElementById('activityChart');
    if (!canvas) return;

    try {
      const data = await this.generateActivityData();
      
      const config = {
        type: 'line',
        data: {
          labels: data.labels,
          datasets: [
            {
              label: 'Piezas Creadas',
              data: data.pieces,
              borderColor: ADMIN_CONFIG.CHART_COLORS.primary,
              backgroundColor: this.addAlpha(ADMIN_CONFIG.CHART_COLORS.primary, 0.1),
              borderWidth: 2,
              fill: false,
              tension: 0.4
            },
            {
              label: 'Usuarios Activos',
              data: data.users,
              borderColor: ADMIN_CONFIG.CHART_COLORS.info,
              backgroundColor: this.addAlpha(ADMIN_CONFIG.CHART_COLORS.info, 0.1),
              borderWidth: 2,
              fill: false,
              tension: 0.4
            }
          ]
        },
        options: {
          ...this.defaultOptions,
          plugins: {
            ...this.defaultOptions.plugins,
            legend: {
              ...this.defaultOptions.plugins.legend,
              position: 'top'
            }
          },
          scales: {
            ...this.defaultOptions.scales,
            y: {
              ...this.defaultOptions.scales.y,
              beginAtZero: true,
              title: {
                display: true,
                text: 'Cantidad',
                color: '#b9c7bf'
              }
            }
          }
        }
      };

      this.charts.set('activity', new Chart(canvas, config));
      this.chartData.set('activity', data);

    } catch (error) {
      console.error('Error creating activity chart:', error);
    }
  }

  // Data generation methods
  async generateUserGrowthData() {
    try {
      // Get actual user data from Supabase
      const { data: users, error } = await supabaseAdmin
        .from('pieces') // Using pieces as proxy for user activity
        .select('user_id, created_at')
        .not('user_id', 'is', null)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching user data for chart:', error);
        return this.generateMockUserGrowthData();
      }

      // Process data by day for the last 30 days
      const days = 30;
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - days);

      const dailyCounts = new Map();
      const usersSeen = new Set();

      // Initialize all days with 0
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateKey = date.toISOString().split('T')[0];
        dailyCounts.set(dateKey, 0);
      }

      // Count new users by day
      users.forEach(user => {
        const date = new Date(user.created_at);
        if (date >= startDate && date <= endDate) {
          if (!usersSeen.has(user.user_id)) {
            usersSeen.add(user.user_id);
            const dateKey = date.toISOString().split('T')[0];
            if (dailyCounts.has(dateKey)) {
              dailyCounts.set(dateKey, dailyCounts.get(dateKey) + 1);
            }
          }
        }
      });

      const labels = Array.from(dailyCounts.keys()).map(dateKey => {
        const date = new Date(dateKey);
        return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
      });

      const values = Array.from(dailyCounts.values());

      return { labels, values };

    } catch (error) {
      console.error('Error generating user growth data:', error);
      return this.generateMockUserGrowthData();
    }
  }

  generateMockUserGrowthData() {
    const days = 30;
    const labels = [];
    const values = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }));
      
      // Generate realistic growth pattern
      const baseValue = 5;
      const randomVariation = Math.floor(Math.random() * 10) - 2;
      const weekendFactor = (date.getDay() === 0 || date.getDay() === 6) ? 0.5 : 1;
      values.push(Math.max(0, Math.floor((baseValue + randomVariation) * weekendFactor)));
    }

    return { labels, values };
  }

  async generateSubscriptionData() {
    try {
      // Try to get actual subscription data
      const { data: subscriptions, error } = await supabaseAdmin
        .from('subscriptions')
        .select('type, status')
        .eq('status', 'active');

      if (error) {
        console.log('Subscriptions table not available, using mock data');
        return this.generateMockSubscriptionData();
      }

      const counts = {
        premium: 0,
        basic: 0,
        trial: 0,
        free: 0
      };

      subscriptions.forEach(sub => {
        if (counts.hasOwnProperty(sub.type)) {
          counts[sub.type]++;
        } else {
          counts.free++;
        }
      });

      return {
        labels: ['Premium', 'Básico', 'Prueba', 'Gratuito'],
        values: [counts.premium, counts.basic, counts.trial, counts.free]
      };

    } catch (error) {
      console.error('Error generating subscription data:', error);
      return this.generateMockSubscriptionData();
    }
  }

  generateMockSubscriptionData() {
    return {
      labels: ['Premium', 'Básico', 'Prueba', 'Gratuito'],
      values: [15, 35, 25, 125] // Mock data
    };
  }

  async generateRevenueData() {
    // This would integrate with your actual billing system
    // For now, generate mock data based on subscription estimates
    const months = 6;
    const labels = [];
    const values = [];
    const today = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setMonth(date.getMonth() - i);
      labels.push(date.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }));
      
      // Mock revenue calculation
      const baseRevenue = 50000; // Base ARS per month
      const growth = (months - i) * 5000; // Growing revenue
      const randomVariation = (Math.random() - 0.5) * 10000;
      values.push(Math.max(0, baseRevenue + growth + randomVariation));
    }

    return { labels, values };
  }

  async generateActivityData() {
    try {
      const days = 14;
      const labels = [];
      const pieces = [];
      const users = [];
      const today = new Date();

      // Get piece creation data
      const { data: piecesData, error: piecesError } = await supabaseAdmin
        .from('pieces')
        .select('created_at, user_id')
        .gte('created_at', new Date(today.getTime() - days * 24 * 60 * 60 * 1000).toISOString());

      if (piecesError) {
        console.error('Error fetching pieces data:', piecesError);
      }

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().split('T')[0];
        
        labels.push(date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }));
        
        if (piecesData) {
          const dayPieces = piecesData.filter(p => 
            p.created_at.startsWith(dateKey)
          );
          pieces.push(dayPieces.length);
          
          const uniqueUsers = new Set(dayPieces.map(p => p.user_id));
          users.push(uniqueUsers.size);
        } else {
          // Fallback mock data
          pieces.push(Math.floor(Math.random() * 10) + 2);
          users.push(Math.floor(Math.random() * 5) + 1);
        }
      }

      return { labels, pieces, users };

    } catch (error) {
      console.error('Error generating activity data:', error);
      return this.generateMockActivityData();
    }
  }

  generateMockActivityData() {
    const days = 14;
    const labels = [];
    const pieces = [];
    const users = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }));
      pieces.push(Math.floor(Math.random() * 10) + 2);
      users.push(Math.floor(Math.random() * 5) + 1);
    }

    return { labels, pieces, users };
  }

  // Utility methods
  addAlpha(color, alpha) {
    // Convert hex color to rgba
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Update chart data
  async updateChart(chartName) {
    const chart = this.charts.get(chartName);
    if (!chart) return;

    try {
      let newData;
      switch (chartName) {
        case 'userGrowth':
          newData = await this.generateUserGrowthData();
          break;
        case 'subscription':
          newData = await this.generateSubscriptionData();
          break;
        case 'revenue':
          newData = await this.generateRevenueData();
          break;
        case 'activity':
          newData = await this.generateActivityData();
          break;
        default:
          return;
      }

      // Update chart data
      if (chartName === 'activity') {
        chart.data.labels = newData.labels;
        chart.data.datasets[0].data = newData.pieces;
        chart.data.datasets[1].data = newData.users;
      } else {
        chart.data.labels = newData.labels;
        chart.data.datasets[0].data = newData.values;
      }

      chart.update('active');
      this.chartData.set(chartName, newData);

    } catch (error) {
      console.error(`Error updating ${chartName} chart:`, error);
    }
  }

  // Update all charts
  async updateAllCharts() {
    const updatePromises = Array.from(this.charts.keys()).map(chartName => 
      this.updateChart(chartName)
    );
    
    await Promise.allSettled(updatePromises);
  }

  // Destroy all charts
  destroy() {
    this.charts.forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });
    this.charts.clear();
    this.chartData.clear();
  }

  // Get chart data for export
  getChartData(chartName) {
    return this.chartData.get(chartName);
  }

  // Export chart as image
  exportChart(chartName, filename) {
    const chart = this.charts.get(chartName);
    if (!chart) return;

    const url = chart.toBase64Image();
    const link = document.createElement('a');
    link.download = `${filename || chartName}.png`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    AdminUtils.showToast('Gráfico exportado correctamente', 'success');
  }
}

// Export for use in other modules
window.AdminCharts = new AdminCharts();