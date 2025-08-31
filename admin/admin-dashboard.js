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
      // Use pieces table to count unique users (more reliable than auth.users)
      const { data: piecesUsers, error } = await supabaseAdmin
        .from('pieces')
        .select('user_id, created_at')
        .not('user_id', 'is', null);

      if (error) {
        console.error('Error loading users from pieces:', error);
        return await this.loadUsersStatsFallback();
      }

      // Count unique users
      const uniqueUsers = new Set(piecesUsers.map(p => p.user_id));
      this.stats.totalUsers = uniqueUsers.size;

      // Get active users (users with recent activity - pieces created in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const activeUsers = new Set(
        piecesUsers
          .filter(p => new Date(p.created_at) > thirtyDaysAgo)
          .map(p => p.user_id)
      );
      this.stats.activeUsers = activeUsers.size;

      // Get user growth (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const weeklyNewUsers = new Set(
        piecesUsers
          .filter(p => new Date(p.created_at) > weekAgo)
          .map(p => p.user_id)
      );
      this.stats.userGrowth = weeklyNewUsers.size;

      // Additional user analytics
      await this.loadUserAnalytics(piecesUsers);

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
      // Load from user_subscriptions (main subscription table)
      const { data: userSubs, error: userSubsError } = await supabaseAdmin
        .from('user_subscriptions')
        .select(`
          id, status, trial_started_at, trial_ends_at, 
          current_period_start, current_period_end, 
          canceled_at, created_at,
          subscription_plans (name, slug, price_ars)
        `);

      // Load from simple subscriptions table (backup/legacy)
      const { data: simpleSubs, error: simpleSubsError } = await supabaseAdmin
        .from('subscriptions')
        .select('id, plan_type, active, expires_at, created_at, amount');

      const now = new Date();
      
      // Process user_subscriptions
      if (!userSubsError && userSubs) {
        const activeSubs = userSubs.filter(sub => {
          return sub.status === 'active' && 
                 (!sub.canceled_at) &&
                 (!sub.current_period_end || new Date(sub.current_period_end) > now);
        });
        
        const trialSubs = userSubs.filter(sub => {
          return sub.status === 'trial' &&
                 (!sub.trial_ends_at || new Date(sub.trial_ends_at) > now);
        });

        this.stats.activeSubscriptions = activeSubs.length;
        this.stats.trialSubscriptions = trialSubs.length;
        this.stats.totalSubscriptions = userSubs.length;
        
        // Calculate subscription distribution
        this.stats.subscriptionsByPlan = {};
        userSubs.forEach(sub => {
          const planName = sub.subscription_plans?.name || 'Unknown';
          this.stats.subscriptionsByPlan[planName] = 
            (this.stats.subscriptionsByPlan[planName] || 0) + 1;
        });

        // Monthly subscription growth
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        this.stats.subscriptionGrowth = userSubs.filter(sub => 
          new Date(sub.created_at) > monthAgo
        ).length;
      }
      
      // Add simple subscriptions if available
      if (!simpleSubsError && simpleSubs) {
        const activeSimpleSubs = simpleSubs.filter(sub => 
          sub.active && (!sub.expires_at || new Date(sub.expires_at) > now)
        );
        this.stats.activeSubscriptions += activeSimpleSubs.length;
        this.stats.totalSubscriptions += simpleSubs.length;
      }

      // Calculate free users
      this.stats.freeUsers = Math.max(0, this.stats.totalUsers - this.stats.totalSubscriptions);
      
      return this.stats.activeSubscriptions;
    } catch (error) {
      console.error('Error loading subscription stats:', error);
      this.stats.activeSubscriptions = 0;
      this.stats.freeUsers = this.stats.totalUsers;
      return 0;
    }
  }

  async loadPiecesStats() {
    try {
      // Get total pieces count
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

      // Get total calculations (piece versions)
      const { count: totalCalculations, error: calcError } = await supabaseAdmin
        .from('piece_versions')
        .select('*', { count: 'exact', head: true });

      if (!calcError) {
        this.stats.totalCalculations = totalCalculations || 0;
      }

      return this.stats.totalPieces;
    } catch (error) {
      console.error('Error loading pieces stats:', error);
      return 0;
    }
  }

  async loadRevenueStats() {
    try {
      // Load actual payment transactions
      const { data: payments, error: paymentsError } = await supabaseAdmin
        .from('payment_transactions')
        .select('amount, currency, status, processed_at, created_at');

      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      if (!paymentsError && payments) {
        // Calculate monthly revenue from successful payments
        const successfulPayments = payments.filter(p => 
          p.status === 'approved' || p.status === 'completed'
        );
        
        const monthlyRevenue = successfulPayments
          .filter(p => {
            const paymentDate = new Date(p.processed_at || p.created_at);
            return paymentDate.getMonth() === currentMonth && 
                   paymentDate.getFullYear() === currentYear;
          })
          .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

        this.stats.monthlyRevenue = monthlyRevenue;
        this.stats.totalRevenue = successfulPayments
          .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

        // Last month comparison
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        
        const lastMonthRevenue = successfulPayments
          .filter(p => {
            const paymentDate = new Date(p.processed_at || p.created_at);
            return paymentDate.getMonth() === lastMonth && 
                   paymentDate.getFullYear() === lastMonthYear;
          })
          .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

        this.stats.revenueGrowth = monthlyRevenue - lastMonthRevenue;
        this.stats.revenueGrowthPercent = lastMonthRevenue > 0 ? 
          ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1) : 0;

        // Daily revenue for charts
        this.stats.dailyRevenue = this.calculateDailyRevenue(successfulPayments);
      } else {
        // Fallback: estimate based on subscriptions and plans
        const { data: plans, error: plansError } = await supabaseAdmin
          .from('subscription_plans')
          .select('price_ars');

        if (!plansError && plans) {
          const avgPrice = plans.reduce((sum, p) => sum + (p.price_ars || 0), 0) / plans.length;
          this.stats.monthlyRevenue = this.stats.activeSubscriptions * avgPrice;
        } else {
          this.stats.monthlyRevenue = this.stats.activeSubscriptions * 2000; // Default estimate
        }
      }

      return this.stats.monthlyRevenue;
    } catch (error) {
      console.error('Error loading revenue stats:', error);
      return 0;
    }
  }

  // Helper method for user analytics
  async loadUserAnalytics(piecesData) {
    try {
      // Load config profiles for user activity analysis
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('config_profiles')
        .select('user_id, created_at');

      // Load user usage data
      const { data: usage, error: usageError } = await supabaseAdmin
        .from('user_usage')
        .select('user_id, calculations_used, pieces_created, month_year');

      // Calculate power user metrics (users with high activity)
      if (piecesData && !profilesError && profiles) {
        const userPieceCount = {};
        piecesData.forEach(piece => {
          userPieceCount[piece.user_id] = (userPieceCount[piece.user_id] || 0) + 1;
        });

        // Users with 5+ pieces are considered "power users"
        this.stats.powerUsers = Object.values(userPieceCount).filter(count => count >= 5).length;
        this.stats.avgPiecesPerUser = Object.values(userPieceCount).reduce((sum, count) => sum + count, 0) / Object.keys(userPieceCount).length;
      }

      // Calculate retention based on recent vs old user activity
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const recentActivity = piecesData.filter(p => new Date(p.created_at) > thirtyDaysAgo);
      const oldUserActivity = piecesData.filter(p => new Date(p.created_at) < ninetyDaysAgo);

      const recentUsers = new Set(recentActivity.map(p => p.user_id));
      const oldUsers = new Set(oldUserActivity.map(p => p.user_id));
      const retainedUsers = [...recentUsers].filter(u => oldUsers.has(u));

      this.stats.retentionRate = oldUsers.size > 0 ? 
        ((retainedUsers.length / oldUsers.size) * 100).toFixed(1) : 0;

    } catch (error) {
      console.error('Error loading user analytics:', error);
    }
  }

  // Helper method to calculate daily revenue
  calculateDailyRevenue(payments) {
    const dailyRevenue = {};
    const now = new Date();
    
    // Initialize last 30 days with 0
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyRevenue[dateStr] = 0;
    }

    // Add actual revenue data
    payments.forEach(payment => {
      const paymentDate = new Date(payment.processed_at || payment.created_at);
      const dateStr = paymentDate.toISOString().split('T')[0];
      if (dailyRevenue.hasOwnProperty(dateStr)) {
        dailyRevenue[dateStr] += parseFloat(payment.amount) || 0;
      }
    });

    return dailyRevenue;
  }

  updateStatsCards() {
    // Primary stats - Total users
    const totalUsersEl = document.getElementById('totalUsers');
    if (totalUsersEl) {
      totalUsersEl.textContent = AdminUtils.formatNumber(this.stats.totalUsers);
    }

    // User growth and activity
    const userGrowthEl = document.getElementById('userGrowth');
    if (userGrowthEl && this.stats.userGrowth !== undefined) {
      userGrowthEl.textContent = `+${this.stats.userGrowth} esta semana`;
    }

    const activeUsersEl = document.getElementById('activeUsers');
    if (activeUsersEl && this.stats.activeUsers !== undefined) {
      activeUsersEl.textContent = `${AdminUtils.formatNumber(this.stats.activeUsers)} activos`;
    }

    const retentionRateEl = document.getElementById('retentionRate');
    if (retentionRateEl && this.stats.retentionRate !== undefined) {
      retentionRateEl.textContent = `${this.stats.retentionRate}% retención`;
    }

    // Subscription stats
    const activeSubsEl = document.getElementById('activeSubscriptions');
    if (activeSubsEl) {
      activeSubsEl.textContent = AdminUtils.formatNumber(this.stats.activeSubscriptions);
    }

    const trialSubsEl = document.getElementById('trialSubscriptions');
    if (trialSubsEl && this.stats.trialSubscriptions !== undefined) {
      trialSubsEl.textContent = `${AdminUtils.formatNumber(this.stats.trialSubscriptions)} en prueba`;
    }

    const freeUsersEl = document.getElementById('freeUsers');
    if (freeUsersEl && this.stats.freeUsers !== undefined) {
      freeUsersEl.textContent = `${AdminUtils.formatNumber(this.stats.freeUsers)} usuarios gratuitos`;
    }

    const subGrowthEl = document.getElementById('subGrowth');
    if (subGrowthEl && this.stats.subscriptionGrowth !== undefined) {
      subGrowthEl.textContent = `+${this.stats.subscriptionGrowth} este mes`;
    }

    // Pieces and usage stats
    const totalPiecesEl = document.getElementById('totalPieces');
    if (totalPiecesEl) {
      totalPiecesEl.textContent = AdminUtils.formatNumber(this.stats.totalPieces);
    }

    const pieceGrowthEl = document.getElementById('pieceGrowth');
    if (pieceGrowthEl && this.stats.piecesToday !== undefined) {
      pieceGrowthEl.textContent = `+${this.stats.piecesToday} hoy`;
    }

    const avgPiecesEl = document.getElementById('avgPiecesPerUser');
    if (avgPiecesEl && this.stats.avgPiecesPerUser !== undefined) {
      avgPiecesEl.textContent = `${this.stats.avgPiecesPerUser.toFixed(1)} piezas/usuario`;
    }

    const powerUsersEl = document.getElementById('powerUsers');
    if (powerUsersEl && this.stats.powerUsers !== undefined) {
      powerUsersEl.textContent = `${this.stats.powerUsers} usuarios avanzados`;
    }

    // Revenue stats
    const monthlyRevenueEl = document.getElementById('monthlyRevenue');
    if (monthlyRevenueEl) {
      monthlyRevenueEl.textContent = AdminUtils.formatCurrency(this.stats.monthlyRevenue);
    }

    const totalRevenueEl = document.getElementById('totalRevenue');
    if (totalRevenueEl && this.stats.totalRevenue !== undefined) {
      totalRevenueEl.textContent = AdminUtils.formatCurrency(this.stats.totalRevenue);
    }

    const revenueGrowthEl = document.getElementById('revenueGrowth');
    if (revenueGrowthEl && this.stats.revenueGrowth !== undefined) {
      const growthText = this.stats.revenueGrowth >= 0 ? 
        `+${AdminUtils.formatCurrency(this.stats.revenueGrowth)}` : 
        `-${AdminUtils.formatCurrency(Math.abs(this.stats.revenueGrowth))}`;
      revenueGrowthEl.textContent = `${growthText} vs mes anterior`;
    }

    const revenueGrowthPercentEl = document.getElementById('revenueGrowthPercent');
    if (revenueGrowthPercentEl && this.stats.revenueGrowthPercent !== undefined) {
      const isPositive = parseFloat(this.stats.revenueGrowthPercent) >= 0;
      revenueGrowthPercentEl.textContent = `${isPositive ? '+' : ''}${this.stats.revenueGrowthPercent}%`;
      revenueGrowthPercentEl.className = isPositive ? 'growth-positive' : 'growth-negative';
    }

    // Additional metrics
    const totalCalculationsEl = document.getElementById('totalCalculations');
    if (totalCalculationsEl && this.stats.totalCalculations !== undefined) {
      totalCalculationsEl.textContent = AdminUtils.formatNumber(this.stats.totalCalculations);
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

      // Get recent pieces created
      const { data: recentPieces, error: piecesError } = await supabaseAdmin
        .from('pieces')
        .select('title, created_at, user_id, category')
        .order('created_at', { ascending: false })
        .limit(8);

      if (!piecesError && recentPieces) {
        recentPieces.forEach(piece => {
          activities.push({
            type: 'piece_created',
            title: 'Nueva pieza creada',
            description: piece.title || 'Sin nombre',
            detail: piece.category || 'Sin categoría',
            time: piece.created_at,
            icon: '🔧'
          });
        });
      }

      // Get recent piece versions (calculations)
      const { data: recentVersions, error: versionsError } = await supabaseAdmin
        .from('piece_versions')
        .select(`
          created_at, total, ml_price,
          pieces (title, user_id)
        `)
        .order('created_at', { ascending: false })
        .limit(8);

      if (!versionsError && recentVersions) {
        recentVersions.forEach(version => {
          activities.push({
            type: 'calculation',
            title: 'Nuevo cálculo realizado',
            description: version.pieces?.title || 'Pieza sin nombre',
            detail: `Total: ${AdminUtils.formatCurrency(version.total)}`,
            time: version.created_at,
            icon: '💰'
          });
        });
      }

      // Get recent subscriptions
      const { data: recentSubs, error: subsError } = await supabaseAdmin
        .from('user_subscriptions')
        .select(`
          created_at, status,
          subscription_plans (name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!subsError && recentSubs) {
        recentSubs.forEach(sub => {
          activities.push({
            type: 'subscription',
            title: 'Nueva suscripción',
            description: sub.subscription_plans?.name || 'Plan desconocido',
            detail: `Estado: ${sub.status}`,
            time: sub.created_at,
            icon: '📈'
          });
        });
      }

      // Get recent payments
      const { data: recentPayments, error: paymentsError } = await supabaseAdmin
        .from('payment_transactions')
        .select('created_at, amount, status, mp_payment_type')
        .order('created_at', { ascending: false })
        .limit(5);

      if (!paymentsError && recentPayments) {
        recentPayments.forEach(payment => {
          activities.push({
            type: 'payment',
            title: 'Nuevo pago',
            description: `${AdminUtils.formatCurrency(payment.amount)}`,
            detail: `${payment.mp_payment_type || 'Desconocido'} - ${payment.status}`,
            time: payment.created_at,
            icon: '💳'
          });
        });
      }

      // Get recent config profiles
      const { data: recentProfiles, error: profilesError } = await supabaseAdmin
        .from('config_profiles')
        .select('created_at, name, user_id')
        .order('created_at', { ascending: false })
        .limit(5);

      if (!profilesError && recentProfiles) {
        recentProfiles.forEach(profile => {
          activities.push({
            type: 'profile_created',
            title: 'Nuevo perfil de configuración',
            description: profile.name || 'Sin nombre',
            detail: 'Perfil personalizado',
            time: profile.created_at,
            icon: '⚙️'
          });
        });
      }

      // Sort by time and take latest 15
      activities.sort((a, b) => new Date(b.time) - new Date(a.time));
      const latestActivities = activities.slice(0, 15);

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
      <div class="activity-item fade-in" data-type="${activity.type}">
        <div class="activity-icon">${activity.icon}</div>
        <div class="activity-content">
          <div class="activity-title">${activity.title}</div>
          <div class="activity-description">${activity.description}</div>
          ${activity.detail ? `<div class="activity-detail">${activity.detail}</div>` : ''}
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
    
    // Use real daily revenue data if available, otherwise create sample data
    const days = 30;
    const labels = [];
    const revenueData = [];
    const pieceData = [];
    const today = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }));
      
      const dateStr = date.toISOString().split('T')[0];
      
      // Use real revenue data if available
      if (this.stats.dailyRevenue && this.stats.dailyRevenue[dateStr] !== undefined) {
        revenueData.push(this.stats.dailyRevenue[dateStr]);
      } else {
        // Generate sample revenue data
        const avgDailyRevenue = (this.stats.monthlyRevenue || 0) / 30;
        const variation = Math.random() * avgDailyRevenue * 0.5;
        revenueData.push(Math.max(0, avgDailyRevenue + variation - (avgDailyRevenue * 0.25)));
      }
      
      // Generate piece creation data (sample based on total pieces)
      const avgDailyPieces = Math.max(1, Math.floor((this.stats.totalPieces || 0) / 90)); // 90 days average
      const pieceVariation = Math.floor(Math.random() * avgDailyPieces);
      pieceData.push(avgDailyPieces + pieceVariation);
    }

    this.charts.userGrowth = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Ingresos Diarios (ARS)',
            data: revenueData,
            borderColor: ADMIN_CONFIG.CHART_COLORS.primary,
            backgroundColor: ADMIN_CONFIG.CHART_COLORS.primary + '20',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            yAxisID: 'y'
          },
          {
            label: 'Piezas Creadas',
            data: pieceData,
            borderColor: ADMIN_CONFIG.CHART_COLORS.secondary,
            backgroundColor: ADMIN_CONFIG.CHART_COLORS.secondary + '20',
            borderWidth: 2,
            fill: false,
            tension: 0.4,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              color: '#b9c7bf',
              usePointStyle: true,
              padding: 20
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                if (context.datasetIndex === 0) {
                  return `Ingresos: ${AdminUtils.formatCurrency(context.raw)}`;
                } else {
                  return `Piezas: ${context.raw}`;
                }
              }
            }
          }
        },
        scales: {
          x: {
            ticks: {
              color: '#b9c7bf'
            },
            grid: {
              color: '#385f4d',
              display: false
            }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            beginAtZero: true,
            ticks: {
              color: '#b9c7bf',
              callback: function(value) {
                return AdminUtils.formatCurrency(value);
              }
            },
            grid: {
              color: '#385f4d'
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            beginAtZero: true,
            ticks: {
              color: '#b9c7bf'
            },
            grid: {
              drawOnChartArea: false,
            },
          }
        }
      }
    });
  }

  initSubscriptionChart() {
    const canvas = document.getElementById('subscriptionChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Use real subscription data from stats
    const subscriptionData = this.stats.subscriptionsByPlan || {};
    const trialCount = this.stats.trialSubscriptions || 0;
    const freeCount = this.stats.freeUsers || 0;
    
    // Create labels and data arrays
    const labels = [];
    const data = [];
    const colors = [];
    
    // Add subscription plans
    Object.entries(subscriptionData).forEach(([planName, count], index) => {
      labels.push(planName);
      data.push(count);
      colors.push(Object.values(ADMIN_CONFIG.CHART_COLORS)[index % Object.values(ADMIN_CONFIG.CHART_COLORS).length]);
    });
    
    // Add trials if any
    if (trialCount > 0) {
      labels.push('En Prueba');
      data.push(trialCount);
      colors.push(ADMIN_CONFIG.CHART_COLORS.warning);
    }
    
    // Add free users
    if (freeCount > 0) {
      labels.push('Usuarios Gratuitos');
      data.push(freeCount);
      colors.push('#9CA3AF'); // Gray for free users
    }
    
    // Fallback data if no real data available
    if (data.length === 0) {
      labels.push('Sin datos');
      data.push(1);
      colors.push('#E5E7EB');
    }

    this.charts.subscription = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#1e3a2e'
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
              padding: 15,
              usePointStyle: true
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                const percentage = ((context.raw / total) * 100).toFixed(1);
                return `${context.label}: ${context.raw} (${percentage}%)`;
              }
            }
          }
        },
        cutout: '60%'
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