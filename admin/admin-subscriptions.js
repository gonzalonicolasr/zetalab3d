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

      // Load subscriptions from database
      const { data: subscriptions, error: subsError } = await supabaseAdmin
        .from('subscriptions')
        .select(`
          id, user_id, plan_type, active, expires_at, 
          created_at, payment_id, amount, payment_status
        `)
        .order('created_at', { ascending: false });

      if (subsError) {
        console.error('Error loading subscriptions:', subsError);
        throw subsError;
      }

      // Load payment transactions for additional details
      const { data: payments, error: paymentsError } = await supabaseAdmin
        .from('payment_transactions')
        .select('id, subscription_id, amount, mp_payment_type, status, created_at');

      // Create a map of payments by subscription
      const paymentMap = new Map();
      if (!paymentsError && payments) {
        payments.forEach(payment => {
          if (payment.subscription_id) {
            if (!paymentMap.has(payment.subscription_id)) {
              paymentMap.set(payment.subscription_id, []);
            }
            paymentMap.get(payment.subscription_id).push(payment);
          }
        });
      }

      // Enhance subscriptions with payment info and user data
      this.subscriptions = (subscriptions || []).map(sub => {
        const subPayments = paymentMap.get(sub.id) || [];
        const latestPayment = subPayments.length > 0 ? 
          subPayments.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0] : null;

        return {
          ...sub,
          payments: subPayments,
          latestPayment: latestPayment,
          paymentMethod: latestPayment?.mp_payment_type || 'Desconocido',
          totalPaid: subPayments
            .filter(p => p.status === 'approved')
            .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0),
          // Add user info placeholder (would need to join with user data)
          userEmail: `user-${sub.user_id.substring(0, 8)}@zetalab.local`,
          status: this.determineSubscriptionStatus(sub)
        };
      });

      // Update stats
      this.updateSubscriptionStats();

      // Apply current filters
      this.applyFilters();
      
      AdminUtils.showToast('Suscripciones cargadas correctamente', 'success');

      // Log admin activity
      await AdminUtils.logAdminActivity('view_subscriptions', 'subscriptions', null, {
        subscription_count: this.subscriptions.length
      });

    } catch (error) {
      AdminErrorHandler.handle(error, 'loading subscriptions');
    } finally {
      AdminUtils.hideLoading();
    }
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
    const statusText = this.getStatusText(statusClass);
    const planText = this.getPlanText(sub.plan_type);
    
    return `
      <tr class="fade-in">
        <td>
          <div class="user-info">
            <div class="user-id" title="${sub.user_id}">
              ${sub.user_id.substring(0, 8)}...
            </div>
            <div class="user-email">${sub.userEmail}</div>
          </div>
        </td>
        <td>
          <span class="plan-badge ${sub.plan_type}">
            ${planText}
          </span>
        </td>
        <td>
          <span class="status-badge ${statusClass}">
            ${statusText}
          </span>
        </td>
        <td>
          <div class="date-info">
            <div class="date-main">${AdminUtils.formatDate(sub.created_at)}</div>
            <div class="date-relative">${AdminUtils.getRelativeTime(sub.created_at)}</div>
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
            ` : ''}
          </div>
        </td>
        <td>
          <div class="payment-method">
            ${this.getPaymentMethodIcon(sub.paymentMethod)} ${sub.paymentMethod}
            ${sub.latestPayment ? `
              <div class="payment-status ${sub.latestPayment.status}">
                ${sub.latestPayment.status}
              </div>
            ` : ''}
          </div>
        </td>
        <td>
          <div class="action-buttons">
            <button class="action-btn primary" onclick="adminSubscriptions.viewSubscriptionDetail('${sub.id}')" 
                    title="Ver detalles de la suscripción">
              👁️ Ver
            </button>
            <button class="action-btn ${statusClass === 'inactive' ? 'success' : 'warning'}" 
                    onclick="adminSubscriptions.toggleSubscriptionStatus('${sub.id}')" 
                    title="${statusClass === 'inactive' ? 'Activar suscripción' : 'Desactivar suscripción'}">
              ${statusClass === 'inactive' ? '✅ Activar' : '⏸️ Pausar'}
            </button>
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
      ID: sub.id,
      Usuario: sub.userEmail,
      Plan: this.getPlanText(sub.plan_type),
      Estado: this.getStatusText(sub.status),
      Activa: sub.active ? 'Sí' : 'No',
      Creada: AdminUtils.formatDateTime(sub.created_at),
      Expira: sub.expires_at ? AdminUtils.formatDateTime(sub.expires_at) : 'Sin expiración',
      Monto: sub.amount || 0,
      'Total Pagado': sub.totalPaid,
      'Método de Pago': sub.paymentMethod
    }));

    AdminUtils.exportToCSV(dataToExport, 'suscripciones_zetalab');
  }
}

// Make available globally
window.adminSubscriptions = new AdminSubscriptions();
window.AdminSubscriptions = window.adminSubscriptions;

console.log('✅ Admin Subscriptions Management loaded');