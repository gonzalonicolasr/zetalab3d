/* ==============================
   ZETALAB Admin Users Management
   Complete user management interface
============================== */

class AdminUsers {
  constructor() {
    this.users = [];
    this.filteredUsers = [];
    this.currentPage = 1;
    this.pageSize = ADMIN_CONFIG.USERS_PER_PAGE;
    this.totalPages = 1;
    this.selectedUsers = new Set();
    this.filters = {
      search: '',
      status: '',
      subscription: '',
      dateFrom: '',
      dateTo: ''
    };
    
    this.searchDebounce = AdminUtils.debounce(this.applyFilters.bind(this), 300);
  }

  async init() {
    console.log('Initializing Admin Users Management...');
    
    // Bind events
    this.bindEvents();
    
    // Load users data
    await this.loadUsers();
  }

  bindEvents() {
    // Search input
    const searchInput = document.getElementById('userSearch');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filters.search = e.target.value;
        this.searchDebounce();
      });
    }

    // Filter selects
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
      statusFilter.addEventListener('change', (e) => {
        this.filters.status = e.target.value;
        this.applyFilters();
      });
    }

    const subscriptionFilter = document.getElementById('subscriptionFilter');
    if (subscriptionFilter) {
      subscriptionFilter.addEventListener('change', (e) => {
        this.filters.subscription = e.target.value;
        this.applyFilters();
      });
    }

    // Date filters
    const dateFromFilter = document.getElementById('dateFromFilter');
    if (dateFromFilter) {
      dateFromFilter.addEventListener('change', (e) => {
        this.filters.dateFrom = e.target.value;
        this.applyFilters();
      });
    }

    const dateToFilter = document.getElementById('dateToFilter');
    if (dateToFilter) {
      dateToFilter.addEventListener('change', (e) => {
        this.filters.dateTo = e.target.value;
        this.applyFilters();
      });
    }

    // Refresh button
    const refreshBtn = document.getElementById('refreshUsers');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        this.loadUsers();
      });
    }

    // Export button
    const exportBtn = document.getElementById('exportUsers');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportUsers();
      });
    }

    // Pagination
    const prevBtn = document.getElementById('prevPage');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.renderUsers();
        }
      });
    }

    const nextBtn = document.getElementById('nextPage');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (this.currentPage < this.totalPages) {
          this.currentPage++;
          this.renderUsers();
        }
      });
    }

    // Page size selector
    const pageSizeSelect = document.getElementById('pageSize');
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', (e) => {
        this.pageSize = parseInt(e.target.value);
        this.currentPage = 1;
        this.renderUsers();
      });
    }

    // Select all checkbox
    const selectAllCheckbox = document.getElementById('selectAllUsers');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', (e) => {
        this.toggleSelectAll(e.target.checked);
      });
    }

    // Bulk action buttons
    this.bindBulkActionEvents();

    // User detail modal close
    const userDetailModal = document.getElementById('userDetailModal');
    if (userDetailModal) {
      userDetailModal.addEventListener('click', (e) => {
        if (e.target === userDetailModal || e.target.classList.contains('modal-close')) {
          this.closeUserDetailModal();
        }
      });
    }
  }

  bindBulkActionEvents() {
    const bulkEnable = document.getElementById('bulkEnable');
    if (bulkEnable) {
      bulkEnable.addEventListener('click', () => {
        this.bulkAction('enable');
      });
    }

    const bulkDisable = document.getElementById('bulkDisable');
    if (bulkDisable) {
      bulkDisable.addEventListener('click', () => {
        this.bulkAction('disable');
      });
    }

    const bulkExport = document.getElementById('bulkExport');
    if (bulkExport) {
      bulkExport.addEventListener('click', () => {
        this.exportSelectedUsers();
      });
    }
  }

  async loadUsers() {
    try {
      AdminUtils.showLoading();

      // Use the new admin user view for comprehensive data
      await this.loadUsersFromView();
      
      // Apply current filters
      this.applyFilters();
      
      AdminUtils.showToast('Usuarios cargados correctamente', 'success');

      // Log admin activity
      await AdminUtils.logAdminActivity('view_users', 'users', null, {
        user_count: this.users.length,
        filters: this.filters
      });

    } catch (error) {
      AdminErrorHandler.handle(error, 'loading users');
    } finally {
      AdminUtils.hideLoading();
    }
  }

  async loadUsersFromView() {
    try {
      // Skip views completely - use comprehensive data loading
      console.log('⚠️ Loading user data from actual tables...');
      
      // Use comprehensive approach without relying on views or auth.users
      const allUsers = await this.getAllUsersComprehensive();
      this.users = allUsers;
      return this.users;

    } catch (error) {
      console.error('Error loading users:', error);
      // Ultimate fallback - get basic user data from pieces table
      return await this.loadUsersLegacy();
    }
  }

  transformViewData(viewData) {
    return (viewData || []).map(user => ({
      id: user.id || user.user_id,
      email: user.email,
      created_at: user.created_at || user.registration_date,
      updated_at: user.updated_at,
      last_sign_in_at: user.last_sign_in_at,
      email_confirmed_at: user.email_confirmed_at,
      auth_method: user.auth_method || 'email',
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata,
      // Subscription data
      subscription: user.subscription_status ? {
        id: user.subscription_id,
        type: user.subscription_type,
        status: user.subscription_status,
        expires_at: user.subscription_expires_at,
        created_at: user.subscription_created_at
      } : null,
      subscription_type: user.subscription_type || 'free',
      subscription_status: user.subscription_status || 'none',
      subscription_expires_at: user.subscription_expires_at,
      // Usage statistics
      piece_count: user.piece_count || 0,
      version_count: user.version_count || 0,
      last_piece_created: user.last_piece_created,
      // Admin information
      is_admin: user.admin_role ? true : false,
      admin_role: user.admin_role,
      admin_permissions: user.admin_permissions,
      // Calculated fields
      status: user.status || 'active',
      last_activity: user.last_piece_created || user.last_sign_in_at || user.created_at,
      activity_score: this.calculateActivityScore(user)
    }));
  }

  async getAllUsersComprehensive() {
    try {
      console.log('📊 Loading comprehensive user data...');
      
      // Get all users who have created pieces (active users)
      const { data: pieceUsers, error: pieceError } = await supabaseAdmin
        .from('pieces')
        .select('user_id, created_at, title, est_price_ars')
        .not('user_id', 'is', null);

      if (pieceError) throw pieceError;

      // Get subscription data
      const { data: subscriptions, error: subError } = await supabaseAdmin
        .from('subscriptions')
        .select('*');

      // Get admin users
      const { data: adminUsers, error: adminError } = await supabaseAdmin
        .from('admin_users')
        .select('*');

      // Create comprehensive user objects
      const userMap = new Map();

      // Process piece users
      (pieceUsers || []).forEach(piece => {
        const userId = piece.user_id;
        if (!userMap.has(userId)) {
          userMap.set(userId, {
            id: userId,
            email: `user-${userId.substring(0, 8)}@zetalab.local`, // Placeholder
            created_at: piece.created_at,
            last_sign_in_at: null,
            email_confirmed_at: null,
            auth_method: 'unknown',
            pieces: [],
            piece_count: 0,
            version_count: 0,
            last_piece_created: piece.created_at,
            total_revenue: 0,
            subscription: null,
            subscription_type: 'free',
            subscription_status: 'none',
            is_admin: false,
            admin_role: null,
            status: 'active'
          });
        }
        
        const user = userMap.get(userId);
        user.pieces.push(piece);
        user.piece_count++;
        user.total_revenue += parseFloat(piece.est_price_ars || 0);
        
        if (new Date(piece.created_at) > new Date(user.last_piece_created || 0)) {
          user.last_piece_created = piece.created_at;
        }
      });

      // Add subscription information
      (subscriptions || []).forEach(sub => {
        if (userMap.has(sub.user_id)) {
          const user = userMap.get(sub.user_id);
          user.subscription = sub;
          user.subscription_type = sub.plan || 'free';
          user.subscription_status = sub.status || 'none';
          user.subscription_expires_at = sub.expires_at;
        }
      });

      // Add admin information
      (adminUsers || []).forEach(admin => {
        if (userMap.has(admin.user_id)) {
          const user = userMap.get(admin.user_id);
          user.is_admin = true;
          user.admin_role = admin.role;
          user.admin_permissions = admin.permissions;
          user.email = admin.email; // Get real email for admins
        }
      });

      // Get piece versions counts
      for (const [userId, user] of userMap) {
        const { count: versionCount } = await supabaseAdmin
          .from('piece_versions')
          .select('*', { count: 'exact', head: true })
          .in('piece_id', user.pieces.map(p => p.id) || []);
        
        user.version_count = versionCount || 0;
        user.activity_score = this.calculateActivityScore(user);
      }

      console.log(`📈 Loaded ${userMap.size} comprehensive user records`);
      return Array.from(userMap.values()).sort((a, b) => {
        // Sort: admins first, then by activity, then by registration
        if (a.is_admin && !b.is_admin) return -1;
        if (!a.is_admin && b.is_admin) return 1;
        if (a.activity_score !== b.activity_score) return b.activity_score - a.activity_score;
        return new Date(b.created_at) - new Date(a.created_at);
      });

    } catch (error) {
      console.error('Error loading comprehensive user data:', error);
      throw error;
    }
  }

  calculateActivityScore(user) {
    let score = 0;
    
    // Points for pieces created
    score += Math.min(user.piece_count * 0.5, 2);
    
    // Points for versions created
    score += Math.min(user.version_count * 0.2, 1);
    
    // Points for recent activity
    const daysSinceLastActivity = user.last_piece_created ? 
      (Date.now() - new Date(user.last_piece_created).getTime()) / (1000 * 60 * 60 * 24) : 999;
    
    if (daysSinceLastActivity < 7) score += 1;
    else if (daysSinceLastActivity < 30) score += 0.5;
    
    // Points for subscription
    if (user.subscription_type !== 'free' && user.subscription_status === 'active') {
      score += 1;
    }
    
    return Math.min(Math.round(score), 5);
  }

  async loadUsersLegacy() {
    try {
      // Fallback method: Get unique user IDs from pieces table
      const { data: pieceUsers, error } = await supabaseAdmin
        .from('pieces')
        .select('user_id, created_at')
        .not('user_id', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Get unique users and enhance with basic data
      const userMap = new Map();
      pieceUsers.forEach(piece => {
        if (!userMap.has(piece.user_id)) {
          userMap.set(piece.user_id, {
            id: piece.user_id,
            email: 'N/A', // Limited data available
            created_at: piece.created_at,
            last_sign_in_at: null,
            piece_count: 0,
            version_count: 0,
            subscription_type: 'none',
            status: 'active',
            is_admin: false,
            auth_method: 'unknown'
          });
        }
      });

      // Enhance with counts
      for (const [userId, user] of userMap) {
        // Get piece count
        const { count: pieceCount } = await supabaseAdmin
          .from('pieces')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);
        
        user.piece_count = pieceCount || 0;

        // Get version count - using piece_id from user's pieces
        const { data: userPieces } = await supabaseAdmin
          .from('pieces')
          .select('id')
          .eq('user_id', userId);
        
        let versionCount = 0;
        if (userPieces && userPieces.length > 0) {
          const pieceIds = userPieces.map(p => p.id);
          const { count } = await supabaseAdmin
            .from('piece_versions')
            .select('*', { count: 'exact', head: true })
            .in('piece_id', pieceIds);
          versionCount = count || 0;
        }
        
        user.version_count = versionCount;
      }

      this.users = Array.from(userMap.values());
      return this.users;

    } catch (error) {
      console.error('Error in legacy user loading:', error);
      this.users = [];
      return [];
    }
  }

  determineUserStatus(user, subscription) {
    if (!subscription) {
      return 'active'; // Default status
    }

    const now = new Date();
    const expiresAt = subscription.expires_at ? new Date(subscription.expires_at) : null;

    if (subscription.status === 'disabled') {
      return 'disabled';
    }

    if (subscription.type === 'trial') {
      if (expiresAt && expiresAt < now) {
        return 'expired';
      }
      return 'trial';
    }

    if (expiresAt && expiresAt < now) {
      return 'expired';
    }

    return subscription.status || 'active';
  }

  applyFilters() {
    let filtered = [...this.users];

    // Apply search filter
    if (this.filters.search) {
      const searchTerm = this.filters.search.toLowerCase();
      filtered = filtered.filter(user => 
        (user.email && user.email.toLowerCase().includes(searchTerm)) ||
        (user.id && user.id.toLowerCase().includes(searchTerm))
      );
    }

    // Apply status filter
    if (this.filters.status) {
      filtered = filtered.filter(user => user.status === this.filters.status);
    }

    // Apply subscription filter
    if (this.filters.subscription) {
      filtered = filtered.filter(user => user.subscription_type === this.filters.subscription);
    }

    // Apply date range filters
    if (this.filters.dateFrom) {
      const fromDate = new Date(this.filters.dateFrom);
      filtered = filtered.filter(user => new Date(user.created_at) >= fromDate);
    }

    if (this.filters.dateTo) {
      const toDate = new Date(this.filters.dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter(user => new Date(user.created_at) <= toDate);
    }

    this.filteredUsers = filtered;
    this.currentPage = 1;
    this.renderUsers();
  }

  renderUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;

    // Calculate pagination
    this.totalPages = Math.ceil(this.filteredUsers.length / this.pageSize);
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = Math.min(startIndex + this.pageSize, this.filteredUsers.length);
    const pageUsers = this.filteredUsers.slice(startIndex, endIndex);

    // Render users table
    if (pageUsers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="text-center" style="padding: 2rem;">
            No se encontraron usuarios con los filtros aplicados
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = pageUsers.map(user => this.renderUserRow(user)).join('');
    }

    // Update pagination info
    this.updatePaginationInfo();

    // Update selected users count
    this.updateBulkActions();
  }

  renderUserRow(user) {
    const statusClass = user.status || 'active';
    const statusText = this.getStatusText(statusClass);
    const subscriptionText = this.getSubscriptionText(user.subscription_type);
    
    // Authentication method display with enhanced logic
    const authMethodIcon = {
      'google': '🔍',
      'facebook': '📘', 
      'email': '📧',
      'unknown': '❓'
    }[user.auth_method] || '❓';
    
    const authMethodText = {
      'google': 'Google',
      'facebook': 'Facebook',
      'email': 'Email/Contraseña',
      'unknown': 'Desconocido'
    }[user.auth_method] || 'Desconocido';

    // Enhanced admin badge with more info
    const adminBadge = user.is_admin ? 
      `<span class="admin-badge" title="Usuario Administrador: ${user.admin_role}">
         👑 ${user.admin_role?.toUpperCase() || 'ADMIN'}
       </span>` : '';

    // Enhanced activity indicators
    const activityIndicator = this.getActivityIndicator(user);
    const subscriptionBadge = this.getSubscriptionBadge(user);
    const emailStatus = this.getEmailStatus(user);

    return `
      <tr class="fade-in ${user.is_admin ? 'admin-user-row' : ''} ${this.getActivityRowClass(user)}">
        <td>
          <input type="checkbox" class="user-checkbox" value="${user.id}" 
                 ${this.selectedUsers.has(user.id) ? 'checked' : ''}
                 ${user.is_admin ? 'data-admin="true"' : ''}>
        </td>
        <td>
          <div class="user-info">
            <div class="user-id-section">
              <div class="user-id" title="${user.id}">
                ${user.id.substring(0, 8)}...
                ${adminBadge}
              </div>
              <div class="user-stats-mini" title="Piezas: ${user.piece_count} | Versiones: ${user.version_count} | Ingresos: $${user.total_revenue?.toFixed(0) || 0}">
                📊 ${user.piece_count}p/${user.version_count}v
              </div>
            </div>
            <div class="user-auth-method" title="Método de autenticación: ${authMethodText}">
              ${authMethodIcon} ${authMethodText}
            </div>
          </div>
        </td>
        <td>
          <div class="user-email-section">
            <div class="user-email">
              ${this.displayEmail(user)}
              ${emailStatus}
            </div>
            ${user.total_revenue ? `<div class="revenue-info" title="Ingresos estimados generados">
              💰 $${user.total_revenue.toFixed(0)} ARS
            </div>` : ''}
          </div>
        </td>
        <td>
          <div class="subscription-info-enhanced">
            ${subscriptionBadge}
            ${this.getSubscriptionDetails(user)}
          </div>
        </td>
        <td>
          <div class="status-section">
            <span class="status-badge ${statusClass}">
              ${statusText}
            </span>
            ${activityIndicator}
          </div>
        </td>
        <td>
          <div class="registration-info">
            <div class="date-main">${this.formatDateShort(user.created_at)}</div>
            <div class="date-relative" title="${this.formatDateLong(user.created_at)}">
              ${this.getRelativeTime(user.created_at)}
            </div>
          </div>
        </td>
        <td>
          <div class="last-access-info">
            <div class="access-main">
              ${this.getLastActivityText(user)}
            </div>
            <div class="access-indicator">
              ${this.getActivityScore(user)}
            </div>
          </div>
        </td>
        <td class="text-center">
          <div class="usage-stats-detailed">
            <div class="usage-primary">
              <span class="piece-count" title="Piezas creadas">📄 ${user.piece_count}</span>
              <span class="version-count" title="Versiones totales">🔄 ${user.version_count}</span>
            </div>
            ${user.last_piece_created ? `<div class="last-creation" title="Última pieza creada">
              ⏰ ${this.getRelativeTime(user.last_piece_created)}
            </div>` : '<div class="no-activity">Sin actividad</div>'}
          </div>
        </td>
        <td>
          <div class="action-buttons-enhanced">
            <button class="action-btn primary" onclick="adminUsers.viewUserDetail('${user.id}')" 
                    title="Ver perfil completo del usuario">
              👁️ Ver
            </button>
            ${!user.is_admin ? `
            <button class="action-btn warning" onclick="adminUsers.manageUserSubscription('${user.id}')" 
                    title="Gestionar suscripción">
              💳 Sub
            </button>
            <button class="action-btn ${statusClass === 'disabled' ? 'success' : 'danger'}" 
                    onclick="adminUsers.toggleUserStatus('${user.id}')" 
                    title="${statusClass === 'disabled' ? 'Activar usuario' : 'Desactivar usuario'}">
              ${statusClass === 'disabled' ? '✅ On' : '🚫 Off'}
            </button>` : `
            <button class="action-btn info disabled" title="Cuenta de administrador protegida">
              🔒 Admin
            </button>`}
            <div class="action-dropdown">
              <button class="action-btn info dropdown-toggle">⋯</button>
              <div class="dropdown-menu">
                <button onclick="adminUsers.resetUserPassword('${user.email || user.id}')">🔄 Reset Password</button>
                <button onclick="adminUsers.viewUserPieces('${user.id}')">📄 Ver Piezas</button>
                <button onclick="adminUsers.exportUserData(adminUsers.users.find(u => u.id === '${user.id}'))">📋 Exportar Datos</button>
                ${!user.is_admin ? `<button class="text-danger" onclick="adminUsers.deleteUser('${user.id}')">🗑️ Eliminar</button>` : ''}
              </div>
            </div>
          </div>
        </td>
      </tr>
    `;
  }

  updatePaginationInfo() {
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) {
      pageInfo.textContent = `Página ${this.currentPage} de ${this.totalPages}`;
    }

    const prevBtn = document.getElementById('prevPage');
    if (prevBtn) {
      prevBtn.disabled = this.currentPage <= 1;
    }

    const nextBtn = document.getElementById('nextPage');
    if (nextBtn) {
      nextBtn.disabled = this.currentPage >= this.totalPages;
    }
  }

  updateBulkActions() {
    const bulkActions = document.getElementById('bulkActions');
    const selectedCount = document.getElementById('selectedCount');

    if (this.selectedUsers.size > 0) {
      bulkActions?.classList.remove('hidden');
      if (selectedCount) {
        selectedCount.textContent = `${this.selectedUsers.size} usuario${this.selectedUsers.size > 1 ? 's' : ''} seleccionado${this.selectedUsers.size > 1 ? 's' : ''}`;
      }
    } else {
      bulkActions?.classList.add('hidden');
    }

    // Bind checkbox events for newly rendered checkboxes
    document.querySelectorAll('.user-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const userId = e.target.value;
        if (e.target.checked) {
          this.selectedUsers.add(userId);
        } else {
          this.selectedUsers.delete(userId);
        }
        this.updateBulkActions();
      });
    });
  }

  toggleSelectAll(checked) {
    const checkboxes = document.querySelectorAll('.user-checkbox');
    checkboxes.forEach(checkbox => {
      checkbox.checked = checked;
      const userId = checkbox.value;
      if (checked) {
        this.selectedUsers.add(userId);
      } else {
        this.selectedUsers.delete(userId);
      }
    });
    this.updateBulkActions();
  }

  async viewUserDetail(userId) {
    try {
      AdminUtils.showLoading();

      const user = this.users.find(u => u.id === userId);
      if (!user) {
        AdminUtils.showToast('Usuario no encontrado', 'error');
        return;
      }

      // Get additional user details
      const userDetails = await this.getUserDetails(userId);
      
      this.showUserDetailModal(user, userDetails);

    } catch (error) {
      AdminErrorHandler.handle(error, 'loading user details');
    } finally {
      AdminUtils.hideLoading();
    }
  }

  async getUserDetails(userId) {
    try {
      // Get user pieces with details
      const { data: pieces, error: piecesError } = await supabaseAdmin
        .from('pieces')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      // Get user piece versions via pieces
      let lastVersion = null;
      if (pieces && pieces.length > 0) {
        const pieceIds = pieces.map(p => p.id);
        const { data: versions, error: versionsError } = await supabaseAdmin
          .from('piece_versions')
          .select('created_at')
          .in('piece_id', pieceIds)
          .order('created_at', { ascending: false })
          .limit(1);
        
        lastVersion = versions?.[0]?.created_at || null;
      }

      return {
        pieces: pieces || [],
        lastVersion: lastVersion
      };
    } catch (error) {
      console.error('Error loading user details:', error);
      return { pieces: [], lastVersion: null };
    }
  }

  showUserDetailModal(user, details) {
    const modal = document.getElementById('userDetailModal');
    if (!modal) return;

    // Update modal content with comprehensive information
    document.getElementById('userDetailName').innerHTML = `
      ${user.email || 'Usuario Sin Email'}
      ${user.is_admin ? '<span class="admin-badge-modal">👑 ADMINISTRADOR</span>' : ''}
    `;
    
    // Personal Information
    document.getElementById('detailEmail').innerHTML = `
      ${user.email || 'N/A'}
      ${user.email_confirmed_at ? '<span class="verified-badge">✓ Verificado</span>' : '<span class="unverified-badge">⚠️ No verificado</span>'}
    `;
    
    document.getElementById('detailCreatedAt').textContent = AdminUtils.formatDateTime(user.created_at);
    document.getElementById('detailLastLogin').textContent = AdminUtils.formatDateTime(user.last_sign_in_at);
    
    const statusEl = document.getElementById('detailStatus');
    statusEl.textContent = ADMIN_CONFIG.USER_STATUSES[user.status] || 'Activo';
    statusEl.className = `status-badge ${user.status}`;

    // Add authentication method info
    const authMethodText = {
      'google': '🔍 Google',
      'facebook': '📘 Facebook',
      'email': '📧 Email/Contraseña',
      'unknown': '❓ Desconocido'
    }[user.auth_method] || '❓ Desconocido';
    
    // Create or update auth method display
    let authMethodEl = document.getElementById('detailAuthMethod');
    if (!authMethodEl) {
      // Add after last login if it doesn't exist
      const lastLoginEl = document.getElementById('detailLastLogin').parentElement;
      authMethodEl = document.createElement('div');
      authMethodEl.className = 'info-item';
      authMethodEl.innerHTML = '<label>Método de registro:</label><span id="detailAuthMethod"></span>';
      lastLoginEl.parentElement.insertBefore(authMethodEl, lastLoginEl.nextSibling);
      authMethodEl = authMethodEl.querySelector('#detailAuthMethod');
    }
    authMethodEl.textContent = authMethodText;

    // Subscription Information
    document.getElementById('detailSubscriptionType').textContent = 
      ADMIN_CONFIG.SUBSCRIPTION_TYPES[user.subscription_type] || 'Sin suscripción';
    document.getElementById('detailSubscriptionStatus').textContent = 
      user.subscription?.status || 'N/A';
    document.getElementById('detailExpiresAt').innerHTML = 
      user.subscription?.expires_at ? `
        ${AdminUtils.formatDateTime(user.subscription.expires_at)}
        ${new Date(user.subscription.expires_at) < new Date() ? '<span class="expired-badge">⚠️ EXPIRADA</span>' : '<span class="active-badge">✓ Activa</span>'}
      ` : 'N/A';

    // Usage Statistics  
    document.getElementById('detailPieceCount').textContent = user.piece_count;
    document.getElementById('detailVersionCount').textContent = user.version_count;
    document.getElementById('detailLastUsage').innerHTML = `
      ${user.last_piece_created ? AdminUtils.getRelativeTime(user.last_piece_created) : 'Nunca'}
      <div class="activity-score">
        Nivel de actividad: ${'🟢'.repeat(user.activity_score)}${'⚪'.repeat(3 - user.activity_score)}
      </div>
    `;

    // Add admin information section if user is admin
    let adminInfoEl = document.getElementById('adminInfoSection');
    if (user.is_admin && !adminInfoEl) {
      const modalBody = modal.querySelector('.modal-body');
      const adminSection = document.createElement('div');
      adminSection.id = 'adminInfoSection';
      adminSection.className = 'info-section admin-info';
      adminSection.innerHTML = `
        <h4>👑 Información de Administrador</h4>
        <div class="info-item">
          <label>Rol:</label>
          <span id="detailAdminRole"></span>
        </div>
        <div class="info-item">
          <label>Permisos:</label>
          <span id="detailAdminPermissions"></span>
        </div>
      `;
      modalBody.insertBefore(adminSection, modalBody.querySelector('.user-stats'));
    } else if (!user.is_admin && adminInfoEl) {
      adminInfoEl.remove();
    }

    if (user.is_admin) {
      document.getElementById('detailAdminRole').textContent = user.admin_role?.toUpperCase() || 'ADMIN';
      document.getElementById('detailAdminPermissions').textContent = 
        user.admin_permissions ? Object.keys(user.admin_permissions).join(', ') : 'Todos los permisos';
    }

    // Show modal
    modal.classList.add('active');

    // Bind modal action buttons
    this.bindUserDetailActions(user);
  }

  bindUserDetailActions(user) {
    const toggleStatusBtn = document.getElementById('toggleUserStatus');
    const resetPasswordBtn = document.getElementById('resetUserPassword');
    const viewPiecesBtn = document.getElementById('viewUserPieces');
    const exportDataBtn = document.getElementById('exportUserData');

    if (toggleStatusBtn) {
      toggleStatusBtn.onclick = () => {
        this.toggleUserStatus(user.id);
        this.closeUserDetailModal();
      };
    }

    if (resetPasswordBtn) {
      resetPasswordBtn.onclick = () => {
        this.resetUserPassword(user.email);
      };
    }

    if (viewPiecesBtn) {
      viewPiecesBtn.onclick = () => {
        this.viewUserPieces(user.id);
      };
    }

    if (exportDataBtn) {
      exportDataBtn.onclick = () => {
        this.exportUserData(user);
      };
    }
  }

  closeUserDetailModal() {
    const modal = document.getElementById('userDetailModal');
    modal?.classList.remove('active');
  }

  async toggleUserStatus(userId) {
    try {
      const user = this.users.find(u => u.id === userId);
      if (!user) return;

      const newStatus = user.status === 'disabled' ? 'active' : 'disabled';
      const action = newStatus === 'disabled' ? 'deshabilitar' : 'habilitar';

      const confirmed = confirm(`¿Está seguro de que desea ${action} este usuario?`);
      if (!confirmed) return;

      AdminUtils.showLoading();

      // Update user status in database (this would depend on your user management system)
      // For now, we'll just update the local state
      user.status = newStatus;

      this.renderUsers();
      AdminUtils.showToast(`Usuario ${action}do correctamente`, 'success');

    } catch (error) {
      AdminErrorHandler.handle(error, 'toggling user status');
    } finally {
      AdminUtils.hideLoading();
    }
  }

  async resetUserPassword(email) {
    if (!email || email === 'N/A') {
      AdminUtils.showToast('No se puede resetear la contraseña sin email', 'error');
      return;
    }

    try {
      AdminUtils.showLoading();

      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email);

      if (error) {
        throw error;
      }

      AdminUtils.showToast('Email de reset enviado correctamente', 'success');

    } catch (error) {
      AdminErrorHandler.handle(error, 'resetting password');
    } finally {
      AdminUtils.hideLoading();
    }
  }

  viewUserPieces(userId) {
    // This would navigate to a pieces view filtered by user
    // For now, just show a message
    AdminUtils.showToast('Funcionalidad de visualización de piezas en desarrollo', 'info');
  }

  exportUserData(user) {
    const userData = [{
      ID: user.id,
      Email: user.email || 'N/A',
      'Fecha Registro': AdminUtils.formatDateTime(user.created_at),
      'Último Acceso': AdminUtils.formatDateTime(user.last_sign_in_at),
      Estado: ADMIN_CONFIG.USER_STATUSES[user.status] || 'Activo',
      Suscripción: ADMIN_CONFIG.SUBSCRIPTION_TYPES[user.subscription_type] || 'N/A',
      'Piezas Creadas': user.piece_count,
      'Versiones': user.version_count
    }];

    AdminUtils.exportToCSV(userData, `usuario_${user.id}`);
  }

  async bulkAction(action) {
    if (this.selectedUsers.size === 0) {
      AdminUtils.showToast('No hay usuarios seleccionados', 'warning');
      return;
    }

    const userCount = this.selectedUsers.size;
    const actionText = action === 'enable' ? 'habilitar' : 'deshabilitar';

    const confirmed = confirm(
      `¿Está seguro de que desea ${actionText} ${userCount} usuario${userCount > 1 ? 's' : ''}?`
    );
    
    if (!confirmed) return;

    try {
      AdminUtils.showLoading();

      for (const userId of this.selectedUsers) {
        const user = this.users.find(u => u.id === userId);
        if (user) {
          user.status = action === 'enable' ? 'active' : 'disabled';
        }
      }

      this.selectedUsers.clear();
      this.renderUsers();

      AdminUtils.showToast(
        `${userCount} usuario${userCount > 1 ? 's' : ''} ${actionText}${userCount > 1 ? 's' : ''}`,
        'success'
      );

    } catch (error) {
      AdminErrorHandler.handle(error, 'bulk action');
    } finally {
      AdminUtils.hideLoading();
    }
  }

  exportUsers() {
    const dataToExport = this.filteredUsers.map(user => ({
      ID: user.id,
      Email: user.email || 'N/A',
      'Fecha Registro': AdminUtils.formatDateTime(user.created_at),
      'Último Acceso': AdminUtils.formatDateTime(user.last_sign_in_at),
      Estado: ADMIN_CONFIG.USER_STATUSES[user.status] || 'Activo',
      Suscripción: ADMIN_CONFIG.SUBSCRIPTION_TYPES[user.subscription_type] || 'N/A',
      'Piezas Creadas': user.piece_count,
      'Versiones': user.version_count
    }));

    AdminUtils.exportToCSV(dataToExport, 'usuarios_zetalab');
  }

  exportSelectedUsers() {
    if (this.selectedUsers.size === 0) {
      AdminUtils.showToast('No hay usuarios seleccionados para exportar', 'warning');
      return;
    }

    const selectedUserData = this.users
      .filter(user => this.selectedUsers.has(user.id))
      .map(user => ({
        ID: user.id,
        Email: user.email || 'N/A',
        'Fecha Registro': AdminUtils.formatDateTime(user.created_at),
        'Último Acceso': AdminUtils.formatDateTime(user.last_sign_in_at),
        Estado: ADMIN_CONFIG.USER_STATUSES[user.status] || 'Activo',
        Suscripción: ADMIN_CONFIG.SUBSCRIPTION_TYPES[user.subscription_type] || 'N/A',
        'Piezas Creadas': user.piece_count,
        'Versiones': user.version_count
      }));

    AdminUtils.exportToCSV(selectedUserData, 'usuarios_seleccionados');
  }
}

// Make available globally for button onclick handlers
window.adminUsers = new AdminUsers();

// Export for use in other modules
window.AdminUsers = window.adminUsers;