/* ==============================
   ZETALAB Admin User Management
   Manage admin users and permissions
============================== */

class AdminManagement {
  constructor() {
    this.admins = [];
    this.currentPage = 1;
    this.totalPages = 1;
    this.searchTerm = '';
    this.sortBy = 'created_at';
    this.sortOrder = 'desc';
    
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadAdmins();
  }

  bindEvents() {
    // Add admin button
    document.getElementById('addAdminBtn')?.addEventListener('click', () => {
      this.showAddAdminModal();
    });

    // Search input
    const searchInput = document.getElementById('adminSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', AdminUtils.debounce((e) => {
        this.searchTerm = e.target.value.toLowerCase();
        this.currentPage = 1;
        this.loadAdmins();
      }, 300));
    }

    // Sort dropdown
    document.getElementById('adminSortBy')?.addEventListener('change', (e) => {
      this.sortBy = e.target.value;
      this.loadAdmins();
    });

    // Sort order toggle
    document.getElementById('sortOrderToggle')?.addEventListener('click', (e) => {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
      e.target.textContent = this.sortOrder === 'asc' ? '↑' : '↓';
      this.loadAdmins();
    });

    // Modal events
    document.getElementById('addAdminForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleAddAdmin();
    });

    document.getElementById('editAdminForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleEditAdmin();
    });

    // Close modal buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        this.closeModals();
      });
    });
  }

  async loadAdmins() {
    try {
      AdminUtils.showLoading();
      
      let query = supabaseAdmin
        .from('admin_users')
        .select(`
          *,
          created_by_admin:created_by(email),
          admin_sessions!inner(login_at)
        `)
        .order(this.sortBy, { ascending: this.sortOrder === 'asc' });

      // Apply search filter
      if (this.searchTerm) {
        query = query.or(`email.ilike.%${this.searchTerm}%,notes.ilike.%${this.searchTerm}%`);
      }

      // Apply pagination
      const from = (this.currentPage - 1) * ADMIN_CONFIG.USERS_PER_PAGE;
      const to = from + ADMIN_CONFIG.USERS_PER_PAGE - 1;
      
      const { data: admins, error, count } = await query
        .range(from, to);

      if (error) {
        throw error;
      }

      this.admins = admins || [];
      this.totalPages = Math.ceil(count / ADMIN_CONFIG.USERS_PER_PAGE);
      
      this.renderAdminsTable();
      this.renderPagination();
      
    } catch (error) {
      AdminErrorHandler.handleSupabaseError(error, 'loading admins');
    } finally {
      AdminUtils.hideLoading();
    }
  }

  renderAdminsTable() {
    const tbody = document.getElementById('adminsTableBody');
    if (!tbody) return;

    if (this.admins.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center py-8 text-gray-500">
            <div class="flex flex-col items-center">
              <svg class="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.196-2.121M9 20H4v-2a3 3 0 015.196-2.121M15 10a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <p>No se encontraron administradores</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.admins.map(admin => `
      <tr class="admin-row" data-admin-id="${admin.id}">
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="flex items-center">
            <div class="flex-shrink-0 h-10 w-10">
              <div class="h-10 w-10 rounded-full bg-gradient-to-r from-green-400 to-blue-500 flex items-center justify-center">
                <span class="text-white font-medium text-sm">
                  ${admin.email.charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
            <div class="ml-4">
              <div class="text-sm font-medium text-gray-900">
                ${admin.email}
              </div>
              <div class="text-sm text-gray-500">
                ${admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
              </div>
            </div>
          </div>
        </td>
        
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
            admin.role === 'super_admin' 
              ? 'bg-purple-100 text-purple-800' 
              : 'bg-green-100 text-green-800'
          }">
            ${admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
          </span>
        </td>
        
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
            admin.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }">
            ${admin.active ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          ${this.renderPermissionsBadges(admin.permissions)}
        </td>
        
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          ${admin.last_login_at ? AdminUtils.formatDateTime(admin.last_login_at) : 'Nunca'}
        </td>
        
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          ${AdminUtils.formatDateTime(admin.created_at)}
        </td>
        
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <div class="flex space-x-2">
            <button onclick="adminManagement.editAdmin('${admin.id}')" 
                    class="text-indigo-600 hover:text-indigo-900 transition-colors">
              Editar
            </button>
            <button onclick="adminManagement.toggleAdminStatus('${admin.id}', ${!admin.active})" 
                    class="${admin.active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'} transition-colors">
              ${admin.active ? 'Desactivar' : 'Activar'}
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  renderPermissionsBadges(permissions) {
    if (!permissions || typeof permissions !== 'object') {
      return '<span class="text-gray-400">Sin permisos</span>';
    }

    const permissionLabels = {
      users: 'Usuarios',
      subscriptions: 'Suscripciones',
      analytics: 'Análisis',
      admin_management: 'Admin'
    };

    return Object.entries(permissions)
      .filter(([key, value]) => value === true)
      .map(([key]) => `
        <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-1 mb-1">
          ${permissionLabels[key] || key}
        </span>
      `).join('');
  }

  renderPagination() {
    const pagination = document.getElementById('adminsPagination');
    if (!pagination || this.totalPages <= 1) {
      pagination.innerHTML = '';
      return;
    }

    const pages = [];
    const maxVisible = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisible - 1);

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    // Previous button
    pages.push(`
      <button ${this.currentPage === 1 ? 'disabled' : ''} 
              onclick="adminManagement.goToPage(${this.currentPage - 1})"
              class="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
        Anterior
      </button>
    `);

    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
      pages.push(`
        <button onclick="adminManagement.goToPage(${i})"
                class="px-3 py-2 text-sm ${
                  i === this.currentPage 
                    ? 'bg-indigo-600 text-white' 
                    : 'text-gray-700 hover:text-indigo-600'
                } rounded-md transition-colors">
          ${i}
        </button>
      `);
    }

    // Next button
    pages.push(`
      <button ${this.currentPage === this.totalPages ? 'disabled' : ''} 
              onclick="adminManagement.goToPage(${this.currentPage + 1})"
              class="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
        Siguiente
      </button>
    `);

    pagination.innerHTML = `
      <div class="flex justify-center items-center space-x-1">
        ${pages.join('')}
      </div>
    `;
  }

  goToPage(page) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadAdmins();
    }
  }

  showAddAdminModal() {
    const modal = document.getElementById('addAdminModal');
    if (modal) {
      modal.classList.add('active');
      document.getElementById('adminEmail')?.focus();
    }
  }

  closeModals() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.classList.remove('active');
    });
    
    // Clear forms
    document.getElementById('addAdminForm')?.reset();
    document.getElementById('editAdminForm')?.reset();
  }

  async handleAddAdmin() {
    const form = document.getElementById('addAdminForm');
    const formData = new FormData(form);
    
    const adminData = {
      email: formData.get('email').trim(),
      role: formData.get('role'),
      permissions: {
        users: formData.has('perm_users'),
        subscriptions: formData.has('perm_subscriptions'),
        analytics: formData.has('perm_analytics'),
        admin_management: formData.has('perm_admin_management')
      },
      notes: formData.get('notes')?.trim() || null
    };

    if (!adminData.email) {
      AdminUtils.showToast('El email es requerido', 'error');
      return;
    }

    try {
      AdminUtils.showLoading();
      
      // First check if user exists in auth.users
      const { data: existingUsers, error: userError } = await supabaseAdmin
        .from('auth.users')
        .select('id, email')
        .eq('email', adminData.email)
        .single();

      if (userError && userError.code !== 'PGRST116') {
        throw new Error('Error verificando usuario: ' + userError.message);
      }

      if (!existingUsers) {
        AdminUtils.showToast('El usuario debe registrarse primero en la aplicación', 'error');
        return;
      }

      // Add user_id to admin data
      adminData.user_id = existingUsers.id;
      
      // Get current admin ID for created_by field
      const currentAdmin = await AdminUtils.getAdminDetails(window.adminAuth.getCurrentUser());
      if (currentAdmin) {
        adminData.created_by = currentAdmin.id;
      }

      // Insert admin user
      const { error } = await supabaseAdmin
        .from('admin_users')
        .insert(adminData);

      if (error) {
        if (error.code === '23505') {
          AdminUtils.showToast('Este usuario ya es administrador', 'error');
        } else {
          throw error;
        }
        return;
      }

      // Log activity
      await AdminUtils.logAdminActivity('admin_created', 'admin', existingUsers.id, {
        email: adminData.email,
        role: adminData.role
      });

      AdminUtils.showToast('Administrador agregado exitosamente', 'success');
      this.closeModals();
      this.loadAdmins();
      
    } catch (error) {
      AdminErrorHandler.handleSupabaseError(error, 'adding admin');
    } finally {
      AdminUtils.hideLoading();
    }
  }

  async editAdmin(adminId) {
    try {
      const admin = this.admins.find(a => a.id === adminId);
      if (!admin) return;

      // Populate edit form
      document.getElementById('editAdminId').value = adminId;
      document.getElementById('editAdminEmail').value = admin.email;
      document.getElementById('editAdminRole').value = admin.role;
      document.getElementById('editAdminNotes').value = admin.notes || '';
      
      // Set permissions checkboxes
      Object.entries(admin.permissions || {}).forEach(([key, value]) => {
        const checkbox = document.getElementById(`editPerm_${key}`);
        if (checkbox) {
          checkbox.checked = value === true;
        }
      });

      // Show modal
      document.getElementById('editAdminModal')?.classList.add('active');
      
    } catch (error) {
      AdminErrorHandler.handle(error, 'editing admin');
    }
  }

  async handleEditAdmin() {
    const form = document.getElementById('editAdminForm');
    const formData = new FormData(form);
    const adminId = formData.get('adminId');
    
    const updateData = {
      role: formData.get('role'),
      permissions: {
        users: formData.has('editPerm_users'),
        subscriptions: formData.has('editPerm_subscriptions'), 
        analytics: formData.has('editPerm_analytics'),
        admin_management: formData.has('editPerm_admin_management')
      },
      notes: formData.get('notes')?.trim() || null
    };

    try {
      AdminUtils.showLoading();
      
      const { error } = await supabaseAdmin
        .from('admin_users')
        .update(updateData)
        .eq('id', adminId);

      if (error) {
        throw error;
      }

      // Log activity
      await AdminUtils.logAdminActivity('admin_updated', 'admin', adminId, updateData);

      AdminUtils.showToast('Administrador actualizado exitosamente', 'success');
      this.closeModals();
      this.loadAdmins();
      
    } catch (error) {
      AdminErrorHandler.handleSupabaseError(error, 'updating admin');
    } finally {
      AdminUtils.hideLoading();
    }
  }

  async toggleAdminStatus(adminId, newStatus) {
    const admin = this.admins.find(a => a.id === adminId);
    if (!admin) return;

    const action = newStatus ? 'activar' : 'desactivar';
    
    AdminUtils.confirmAction(
      `¿Estás seguro de que deseas ${action} a ${admin.email}?`,
      async () => {
        try {
          AdminUtils.showLoading();
          
          const { error } = await supabaseAdmin
            .from('admin_users')
            .update({ active: newStatus })
            .eq('id', adminId);

          if (error) {
            throw error;
          }

          // Log activity
          await AdminUtils.logAdminActivity(
            newStatus ? 'admin_activated' : 'admin_deactivated', 
            'admin', 
            adminId, 
            { email: admin.email }
          );

          AdminUtils.showToast(
            `Administrador ${newStatus ? 'activado' : 'desactivado'} exitosamente`, 
            'success'
          );
          this.loadAdmins();
          
        } catch (error) {
          AdminErrorHandler.handleSupabaseError(error, 'updating admin status');
        } finally {
          AdminUtils.hideLoading();
        }
      }
    );
  }

  // Export admins data
  exportAdmins() {
    const exportData = this.admins.map(admin => ({
      email: admin.email,
      role: admin.role,
      active: admin.active ? 'Activo' : 'Inactivo',
      permissions: Object.entries(admin.permissions || {})
        .filter(([key, value]) => value)
        .map(([key]) => key)
        .join(', '),
      last_login: admin.last_login_at || 'Nunca',
      created_at: AdminUtils.formatDateTime(admin.created_at),
      notes: admin.notes || ''
    }));

    AdminUtils.exportToCSV(exportData, `admins_${new Date().toISOString().split('T')[0]}`);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if we're on the admin management page
  if (document.getElementById('adminsTableBody')) {
    window.adminManagement = new AdminManagement();
  }
});

// Export for global access
window.AdminManagement = AdminManagement;