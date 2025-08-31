/* ==============================
   ZETALAB Admin Dashboard
   Main dashboard with statistics and activity
============================== */

class AdminDashboard {
  constructor() {
    this.stats = {
      totalUsers: 0,
      activeSubscriptions: 0,
      totalPieces: 0,
      monthlyRevenue: 0
    };
    
    this.charts = {};
    this.refreshInterval = null;
  }

  async init() {
    console.log('Initializing Admin Dashboard...');
    
    // Load initial data
    await this.loadDashboardData();
    
    // Initialize charts
    this.initializeCharts();
    
    // Bind events
    this.bindEvents();
    
    // Set up auto-refresh
    this.setupAutoRefresh();
  }

  bindEvents() {
    // Refresh button
    document.getElementById('refreshDashboard')?.addEventListener('click', () => {
      this.refreshDashboard();
    });

    // Navigation events
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const section = e.target.closest('.nav-item').dataset.section;
        this.switchSection(section);
      });
    });
  }

  async loadDashboardData() {
    try {
      AdminUtils.showLoading();
      
      // Load all dashboard data in parallel
      const [usersData, subscriptionsData, piecesData, revenueData] = await Promise.all([
        this.loadUsersStats(),
        this.loadSubscriptionsStats(),
        this.loadPiecesStats(),
        this.loadRevenueStats()
      ]);

      // Update stats cards
      this.updateStatsCards();
      
      // Load recent activity
      await this.loadRecentActivity();
      
      // Update navigation counts
      this.updateNavigationCounts();

    } catch (error) {
      AdminErrorHandler.handle(error, 'loading dashboard data');
    } finally {
      AdminUtils.hideLoading();
    }
  }

  async loadUsersStats() {
    try {
      // Get total users count
      const { count: totalUsers, error: usersError } = await supabaseAdmin
        .from('auth.users')
        .select('*', { count: 'exact', head: true });

      if (usersError) {
        console.error('Error loading users stats:', usersError);
        // Fallback: try to get from a view or custom query
        return await this.loadUsersStatsFallback();
      }

      this.stats.totalUsers = totalUsers || 0;

      // Get users growth (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const { count: weeklyGrowth, error: growthError } = await supabaseAdmin
        .from('auth.users')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', weekAgo.toISOString());

      if (!growthError) {
        this.stats.userGrowth = weeklyGrowth || 0;
      }

      return this.stats.totalUsers;
    } catch (error) {
      console.error('Error loading users stats:', error);
      return await this.loadUsersStatsFallback();
    }
  }

  async loadUsersStatsFallback() {
    try {
      // Alternative method: count from pieces table (users who created pieces)
      const { data, error } = await supabaseAdmin
        .from('pieces')
        .select('user_id')
        .not('user_id', 'is', null);

      if (error) {
        console.error('Fallback users stats error:', error);
        return 0;
      }

      // Count unique users
      const uniqueUsers = new Set(data.map(p => p.user_id));
      this.stats.totalUsers = uniqueUsers.size;
      
      return this.stats.totalUsers;
    } catch (error) {
      console.error('Fallback users stats error:', error);
      return 0;
    }
  }

  async loadSubscriptionsStats() {
    try {
      // Note: This assumes you have a subscriptions table
      // If not, this will be estimated from user metadata or other sources
      
      const { data, error } = await supabaseAdmin
        .from('subscriptions')
        .select('status, type, created_at, expires_at');

      if (error && error.code !== 'PGRST101') { // Table doesn't exist
        console.error('Error loading subscriptions:', error);
        // Fallback: estimate from user count
        this.stats.activeSubscriptions = Math.floor(this.stats.totalUsers * 0.1); // Estimate 10% conversion
        return this.stats.activeSubscriptions;
      }

      if (data) {
        // Count active subscriptions
        const now = new Date();
        this.stats.activeSubscriptions = data.filter(sub => 
          sub.status === 'active' && 
          (!sub.expires_at || new Date(sub.expires_at) > now)
        ).length;

        // Count monthly growth
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        
        this.stats.subscriptionGrowth = data.filter(sub => 
          new Date(sub.created_at) > monthAgo
        ).length;
      }

      return this.stats.activeSubscriptions;
    } catch (error) {
      console.error('Error loading subscription stats:', error);
      this.stats.activeSubscriptions = 0;
      return 0;
    }
  }

  async loadPiecesStats() {
    try {
      const { count: totalPieces, error } = await supabaseAdmin
        .from('pieces')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error('Error loading pieces stats:', error);
        return 0;
      }

      this.stats.totalPieces = totalPieces || 0;

      // Get pieces created today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count: todayPieces, error: todayError } = await supabaseAdmin
        .from('pieces')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString());

      if (!todayError) {
        this.stats.piecesToday = todayPieces || 0;
      }

      return this.stats.totalPieces;
    } catch (error) {
      console.error('Error loading pieces stats:', error);
      return 0;
    }
  }

  async loadRevenueStats() {
    try {
      // This is a placeholder - implement based on your billing system
      // Could integrate with Stripe, MercadoPago, etc.
      
      // For now, estimate based on subscriptions
      const estimatedMonthlyRevenue = this.stats.activeSubscriptions * 2000; // $2000 ARS per subscription
      this.stats.monthlyRevenue = estimatedMonthlyRevenue;

      return this.stats.monthlyRevenue;
    } catch (error) {
      console.error('Error loading revenue stats:', error);
      return 0;
    }
  }

  updateStatsCards() {
    // Update total users
    const totalUsersEl = document.getElementById('totalUsers');
    if (totalUsersEl) {
      totalUsersEl.textContent = AdminUtils.formatNumber(this.stats.totalUsers);
    }

    // Update user growth
    const userGrowthEl = document.getElementById('userGrowth');
    if (userGrowthEl && this.stats.userGrowth !== undefined) {
      userGrowthEl.textContent = `+${this.stats.userGrowth} esta semana`;
    }

    // Update active subscriptions
    const activeSubsEl = document.getElementById('activeSubscriptions');
    if (activeSubsEl) {
      activeSubsEl.textContent = AdminUtils.formatNumber(this.stats.activeSubscriptions);
    }

    // Update subscription growth
    const subGrowthEl = document.getElementById('subGrowth');
    if (subGrowthEl && this.stats.subscriptionGrowth !== undefined) {
      subGrowthEl.textContent = `+${this.stats.subscriptionGrowth} este mes`;
    }

    // Update total pieces
    const totalPiecesEl = document.getElementById('totalPieces');
    if (totalPiecesEl) {
      totalPiecesEl.textContent = AdminUtils.formatNumber(this.stats.totalPieces);
    }

    // Update pieces today
    const pieceGrowthEl = document.getElementById('pieceGrowth');
    if (pieceGrowthEl && this.stats.piecesToday !== undefined) {
      pieceGrowthEl.textContent = `+${this.stats.piecesToday} hoy`;
    }

    // Update monthly revenue
    const monthlyRevenueEl = document.getElementById('monthlyRevenue');
    if (monthlyRevenueEl) {
      monthlyRevenueEl.textContent = AdminUtils.formatCurrency(this.stats.monthlyRevenue);
    }
  }

  updateNavigationCounts() {
    // Update navigation counters
    const userCountEl = document.getElementById('userCount');
    if (userCountEl) {
      userCountEl.textContent = this.stats.totalUsers.toString();
    }

    const subCountEl = document.getElementById('subCount');
    if (subCountEl) {
      subCountEl.textContent = this.stats.activeSubscriptions.toString();
    }

    const pieceCountEl = document.getElementById('pieceCount');
    if (pieceCountEl) {
      pieceCountEl.textContent = this.stats.totalPieces.toString();
    }
  }

  async loadRecentActivity() {
    try {
      const activities = [];

      // Get recent user registrations
      const { data: recentUsers, error: usersError } = await supabaseAdmin
        .from('auth.users')
        .select('email, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (!usersError && recentUsers) {
        recentUsers.forEach(user => {
          activities.push({
            type: 'user_registration',
            title: 'Nuevo usuario registrado',
            description: user.email,
            time: user.created_at,
            icon: '👤'
          });
        });
      }

      // Get recent pieces
      const { data: recentPieces, error: piecesError } = await supabaseAdmin
        .from('pieces')
        .select('name, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(5);

      if (!piecesError && recentPieces) {
        recentPieces.forEach(piece => {
          activities.push({
            type: 'piece_created',
            title: 'Nueva pieza creada',
            description: piece.name || 'Sin nombre',
            time: piece.created_at,
            icon: '🔧'
          });
        });
      }

      // Sort by time and take latest 10
      activities.sort((a, b) => new Date(b.time) - new Date(a.time));
      const latestActivities = activities.slice(0, 10);

      this.renderRecentActivity(latestActivities);

    } catch (error) {
      console.error('Error loading recent activity:', error);
      this.renderRecentActivity([]);
    }
  }

  renderRecentActivity(activities) {
    const activityList = document.getElementById('recentActivity');
    if (!activityList) return;

    if (activities.length === 0) {
      activityList.innerHTML = `
        <div class="activity-item">
          <div class="activity-icon">📊</div>
          <div class="activity-content">
            <div class="activity-title">Sin actividad reciente</div>
            <div class="activity-description">No hay actividad para mostrar</div>
          </div>
          <div class="activity-time">-</div>
        </div>
      `;
      return;
    }

    const activityHtml = activities.map(activity => `
      <div class="activity-item fade-in">
        <div class="activity-icon">${activity.icon}</div>
        <div class="activity-content">
          <div class="activity-title">${activity.title}</div>
          <div class="activity-description">${activity.description}</div>
        </div>
        <div class="activity-time">${AdminUtils.getRelativeTime(activity.time)}</div>
      </div>
    `).join('');

    activityList.innerHTML = activityHtml;
  }

  initializeCharts() {
    // Initialize charts when Chart.js is available
    if (typeof Chart !== 'undefined') {
      this.initUserGrowthChart();
      this.initSubscriptionChart();
    } else {
      console.warn('Chart.js not available, charts will not be displayed');
    }
  }

  initUserGrowthChart() {
    const canvas = document.getElementById('userGrowthChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Generate sample data for the last 30 days
    const days = 30;
    const labels = [];
    const data = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }));
      
      // Generate realistic growth data
      const baseGrowth = Math.floor(this.stats.totalUsers / days);
      const randomVariation = Math.floor(Math.random() * baseGrowth * 0.5);
      data.push(baseGrowth + randomVariation);
    }

    this.charts.userGrowth = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Nuevos Usuarios',
          data: data,
          borderColor: ADMIN_CONFIG.CHART_COLORS.primary,
          backgroundColor: ADMIN_CONFIG.CHART_COLORS.primary + '20',
          borderWidth: 2,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: '#b9c7bf'
            },
            grid: {
              color: '#385f4d'
            }
          },
          x: {
            ticks: {
              color: '#b9c7bf'
            },
            grid: {
              color: '#385f4d'
            }
          }
        }
      }
    });
  }

  initSubscriptionChart() {
    const canvas = document.getElementById('subscriptionChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Sample subscription distribution data
    const subscriptionData = {
      premium: Math.floor(this.stats.activeSubscriptions * 0.3),
      basic: Math.floor(this.stats.activeSubscriptions * 0.4),
      trial: Math.floor(this.stats.activeSubscriptions * 0.3)
    };

    this.charts.subscription = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Premium', 'Básico', 'Prueba'],
        datasets: [{
          data: [subscriptionData.premium, subscriptionData.basic, subscriptionData.trial],
          backgroundColor: [
            ADMIN_CONFIG.CHART_COLORS.primary,
            ADMIN_CONFIG.CHART_COLORS.secondary,
            ADMIN_CONFIG.CHART_COLORS.warning
          ],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#b9c7bf'
            }
          }
        }
      }
    });
  }

  switchSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(section => {
      section.classList.remove('active');
    });

    // Remove active class from all nav items
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });

    // Show selected section
    const selectedSection = document.getElementById(sectionName);
    if (selectedSection) {
      selectedSection.classList.add('active');
    }

    // Add active class to selected nav item
    const selectedNavItem = document.querySelector(`[data-section="${sectionName}"]`);
    if (selectedNavItem) {
      selectedNavItem.classList.add('active');
    }

    // Initialize section-specific functionality
    if (sectionName === 'users' && window.AdminUsers) {
      window.AdminUsers.init();
    }
  }

  async refreshDashboard() {
    const refreshBtn = document.getElementById('refreshDashboard');
    const refreshIcon = refreshBtn?.querySelector('.refresh-icon');
    
    if (refreshIcon) {
      refreshIcon.style.transform = 'rotate(360deg)';
    }

    await this.loadDashboardData();

    // Update charts with new data
    if (this.charts.userGrowth) {
      this.charts.userGrowth.update();
    }
    if (this.charts.subscription) {
      this.charts.subscription.update();
    }

    AdminUtils.showToast('Dashboard actualizado', 'success');

    setTimeout(() => {
      if (refreshIcon) {
        refreshIcon.style.transform = 'rotate(0deg)';
      }
    }, 300);
  }

  setupAutoRefresh() {
    // Auto-refresh dashboard every 5 minutes
    this.refreshInterval = setInterval(() => {
      this.loadDashboardData();
    }, 5 * 60 * 1000);
  }

  destroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    // Destroy charts
    Object.values(this.charts).forEach(chart => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });
  }
}

// Export for use in other modules
window.AdminDashboard = new AdminDashboard();