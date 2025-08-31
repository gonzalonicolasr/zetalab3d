/* ==============================
   ZETALAB Admin Subscriptions Management
   Complete subscriptions management interface
============================== */

class AdminSubscriptions {
  constructor() {
    this.subscriptions = [];
    this.filteredSubscriptions = [];
    this.currentPage = 1;
    this.pageSize = ADMIN_CONFIG.USERS_PER_PAGE;
    this.totalPages = 1;
    this.filters = {
      search: ''
    };
    
    this.searchDebounce = AdminUtils.debounce(this.applyFilters.bind(this), 300);
  }

  async init() {
    console.log('Initializing Admin Subscriptions Management...');
    
    // Bind events
    this.bindEvents();
    
    // Load subscriptions data
    await this.loadSubscriptions();
  }

  bindEvents() {
    // Search input
    const searchInput = document.getElementById('subSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filters.search = e.target.value;
        this.searchDebounce();
      });
    }

    // Refresh button
    const refreshBtn = document.getElementById('refreshSubscriptions');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadSubscriptions();
      });
    }

    // Export button
    const exportBtn = document.getElementById('exportSubscriptions');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportSubscriptions();
      });
    }

    // Pagination
    const prevBtn = document.getElementById('subsPrevPage');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.renderSubscriptions();
        }
      });
    }

    const nextBtn = document.getElementById('subsNextPage');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (this.currentPage < this.totalPages) {
          this.currentPage++;
          this.renderSubscriptions();
        }
      });
    }
  }

  async loadSubscriptions() {
    try {
      AdminUtils.showLoading();
      console.log('📊 Loading ALL users with subscription information...');

      // First, get ALL users from auth view
      let allUsers = [];
      
      try {
        const { data: authUsers, error: authError } = await supabaseAdmin
          .from('admin_auth_users_view')
          .select('*')
          .order('registration_date', { ascending: false });

        if (!authError && authUsers) {
          allUsers = authUsers;
          console.log(`✅ Loaded ${allUsers.length} total registered users`);
        }
      } catch (e) {
        console.warn('Auth view not available, using alternative method');
        
        // Fallback: get users from pieces table and admin_users
        const { data: pieceUsers } = await supabaseAdmin
          .from('pieces')
          .select('user_id')
          .not('user_id', 'is', null);

        const { data: adminUsers } = await supabaseAdmin
          .from('admin_users')
          .select('user_id, email');

        // Combine unique user IDs
        const userIds = new Set();
        (pieceUsers || []).forEach(p => userIds.add(p.user_id));
        (adminUsers || []).forEach(a => userIds.add(a.user_id));

        allUsers = Array.from(userIds).map(id => ({
          id: id,
          email: `user-${id.substring(0, 8)}@zetalab.local`,
          registration_date: null
        }));
      }

      // Get all subscriptions
      const { data: subscriptions, error: subsError } = await supabaseAdmin
        .from('subscriptions')
        .select(`
          id, user_id, plan_type, active, expires_at, 
          created_at, payment_id, amount, payment_status
        `)
        .order('created_at', { ascending: false });

      // Get all user_subscriptions for modern subscription data
      const { data: userSubscriptions, error: userSubsError } = await supabaseAdmin
        .from('user_subscriptions')
        .select(`
          id, user_id, plan_id, status, current_period_start, 
          current_period_end, trial_ends_at, created_at, updated_at
        `);

      // Get subscription plans
      const { data: plans, error: plansError } = await supabaseAdmin
        .from('subscription_plans')
        .select('*');

      // Load payment transactions
      const { data: payments, error: paymentsError } = await supabaseAdmin
        .from('payment_transactions')
        .select('id, subscription_id, amount, mp_payment_type, status, created_at');

      // Create comprehensive subscription data for ALL users
      this.subscriptions = this.createComprehensiveSubscriptionData(
        allUsers, 
        subscriptions || [], 
        userSubscriptions || [], 
        plans || [], 
        payments || []
      );

      console.log(`✅ Created ${this.subscriptions.length} user subscription records (including users without subscriptions)`);

      // Update stats
      this.updateSubscriptionStats();

      // Apply current filters
      this.applyFilters();
      
      AdminUtils.showToast('Datos de usuarios y suscripciones cargados correctamente', 'success');

      // Log admin activity
      await AdminUtils.logAdminActivity('view_subscriptions', 'subscriptions', null, {
        total_users: allUsers.length,
        users_with_subscriptions: (subscriptions || []).length,
        subscription_count: this.subscriptions.length
      });

    } catch (error) {
      AdminErrorHandler.handle(error, 'loading subscriptions');
    } finally {
      AdminUtils.hideLoading();
    }
  }

  createComprehensiveSubscriptionData(allUsers, subscriptions, userSubscriptions, plans, payments) {
    // Create maps for quick lookups
    const subscriptionMap = new Map();
    const userSubscriptionMap = new Map();
    const planMap = new Map();
    const paymentMap = new Map();

    // Map legacy subscriptions
    subscriptions.forEach(sub => {
      subscriptionMap.set(sub.user_id, sub);
    });

    // Map modern user subscriptions
    userSubscriptions.forEach(sub => {
      userSubscriptionMap.set(sub.user_id, sub);
    });

    // Map plans
    plans.forEach(plan => {
      planMap.set(plan.id, plan);
    });

    // Map payments by subscription
    payments.forEach(payment => {
      if (payment.subscription_id) {
        if (!paymentMap.has(payment.subscription_id)) {
          paymentMap.set(payment.subscription_id, []);
        }
        paymentMap.get(payment.subscription_id).push(payment);
      }
    });

    // Create comprehensive records for ALL users
    return allUsers.map(user => {
      const legacySub = subscriptionMap.get(user.id);
      const modernSub = userSubscriptionMap.get(user.id);
      const currentSub = modernSub || legacySub; // Prefer modern subscription data
      
      let planInfo = null;
      if (modernSub && planMap.has(modernSub.plan_id)) {
        planInfo = planMap.get(modernSub.plan_id);
      }

      const subPayments = legacySub ? (paymentMap.get(legacySub.id) || []) : [];
      const latestPayment = subPayments.length > 0 ? 
        subPayments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] : null;

      return {
        // User information
        user_id: user.id,
        userEmail: user.email,
        userRegistrationDate: user.registration_date,
        
        // Subscription information (modern first, then legacy)
        id: currentSub?.id || null,
        subscription_id: currentSub?.id || null,
        plan_type: planInfo?.name || legacySub?.plan_type || 'free',
        plan_slug: planInfo?.slug || legacySub?.plan_type || 'free',
        plan_price: planInfo?.price || legacySub?.amount || 0,
        active: currentSub?.status === 'active' || legacySub?.active || false,
        status: this.determineUserSubscriptionStatus(currentSub, legacySub, user),
        
        // Dates
        created_at: currentSub?.created_at || null,
        expires_at: modernSub?.current_period_end || legacySub?.expires_at || null,
        trial_ends_at: modernSub?.trial_ends_at || null,
        current_period_start: modernSub?.current_period_start || null,
        current_period_end: modernSub?.current_period_end || null,
        
        // Payment information
        amount: planInfo?.price || legacySub?.amount || 0,
        payments: subPayments,
        latestPayment: latestPayment,
        paymentMethod: latestPayment?.mp_payment_type || 'N/A',
        totalPaid: subPayments
          .filter(p => p.status === 'approved')
          .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0),
        
        // Calculated fields
        hasSubscription: !!currentSub,
        subscriptionType: planInfo?.slug || legacySub?.plan_type || 'free',
        isActive: currentSub?.status === 'active' || legacySub?.active || false,
        
        // Display fields
        displayStatus: this.getDisplayStatus(currentSub, legacySub, user),
        displayPlan: planInfo?.name || legacySub?.plan_type || 'Sin suscripción',
        displayUser: user.email || `${user.id.substring(0, 8)}...`
      };
    });
  }

  determineUserSubscriptionStatus(modernSub, legacySub, user) {
    // Check modern subscription first
    if (modernSub) {
      if (modernSub.status === 'trialing') return 'trial';
      if (modernSub.status === 'active') return 'active';
      if (modernSub.status === 'canceled') return 'canceled';
      if (modernSub.status === 'past_due') return 'past_due';
      return modernSub.status;
    }

    // Check legacy subscription
    if (legacySub) {
      if (!legacySub.active) return 'inactive';
      
      const now = new Date();
      const expiresAt = legacySub.expires_at ? new Date(legacySub.expires_at) : null;

      if (expiresAt && expiresAt < now) return 'expired';
      if (legacySub.plan_type === 'trial') return 'trial';
      return 'active';
    }

    // No subscription
    return 'none';
  }

  getDisplayStatus(modernSub, legacySub, user) {
    const status = this.determineUserSubscriptionStatus(modernSub, legacySub, user);
    
    const statusMap = {
      'active': '🟢 Activa',
      'trialing': '🔵 Prueba',
      'trial': '🔵 Prueba',
      'canceled': '🟠 Cancelada',
      'past_due': '🟡 Vencida',
      'expired': '🔴 Expirada',
      'inactive': '🔴 Inactiva',
      'none': '⚪ Sin suscripción'
    };
    
    return statusMap[status] || '⚪ Sin suscripción';
  }

  determineSubscriptionStatus(subscription) {
    const now = new Date();
    const expiresAt = subscription.expires_at ? new Date(subscription.expires_at) : null;

    if (!subscription.active) {
      return 'inactive';
    }

    if (expiresAt && expiresAt < now) {
      return 'expired';
    }

    if (subscription.plan_type === 'trial') {
      return 'trial';
    }

    return 'active';
  }

  updateSubscriptionStats() {
    const now = new Date();
    
    const stats = {
      total: this.subscriptions.length,
      active: this.subscriptions.filter(s => s.status === 'active').length,
      expired: this.subscriptions.filter(s => s.status === 'expired').length,
      trial: this.subscriptions.filter(s => s.status === 'trial').length,
      monthlyRevenue: this.calculateMonthlyRevenue()
    };

    // Update UI
    document.getElementById('totalSubsCount').textContent = AdminUtils.formatNumber(stats.total);
    document.getElementById('activeSubsCount').textContent = AdminUtils.formatNumber(stats.active);
    document.getElementById('expiredSubsCount').textContent = AdminUtils.formatNumber(stats.expired);
    document.getElementById('subRevenue').textContent = AdminUtils.formatCurrency(stats.monthlyRevenue);
  }

  calculateMonthlyRevenue() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return this.subscriptions
      .filter(sub => {
        if (!sub.latestPayment || sub.latestPayment.status !== 'approved') return false;
        const paymentDate = new Date(sub.latestPayment.created_at);
        return paymentDate.getMonth() === currentMonth && 
               paymentDate.getFullYear() === currentYear;
      })
      .reduce((sum, sub) => sum + (parseFloat(sub.latestPayment.amount) || 0), 0);
  }

  applyFilters() {
    let filtered = [...this.subscriptions];

    // Apply search filter
    if (this.filters.search) {
      const searchTerm = this.filters.search.toLowerCase();
      filtered = filtered.filter(sub => 
        (sub.userEmail && sub.userEmail.toLowerCase().includes(searchTerm)) ||
        (sub.plan_type && sub.plan_type.toLowerCase().includes(searchTerm)) ||
        (sub.id && sub.id.toLowerCase().includes(searchTerm)) ||
        (sub.user_id && sub.user_id.toLowerCase().includes(searchTerm))
      );
    }

    this.filteredSubscriptions = filtered;
    this.currentPage = 1;
    this.renderSubscriptions();
  }

  renderSubscriptions() {
    const tbody = document.getElementById('subscriptionsTableBody');
    if (!tbody) return;

    // Calculate pagination
    this.totalPages = Math.ceil(this.filteredSubscriptions.length / this.pageSize);
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = Math.min(startIndex + this.pageSize, this.filteredSubscriptions.length);
    const pageSubs = this.filteredSubscriptions.slice(startIndex, endIndex);

    // Render subscriptions table
    if (pageSubs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center" style="padding: 2rem;">
            No se encontraron suscripciones con los filtros aplicados
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = pageSubs.map(sub => this.renderSubscriptionRow(sub)).join('');
    }

    // Update pagination info
    this.updatePaginationInfo();
  }

  renderSubscriptionRow(sub) {
    const statusClass = sub.status;
    const statusText = sub.displayStatus;
    const planText = sub.displayPlan;
    
    return `
      <tr class="fade-in ${sub.hasSubscription ? 'has-subscription' : 'no-subscription'}">
        <td>
          <div class="user-info">
            <div class="user-id" title="${sub.user_id}">
              ${sub.user_id.substring(0, 8)}...
            </div>
            <div class="user-email">${sub.displayUser}</div>
            ${sub.userRegistrationDate ? `
              <div class="user-reg-date" title="Registro: ${AdminUtils.formatDateTime(sub.userRegistrationDate)}">
                👤 ${AdminUtils.getRelativeTime(sub.userRegistrationDate)}
              </div>
            ` : ''}
          </div>
        </td>
        <td>
          <span class="plan-badge ${sub.plan_slug}">
            ${planText}
          </span>
          ${sub.plan_price > 0 ? `
            <div class="plan-price">${AdminUtils.formatCurrency(sub.plan_price)}/mes</div>
          ` : ''}
        </td>
        <td>
          <span class="status-badge ${statusClass}">
            ${statusText}
          </span>
          ${sub.trial_ends_at ? `
            <div class="trial-info">
              🎯 Prueba hasta ${AdminUtils.formatDate(sub.trial_ends_at)}
            </div>
          ` : ''}
        </td>
        <td>
          <div class="date-info">
            ${sub.created_at ? `
              <div class="date-main">${AdminUtils.formatDate(sub.created_at)}</div>
              <div class="date-relative">${AdminUtils.getRelativeTime(sub.created_at)}</div>
            ` : `
              <div class="no-subscription">Sin suscripción</div>
            `}
          </div>
        </td>
        <td>
          <div class="expiry-info">
            ${sub.expires_at ? `
              <div class="date-main">${AdminUtils.formatDate(sub.expires_at)}</div>
              <div class="date-relative ${new Date(sub.expires_at) < new Date() ? 'expired' : 'active'}">
                ${AdminUtils.getRelativeTime(sub.expires_at)}
              </div>
            ` : '<span class="no-expiry">Sin expiración</span>'}
          </div>
        </td>
        <td>
          <div class="amount-info">
            <div class="amount-main">${AdminUtils.formatCurrency(sub.amount || 0)}</div>
            ${sub.totalPaid > 0 ? `
              <div class="total-paid">Total: ${AdminUtils.formatCurrency(sub.totalPaid)}</div>
            ` : '<div class="no-payments">Sin pagos</div>'}
          </div>
        </td>
        <td>
          <div class="payment-method">
            ${this.getPaymentMethodIcon(sub.paymentMethod)} ${sub.paymentMethod}
            ${sub.latestPayment ? `
              <div class="payment-status ${sub.latestPayment.status}">
                ${sub.latestPayment.status}
              </div>
            ` : '<div class="no-payment-method">Sin pagos</div>'}
          </div>
        </td>
        <td>
          <div class="action-buttons">
            ${sub.hasSubscription ? `
              <button class="action-btn primary" onclick="adminSubscriptions.viewSubscriptionDetail('${sub.id}')" 
                      title="Ver detalles de la suscripción">
                👁️ Ver
              </button>
              <button class="action-btn ${statusClass === 'inactive' ? 'success' : 'warning'}" 
                      onclick="adminSubscriptions.toggleSubscriptionStatus('${sub.id}')" 
                      title="${statusClass === 'inactive' ? 'Activar suscripción' : 'Desactivar suscripción'}">
                ${statusClass === 'inactive' ? '✅ Activar' : '⏸️ Pausar'}
              </button>
            ` : `
              <button class="action-btn success" onclick="adminSubscriptions.createSubscription('${sub.user_id}')" 
                      title="Crear suscripción para este usuario">
                ➕ Crear Sub
              </button>
              <button class="action-btn info" onclick="adminSubscriptions.viewUserProfile('${sub.user_id}')" 
                      title="Ver perfil del usuario">
                👤 Perfil
              </button>
            `}
          </div>
        </td>
      </tr>
    `;
  }

  getStatusText(status) {
    const statusMap = {
      'active': '🟢 Activa',
      'inactive': '🔴 Inactiva', 
      'expired': '🟠 Expirada',
      'trial': '🔵 Prueba'
    };
    return statusMap[status] || '🟡 Desconocido';
  }

  getPlanText(planType) {
    const planMap = {
      'premium': 'Premium',
      'basic': 'Básico',
      'trial': 'Prueba',
      'monthly': 'Mensual',
      'yearly': 'Anual'
    };
    return planMap[planType] || planType || 'Desconocido';
  }

  getPaymentMethodIcon(method) {
    const iconMap = {
      'credit_card': '💳',
      'debit_card': '🏧',
      'pix': '🔄',
      'bank_transfer': '🏦',
      'mercadopago': '💰'
    };
    return iconMap[method] || '💳';
  }

  updatePaginationInfo() {
    const pageInfo = document.getElementById('subsPageInfo');
    if (pageInfo) {
      pageInfo.textContent = `Página ${this.currentPage} de ${this.totalPages}`;
    }

    const prevBtn = document.getElementById('subsPrevPage');
    if (prevBtn) {
      prevBtn.disabled = this.currentPage <= 1;
    }

    const nextBtn = document.getElementById('subsNextPage');
    if (nextBtn) {
      nextBtn.disabled = this.currentPage >= this.totalPages;
    }
  }

  async viewSubscriptionDetail(subscriptionId) {
    const subscription = this.subscriptions.find(s => s.id === subscriptionId);
    if (!subscription) {
      AdminUtils.showToast('Suscripción no encontrada', 'error');
      return;
    }

    // Create and show subscription detail modal
    const modal = this.createSubscriptionDetailModal(subscription);
    document.body.appendChild(modal);
    modal.classList.add('active');
  }

  createSubscriptionDetailModal(subscription) {
    const modal = document.createElement('div');
    modal.className = 'modal subscription-detail-modal';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>💳 Detalles de Suscripción</h3>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="subscription-info">
            <h4>Información General</h4>
            <div class="info-grid">
              <div class="info-item">
                <label>ID:</label>
                <span>${subscription.id}</span>
              </div>
              <div class="info-item">
                <label>Usuario:</label>
                <span>${subscription.userEmail}</span>
              </div>
              <div class="info-item">
                <label>Plan:</label>
                <span class="plan-badge ${subscription.plan_type}">${this.getPlanText(subscription.plan_type)}</span>
              </div>
              <div class="info-item">
                <label>Estado:</label>
                <span class="status-badge ${subscription.status}">${this.getStatusText(subscription.status)}</span>
              </div>
              <div class="info-item">
                <label>Creada:</label>
                <span>${AdminUtils.formatDateTime(subscription.created_at)}</span>
              </div>
              <div class="info-item">
                <label>Expira:</label>
                <span>${subscription.expires_at ? AdminUtils.formatDateTime(subscription.expires_at) : 'Sin expiración'}</span>
              </div>
            </div>
          </div>
          
          <div class="payment-history">
            <h4>Historial de Pagos</h4>
            <div class="payments-list">
              ${subscription.payments.length > 0 ? 
                subscription.payments.map(payment => `
                  <div class="payment-item">
                    <div class="payment-info">
                      <span class="payment-amount">${AdminUtils.formatCurrency(payment.amount)}</span>
                      <span class="payment-method">${this.getPaymentMethodIcon(payment.mp_payment_type)} ${payment.mp_payment_type}</span>
                    </div>
                    <div class="payment-status-date">
                      <span class="payment-status ${payment.status}">${payment.status}</span>
                      <span class="payment-date">${AdminUtils.formatDate(payment.created_at)}</span>
                    </div>
                  </div>
                `).join('') : 
                '<p>No hay pagos registrados</p>'
              }
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Bind close events
    modal.querySelector('.modal-close').onclick = () => modal.remove();
    modal.querySelector('.modal-overlay').onclick = () => modal.remove();
    
    return modal;
  }

  async toggleSubscriptionStatus(subscriptionId) {
    const subscription = this.subscriptions.find(s => s.id === subscriptionId);
    if (!subscription) return;

    const newStatus = !subscription.active;
    const action = newStatus ? 'activar' : 'desactivar';

    const confirmed = confirm(`¿Está seguro de que desea ${action} esta suscripción?`);
    if (!confirmed) return;

    try {
      AdminUtils.showLoading();

      // Update subscription status in database
      const { error } = await supabaseAdmin
        .from('subscriptions')
        .update({ active: newStatus })
        .eq('id', subscriptionId);

      if (error) throw error;

      // Update local state
      subscription.active = newStatus;
      subscription.status = this.determineSubscriptionStatus(subscription);

      this.updateSubscriptionStats();
      this.renderSubscriptions();
      
      AdminUtils.showToast(`Suscripción ${action}da correctamente`, 'success');

    } catch (error) {
      AdminErrorHandler.handle(error, 'updating subscription status');
    } finally {
      AdminUtils.hideLoading();
    }
  }

  exportSubscriptions() {
    const dataToExport = this.filteredSubscriptions.map(sub => ({
      'ID Usuario': sub.user_id,
      'Email': sub.userEmail,
      'Tiene Suscripción': sub.hasSubscription ? 'Sí' : 'No',
      'Plan': sub.displayPlan,
      'Estado': sub.displayStatus,
      'Activa': sub.active ? 'Sí' : 'No',
      'Creada': sub.created_at ? AdminUtils.formatDateTime(sub.created_at) : 'N/A',
      'Expira': sub.expires_at ? AdminUtils.formatDateTime(sub.expires_at) : 'Sin expiración',
      'Monto': AdminUtils.formatCurrency(sub.amount || 0),
      'Total Pagado': AdminUtils.formatCurrency(sub.totalPaid || 0),
      'Método de Pago': sub.paymentMethod,
      'Registro Usuario': sub.userRegistrationDate ? AdminUtils.formatDateTime(sub.userRegistrationDate) : 'N/A'
    }));

    AdminUtils.exportToCSV(dataToExport, 'usuarios_suscripciones_zetalab');
  }

  // New action methods for user management
  async createSubscription(userId) {
    AdminUtils.showToast('Funcionalidad de crear suscripción en desarrollo...', 'info');
    console.log('Creating subscription for user:', userId);
  }

  async viewUserProfile(userId) {
    // Switch to users section and show this user's detail
    if (window.adminMain) {
      window.adminMain.switchToSection('users');
      
      // Wait a bit for the section to load, then show user detail
      setTimeout(() => {
        if (window.adminUsers) {
          window.adminUsers.viewUserDetail(userId);
        }
      }, 500);
    }
  }

  async manageUserSubscription(userId) {
    const user = this.subscriptions.find(s => s.user_id === userId);
    if (!user) {
      AdminUtils.showToast('Usuario no encontrado', 'error');
      return;
    }

    // Create subscription management modal
    const modal = this.createSubscriptionManagementModal(user);
    document.body.appendChild(modal);
    modal.classList.add('active');
  }

  createSubscriptionManagementModal(userSub) {
    const modal = document.createElement('div');
    modal.className = 'modal subscription-management-modal';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>💳 Gestionar Suscripción - ${userSub.displayUser}</h3>
          <button class="modal-close">×</button>
        </div>
        <div class="modal-body">
          <div class="current-status">
            <h4>Estado Actual</h4>
            <div class="status-display">
              <span class="status-badge ${userSub.status}">${userSub.displayStatus}</span>
              <span class="plan-badge ${userSub.plan_slug}">${userSub.displayPlan}</span>
            </div>
            ${userSub.expires_at ? `
              <div class="expiry-display">
                Expira: ${AdminUtils.formatDateTime(userSub.expires_at)}
              </div>
            ` : ''}
          </div>
          
          <div class="subscription-actions">
            <h4>Acciones Disponibles</h4>
            <div class="action-grid">
              ${!userSub.hasSubscription ? `
                <button class="action-btn success" onclick="adminSubscriptions.activateTrialForUser('${userSub.user_id}')">
                  🎯 Activar Prueba 7 días
                </button>
                <button class="action-btn primary" onclick="adminSubscriptions.activatePremiumForUser('${userSub.user_id}')">
                  ⭐ Activar Premium
                </button>
              ` : `
                <button class="action-btn warning" onclick="adminSubscriptions.extendUserSubscription('${userSub.user_id}')">
                  📅 Extender Período
                </button>
                <button class="action-btn danger" onclick="adminSubscriptions.cancelUserSubscription('${userSub.user_id}')">
                  🚫 Cancelar Suscripción
                </button>
              `}
            </div>
          </div>
          
          ${userSub.payments && userSub.payments.length > 0 ? `
            <div class="payment-history">
              <h4>Historial de Pagos</h4>
              <div class="payments-list">
                ${userSub.payments.map(payment => `
                  <div class="payment-item">
                    <div class="payment-info">
                      <span class="payment-amount">${AdminUtils.formatCurrency(payment.amount)}</span>
                      <span class="payment-method">${this.getPaymentMethodIcon(payment.mp_payment_type)} ${payment.mp_payment_type}</span>
                    </div>
                    <div class="payment-status-date">
                      <span class="payment-status ${payment.status}">${payment.status}</span>
                      <span class="payment-date">${AdminUtils.formatDate(payment.created_at)}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : '<div class="no-payments"><h4>Sin Historial de Pagos</h4><p>Este usuario no tiene pagos registrados.</p></div>'}
        </div>
      </div>
    `;
    
    // Bind close events
    modal.querySelector('.modal-close').onclick = () => modal.remove();
    modal.querySelector('.modal-overlay').onclick = () => modal.remove();
    
    return modal;
  }

  // Subscription management actions
  async activateTrialForUser(userId) {
    AdminUtils.showToast('Activando prueba de 7 días para usuario...', 'info');
    // Implementation would create a trial subscription
  }

  async activatePremiumForUser(userId) {
    AdminUtils.showToast('Activando suscripción premium para usuario...', 'info');
    // Implementation would create a premium subscription
  }

  async extendUserSubscription(userId) {
    AdminUtils.showToast('Extendiendo período de suscripción...', 'info');
    // Implementation would extend the current subscription
  }

  async cancelUserSubscription(userId) {
    const confirmed = confirm('¿Está seguro de que desea cancelar la suscripción de este usuario?');
    if (confirmed) {
      AdminUtils.showToast('Cancelando suscripción...', 'warning');
      // Implementation would cancel the subscription
    }
  }
}

// Make available globally
window.adminSubscriptions = new AdminSubscriptions();
window.AdminSubscriptions = window.adminSubscriptions;

console.log('✅ Admin Subscriptions Management loaded');