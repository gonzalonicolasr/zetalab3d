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
      console.log('📊 Loading comprehensive user statistics from ALL tables...');
      
      // Use the comprehensive stats function for accurate data
      const { data: comprehensiveStats, error: statsError } = await supabaseAdmin
        .rpc('get_comprehensive_admin_stats');

      if (!statsError && comprehensiveStats) {
        // Extract user statistics from comprehensive data
        const userStats = comprehensiveStats.users;
        this.stats.totalUsers = userStats.total_registered; // Real count from auth.users
        this.stats.activeUsers = userStats.active_30d;
        this.stats.userGrowth = userStats.active_7d;
        this.stats.usersWithPieces = userStats.with_pieces;
        this.stats.emailConfirmedUsers = userStats.email_confirmed;
        this.stats.neverLoggedIn = userStats.never_logged_in;
        this.stats.dormantUsers = userStats.dormant_90d;
        this.stats.adminUsers = userStats.admins;

        console.log('✅ Comprehensive user stats loaded:', userStats);
        return this.stats.totalUsers;
      } else {
        console.warn('⚠️ Comprehensive stats not available, using fallback method');
        return await this.loadUsersStatsFallback();
      }

    } catch (error) {
      console.error('❌ Error loading comprehensive user stats:', error);
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
      console.log('💳 Loading comprehensive subscription statistics...');

      // Use comprehensive stats function
      const { data: comprehensiveStats, error: statsError } = await supabaseAdmin
        .rpc('get_comprehensive_admin_stats');

      if (!statsError && comprehensiveStats) {
        const subStats = comprehensiveStats.subscriptions;
        this.stats.activeSubscriptions = subStats.total_active;
        this.stats.trialSubscriptions = subStats.total_trial;
        this.stats.totalSubscriptions = subStats.total_active + subStats.total_trial + subStats.total_canceled;
        this.stats.subscriptionGrowth = subStats.new_this_month;
        this.stats.expiringSubscriptions = subStats.expiring_soon;
        this.stats.estimatedMRR = subStats.estimated_mrr;

        // Load subscription revenue analytics
        const { data: revenueAnalytics, error: revenueError } = await supabaseAdmin
          .from('admin_subscription_revenue_analytics')
          .select('*');

        if (!revenueError && revenueAnalytics) {
          this.stats.subscriptionsByPlan = {};
          revenueAnalytics.forEach(plan => {
            this.stats.subscriptionsByPlan[plan.plan_name] = plan.currently_active;
          });
          this.stats.subscriptionRevenueBreakdown = revenueAnalytics;
        }

        // Calculate free users (total registered - users with subscriptions)
        this.stats.freeUsers = Math.max(0, this.stats.totalUsers - comprehensiveStats.users.with_subscriptions);

        console.log('✅ Comprehensive subscription stats loaded:', subStats);
        return this.stats.activeSubscriptions;
      } else {
        console.warn('⚠️ Using fallback subscription loading');
        return await this.loadSubscriptionsStatsFallback();
      }

    } catch (error) {
      console.error('❌ Error loading comprehensive subscription stats:', error);
      return await this.loadSubscriptionsStatsFallback();
    }
  }

  async loadSubscriptionsStatsFallback() {
    try {
      // Load from both subscription tables for comprehensive data
      const [userSubsResult, legacySubsResult] = await Promise.all([
        supabaseAdmin.from('user_subscriptions').select('*'),
        supabaseAdmin.from('subscriptions').select('*')
      ]);

      const now = new Date();
      let activeSubs = 0, trialSubs = 0, totalSubs = 0;

      // Process user_subscriptions (primary table)
      if (!userSubsResult.error && userSubsResult.data) {
        const userSubs = userSubsResult.data;
        activeSubs = userSubs.filter(sub => 
          sub.status === 'active' && 
          (!sub.current_period_end || new Date(sub.current_period_end) > now)
        ).length;
        
        trialSubs = userSubs.filter(sub => 
          sub.status === 'trial' && 
          (!sub.trial_ends_at || new Date(sub.trial_ends_at) > now)
        ).length;
        
        totalSubs = userSubs.length;
      }

      // Add legacy subscriptions if user_subscriptions is empty
      if (totalSubs === 0 && !legacySubsResult.error && legacySubsResult.data) {
        const legacySubs = legacySubsResult.data;
        activeSubs = legacySubs.filter(sub => 
          sub.active === true && 
          (!sub.expires_at || new Date(sub.expires_at) > now)
        ).length;
        totalSubs = legacySubs.length;
      }

      this.stats.activeSubscriptions = activeSubs;
      this.stats.trialSubscriptions = trialSubs;
      this.stats.totalSubscriptions = totalSubs;
      this.stats.freeUsers = Math.max(0, this.stats.totalUsers - totalSubs);

      return this.stats.activeSubscriptions;
    } catch (error) {
      console.error('Fallback subscription stats error:', error);
      this.stats.activeSubscriptions = 0;
      this.stats.freeUsers = this.stats.totalUsers;
      return 0;
    }
  }

  async loadPiecesStats() {
    try {
      console.log('🔧 Loading comprehensive pieces and content statistics...');

      // Use comprehensive stats function
      const { data: comprehensiveStats, error: statsError } = await supabaseAdmin
        .rpc('get_comprehensive_admin_stats');

      if (!statsError && comprehensiveStats) {
        const contentStats = comprehensiveStats.content;
        this.stats.totalPieces = contentStats.total_pieces;
        this.stats.piecesToday = contentStats.pieces_today;
        this.stats.piecesThisWeek = contentStats.pieces_this_week;
        this.stats.piecesThisMonth = contentStats.pieces_this_month;
        this.stats.totalCalculations = contentStats.total_calculations;
        this.stats.calculationsToday = contentStats.calculations_today;
        this.stats.avgPiecesPerUser = contentStats.avg_pieces_per_user;

        console.log('✅ Comprehensive content stats loaded:', contentStats);
        return this.stats.totalPieces;
      } else {
        console.warn('⚠️ Using fallback pieces loading');
        return await this.loadPiecesStatsFallback();
      }

    } catch (error) {
      console.error('❌ Error loading comprehensive pieces stats:', error);
      return await this.loadPiecesStatsFallback();
    }
  }

  async loadPiecesStatsFallback() {
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
      console.log('💰 Loading comprehensive financial and revenue statistics...');

      // Use comprehensive stats function for financial data
      const { data: comprehensiveStats, error: statsError } = await supabaseAdmin
        .rpc('get_comprehensive_admin_stats');

      if (!statsError && comprehensiveStats) {
        const financeStats = comprehensiveStats.finance;
        this.stats.totalRevenue = financeStats.total_revenue;
        this.stats.monthlyRevenue = financeStats.monthly_revenue;
        this.stats.lastMonthRevenue = financeStats.last_month_revenue;
        this.stats.successfulTransactions = financeStats.successful_transactions;
        this.stats.avgTransactionAmount = financeStats.avg_transaction;
        this.stats.paymentsToday = financeStats.payments_today;
        this.stats.pendingPayments = financeStats.pending_payments;

        // Calculate revenue growth
        if (this.stats.lastMonthRevenue > 0) {
          this.stats.revenueGrowth = this.stats.monthlyRevenue - this.stats.lastMonthRevenue;
          this.stats.revenueGrowthPercent = 
            ((this.stats.revenueGrowth / this.stats.lastMonthRevenue) * 100).toFixed(1);
        } else {
          this.stats.revenueGrowth = this.stats.monthlyRevenue;
          this.stats.revenueGrowthPercent = this.stats.monthlyRevenue > 0 ? 100 : 0;
        }

        // Load daily revenue data for charts
        const { data: dailyData, error: dailyError } = await supabaseAdmin
          .from('admin_daily_activity')
          .select('activity_date, daily_revenue, pieces_created')
          .order('activity_date', { ascending: true })
          .limit(30);

        if (!dailyError && dailyData) {
          this.stats.dailyRevenue = {};
          this.stats.dailyPieces = {};
          
          dailyData.forEach(day => {
            const dateStr = day.activity_date;
            this.stats.dailyRevenue[dateStr] = day.daily_revenue || 0;
            this.stats.dailyPieces[dateStr] = day.pieces_created || 0;
          });
        }

        console.log('✅ Comprehensive financial stats loaded:', financeStats);
        return this.stats.monthlyRevenue;
      } else {
        console.warn('⚠️ Using fallback revenue loading');
        return await this.loadRevenueStatsFallback();
      }

    } catch (error) {
      console.error('❌ Error loading comprehensive revenue stats:', error);
      return await this.loadRevenueStatsFallback();
    }
  }

  async loadRevenueStatsFallback() {
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
        // Fallback: estimate based on subscriptions amounts
        const { data: subs, error: subsError } = await supabaseAdmin
          .from('user_subscriptions')
          .select('plan_id, subscription_plans(price_ars)')
          .eq('status', 'active');

        if (!subsError && subs && subs.length > 0) {
          const totalMRR = subs.reduce((sum, s) => sum + (s.subscription_plans?.price_ars || 0), 0);
          this.stats.monthlyRevenue = totalMRR;
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
      // Skip config profiles and user usage for now - use simpler approach
      // const { data: profiles, error: profilesError } = await supabaseAdmin
      //   .from('config_profiles')
      //   .select('user_id, created_at');

      // const { data: usage, error: usageError } = await supabaseAdmin
      //   .from('user_usage')
      //   .select('user_id, calculations_used, pieces_created, month_year');

      // Calculate power user metrics (users with high activity)
      if (piecesData) {
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
      console.log('📈 Loading comprehensive recent activity from ALL tables...');

      // Use the comprehensive recent activity function
      const { data: activities, error: activitiesError } = await supabaseAdmin
        .rpc('get_recent_admin_activity', { limit_count: 20 });

      if (!activitiesError && activities) {
        // Transform the function result to match our UI format
        const transformedActivities = activities.map(activity => ({
          type: activity.type,
          title: activity.title,
          description: activity.description,
          detail: activity.details ? JSON.stringify(activity.details) : '',
          time: activity.created_at,
          icon: activity.icon
        }));

        console.log('✅ Comprehensive activity loaded:', transformedActivities.length, 'items');
        this.renderRecentActivity(transformedActivities);
        return;
      } else {
        console.warn('⚠️ Using fallback activity loading');
        return await this.loadRecentActivityFallback();
      }

    } catch (error) {
      console.error('❌ Error loading comprehensive activity:', error);
      return await this.loadRecentActivityFallback();
    }
  }

  async loadRecentActivityFallback() {
    try {
      const activities = [];

      // Get recent pieces created
      const { data: recentPieces, error: piecesError } = await supabaseAdmin
        .from('pieces')
        .select('title, created_at, user_id, category, est_price_ars')
        .order('created_at', { ascending: false })
        .limit(8);

      if (!piecesError && recentPieces) {
        recentPieces.forEach(piece => {
          activities.push({
            type: 'piece_created',
            title: 'Nueva pieza creada',
            description: piece.title || 'Sin nombre',
            detail: `${piece.category || 'Sin categoría'} - $${piece.est_price_ars || 0}`,
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

      // Get recent user subscriptions (main table)
      const { data: recentUserSubs, error: userSubsError } = await supabaseAdmin
        .from('user_subscriptions')
        .select(`
          created_at, status,
          subscription_plans (name, price_ars)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!userSubsError && recentUserSubs) {
        recentUserSubs.forEach(sub => {
          activities.push({
            type: 'subscription',
            title: 'Nueva suscripción',
            description: sub.subscription_plans?.name || 'Plan desconocido',
            detail: `Estado: ${sub.status} - $${sub.subscription_plans?.price_ars || 0}`,
            time: sub.created_at,
            icon: '📈'
          });
        });
      }

      // Get recent payments
      const { data: recentPayments, error: paymentsError } = await supabaseAdmin
        .from('payment_transactions')
        .select('created_at, amount, status, mp_payment_type, processed_at')
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
            detail: 'Configuración personalizada guardada',
            time: profile.created_at,
            icon: '⚙️'
          });
        });
      }

      // Get recent filament additions
      const { data: recentFilaments, error: filamentsError } = await supabaseAdmin
        .from('filaments')
        .select('created_at, brand, material, color, weight_grams')
        .order('created_at', { ascending: false })
        .limit(5);

      if (!filamentsError && recentFilaments) {
        recentFilaments.forEach(filament => {
          activities.push({
            type: 'filament_added',
            title: 'Nuevo filamento añadido',
            description: `${filament.brand || 'Sin marca'} ${filament.material || ''}`,
            detail: `${filament.color || 'Sin color'} - ${filament.weight_grams || 0}g`,
            time: filament.created_at,
            icon: '🧵'
          });
        });
      }

      // Sort by time and take latest 15
      activities.sort((a, b) => new Date(b.time) - new Date(a.time));
      const latestActivities = activities.slice(0, 15);

      this.renderRecentActivity(latestActivities);

    } catch (error) {
      console.error('Error loading recent activity fallback:', error);
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

    // Destroy existing chart if it exists
    if (this.charts.userGrowth) {
      this.charts.userGrowth.destroy();
      this.charts.userGrowth = null;
    }

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

    // Destroy existing chart if it exists
    if (this.charts.subscription) {
      this.charts.subscription.destroy();
      this.charts.subscription = null;
    }

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
    } else if (sectionName === 'subscriptions' && window.AdminSubscriptions) {
      window.AdminSubscriptions.init();
    } else if (sectionName === 'pieces' && window.AdminPieces) {
      window.AdminPieces.init();
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