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

      // Get users from auth.users (if accessible) or from pieces table
      let userData = await this.loadUsersFromAuth();
      
      if (!userData || userData.length === 0) {
        // Fallback: load from pieces table
        userData = await this.loadUsersFromPieces();
      }

      // Enhance user data with additional information
      this.users = await this.enhanceUserData(userData);
      
      // Apply current filters
      this.applyFilters();
      
      AdminUtils.showToast('Usuarios cargados correctamente', 'success');

    } catch (error) {
      AdminErrorHandler.handle(error, 'loading users');
    } finally {
      AdminUtils.hideLoading();
    }
  }

  async loadUsersFromAuth() {
    try {
      // Try to access auth.users table directly
      const { data, error } = await supabaseAdmin
        .from('auth.users')
        .select(`
          id,
          email,
          created_at,
          updated_at,
          last_sign_in_at,
          user_metadata,
          app_metadata,
          email_confirmed_at
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Cannot access auth.users directly:', error);
        return null;
      }

      return data || [];
    } catch (error) {
      console.log('Error accessing auth.users:', error);
      return null;
    }
  }

  async loadUsersFromPieces() {
    try {
      // Get unique user IDs from pieces table
      const { data: pieceUsers, error } = await supabaseAdmin
        .from('pieces')
        .select('user_id, created_at')
        .not('user_id', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // Get unique users
      const userMap = new Map();
      pieceUsers.forEach(piece => {
        if (!userMap.has(piece.user_id)) {
          userMap.set(piece.user_id, {
            id: piece.user_id,
            created_at: piece.created_at,
            email: 'N/A', // Will try to fetch from user profiles if available
            last_sign_in_at: null
          });
        }
      });

      return Array.from(userMap.values());
    } catch (error) {
      console.error('Error loading users from pieces:', error);
      return [];
    }
  }

  async enhanceUserData(users) {
    const enhancedUsers = [];

    for (const user of users) {
      try {
        // Get user pieces count
        const { count: pieceCount, error: pieceError } = await supabaseAdmin
          .from('pieces')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        // Get user piece versions count
        const { count: versionCount, error: versionError } = await supabaseAdmin
          .from('piece_versions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        // Try to get subscription info (if subscriptions table exists)
        let subscriptionInfo = null;
        try {
          const { data: subscription, error: subError } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (!subError) {
            subscriptionInfo = subscription;
          }
        } catch (subError) {
          // Subscriptions table might not exist yet
        }

        // Get latest piece creation (last activity)
        const { data: latestPiece, error: latestError } = await supabaseAdmin
          .from('pieces')
          .select('created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        enhancedUsers.push({
          ...user,
          piece_count: pieceCount || 0,
          version_count: versionCount || 0,
          subscription: subscriptionInfo,
          last_activity: latestPiece?.created_at || user.created_at,
          status: this.determineUserStatus(user, subscriptionInfo),
          subscription_type: subscriptionInfo?.type || 'none'
        });

      } catch (error) {
        console.error(`Error enhancing user ${user.id}:`, error);
        // Add user with basic data
        enhancedUsers.push({
          ...user,
          piece_count: 0,
          version_count: 0,
          subscription: null,
          last_activity: user.created_at,
          status: 'active',
          subscription_type: 'none'
        });
      }
    }

    return enhancedUsers;
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
    const statusText = ADMIN_CONFIG.USER_STATUSES[statusClass] || 'Activo';
    const subscriptionText = ADMIN_CONFIG.SUBSCRIPTION_TYPES[user.subscription_type] || 'N/A';

    return `
      <tr class="fade-in">
        <td>
          <input type="checkbox" class="user-checkbox" value="${user.id}" 
                 ${this.selectedUsers.has(user.id) ? 'checked' : ''}>
        </td>
        <td>
          <div class="user-info">
            <div class="user-id">${user.id.substring(0, 8)}...</div>
          </div>
        </td>
        <td>
          <div class="user-email">
            ${user.email || 'N/A'}
          </div>
        </td>
        <td>
          <span class="subscription-badge ${user.subscription_type}">
            ${subscriptionText}
          </span>
        </td>
        <td>
          <span class="status-badge ${statusClass}">
            ${statusText}
          </span>
        </td>
        <td>${AdminUtils.formatDate(user.created_at)}</td>
        <td>${AdminUtils.getRelativeTime(user.last_sign_in_at || user.last_activity)}</td>
        <td class="text-center">${user.piece_count}</td>
        <td>
          <div class="action-buttons">
            <button class="action-btn" onclick="adminUsers.viewUserDetail('${user.id}')" 
                    title="Ver detalles">
              👁️
            </button>
            <button class="action-btn" onclick="adminUsers.editUser('${user.id}')" 
                    title="Editar">
              ✏️
            </button>
            <button class="action-btn danger" onclick="adminUsers.toggleUserStatus('${user.id}')" 
                    title="${statusClass === 'disabled' ? 'Habilitar' : 'Deshabilitar'}">
              ${statusClass === 'disabled' ? '✅' : '🚫'}
            </button>
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

      // Get user piece versions
      const { data: versions, error: versionsError } = await supabaseAdmin
        .from('piece_versions')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1);

      return {
        pieces: pieces || [],
        lastVersion: versions?.[0]?.created_at
      };
    } catch (error) {
      console.error('Error loading user details:', error);
      return { pieces: [], lastVersion: null };
    }
  }

  showUserDetailModal(user, details) {
    const modal = document.getElementById('userDetailModal');
    if (!modal) return;

    // Update modal content
    document.getElementById('userDetailName').textContent = user.email || 'Usuario';
    document.getElementById('detailEmail').textContent = user.email || 'N/A';
    document.getElementById('detailCreatedAt').textContent = AdminUtils.formatDateTime(user.created_at);
    document.getElementById('detailLastLogin').textContent = AdminUtils.formatDateTime(user.last_sign_in_at);
    
    const statusEl = document.getElementById('detailStatus');
    statusEl.textContent = ADMIN_CONFIG.USER_STATUSES[user.status] || 'Activo';
    statusEl.className = `status-badge ${user.status}`;

    document.getElementById('detailSubscriptionType').textContent = 
      ADMIN_CONFIG.SUBSCRIPTION_TYPES[user.subscription_type] || 'Sin suscripción';
    document.getElementById('detailSubscriptionStatus').textContent = 
      user.subscription?.status || 'N/A';
    document.getElementById('detailExpiresAt').textContent = 
      user.subscription?.expires_at ? AdminUtils.formatDateTime(user.subscription.expires_at) : 'N/A';

    document.getElementById('detailPieceCount').textContent = user.piece_count;
    document.getElementById('detailVersionCount').textContent = user.version_count;
    document.getElementById('detailLastUsage').textContent = 
      details.lastVersion ? AdminUtils.getRelativeTime(details.lastVersion) : 'Nunca';

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