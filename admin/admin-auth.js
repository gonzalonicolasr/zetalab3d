/* ==============================
   ZETALAB Admin Authentication
   Secure admin login and session management
============================== */

class AdminAuth {
  constructor() {
    this.currentUser = null;
    this.isAuthenticated = false;
    this.loginModal = document.getElementById('loginModal');
    this.adminInterface = document.getElementById('adminInterface');
    this.loginForm = document.getElementById('adminLoginForm');
    this.loginError = document.getElementById('loginError');
    
    this.init();
  }

  init() {
    // Check for existing admin session
    this.checkAdminSession();
    
    // Bind events
    this.bindEvents();
  }

  bindEvents() {
    // Login form submission
    this.loginForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    // Logout button
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
      this.handleLogout();
    });

    // Handle Supabase auth state changes
    supabaseAdmin.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        this.handleAuthSuccess(session.user);
      } else if (event === 'SIGNED_OUT') {
        this.handleAuthFailure();
      }
    });
  }

  async checkAdminSession() {
    try {
      AdminUtils.showLoading();
      
      const { data: { session }, error } = await supabaseAdmin.auth.getSession();
      
      if (error) {
        console.error('Error checking session:', error);
        this.showLoginModal();
        return;
      }

      if (session?.user) {
        // Verify admin privileges
        const isAdmin = await this.verifyAdminPrivileges(session.user);
        if (isAdmin) {
          this.handleAuthSuccess(session.user);
        } else {
          this.showError('No tienes permisos de administrador');
          await this.handleLogout();
        }
      } else {
        this.showLoginModal();
      }
    } catch (error) {
      AdminErrorHandler.handle(error, 'checking admin session');
      this.showLoginModal();
    } finally {
      AdminUtils.hideLoading();
    }
  }

  async handleLogin() {
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;

    if (!email || !password) {
      this.showError('Por favor completa todos los campos');
      return;
    }

    try {
      this.setLoginLoading(true);
      this.hideError();

      // First check if email is in admin list
      if (!this.isEmailAdmin(email)) {
        this.showError('Email no autorizado para acceso de administrador');
        return;
      }

      // Attempt to sign in with Supabase
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) {
        console.error('Login error:', error);
        
        if (error.message.includes('Invalid login credentials')) {
          this.showError('Credenciales inválidas');
        } else if (error.message.includes('Email not confirmed')) {
          this.showError('Email no confirmado. Revisa tu bandeja de entrada.');
        } else {
          this.showError('Error de autenticación: ' + error.message);
        }
        return;
      }

      if (data.user) {
        // Additional admin verification
        const isAdmin = await this.verifyAdminPrivileges(data.user);
        if (!isAdmin) {
          this.showError('Usuario sin permisos de administrador');
          await supabaseAdmin.auth.signOut();
          return;
        }

        // Success - handled by auth state change listener
      }

    } catch (error) {
      AdminErrorHandler.handle(error, 'admin login');
      this.showError('Error inesperado durante el login');
    } finally {
      this.setLoginLoading(false);
    }
  }

  async handleLogout() {
    try {
      AdminUtils.showLoading();
      
      const { error } = await supabaseAdmin.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
      }
      
      this.handleAuthFailure();
      AdminUtils.showToast('Sesión cerrada correctamente', 'success');
      
    } catch (error) {
      AdminErrorHandler.handle(error, 'admin logout');
    } finally {
      AdminUtils.hideLoading();
    }
  }

  async verifyAdminPrivileges(user) {
    if (!user) return false;

    // Check if user is in admin configuration
    if (AdminUtils.isAdmin(user)) {
      return true;
    }

    // Additional database check - verify if user has admin role
    try {
      // Query user profile or admin table if you have one
      // This is where you'd check your custom admin table
      const { data, error } = await supabaseAdmin
        .from('user_profiles') // Assuming you have a profiles table
        .select('role, is_admin')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // Ignore "not found" errors
        console.error('Error checking admin privileges:', error);
        return false;
      }

      return data?.role === 'admin' || data?.is_admin === true;
    } catch (error) {
      console.error('Error verifying admin privileges:', error);
      return false;
    }
  }

  isEmailAdmin(email) {
    return ADMIN_CONFIG.ADMIN_DOMAINS.includes(email);
  }

  handleAuthSuccess(user) {
    this.currentUser = user;
    this.isAuthenticated = true;
    
    // Update UI
    this.hideLoginModal();
    this.showAdminInterface();
    
    // Update user display
    const userNameElement = document.getElementById('adminUserName');
    if (userNameElement) {
      userNameElement.textContent = user.email || 'Administrador';
    }

    // Initialize admin dashboard
    if (window.AdminDashboard) {
      window.AdminDashboard.init();
    }

    console.log('Admin authenticated successfully:', user.email);
  }

  handleAuthFailure() {
    this.currentUser = null;
    this.isAuthenticated = false;
    
    // Clear UI
    this.hideAdminInterface();
    this.showLoginModal();
    
    // Clear any cached data
    this.clearAdminData();
  }

  showLoginModal() {
    this.loginModal?.classList.add('active');
    this.adminInterface?.classList.add('hidden');
    
    // Focus email input
    setTimeout(() => {
      document.getElementById('adminEmail')?.focus();
    }, 300);
  }

  hideLoginModal() {
    this.loginModal?.classList.remove('active');
  }

  showAdminInterface() {
    this.adminInterface?.classList.remove('hidden');
  }

  hideAdminInterface() {
    this.adminInterface?.classList.add('hidden');
  }

  showError(message) {
    if (this.loginError) {
      this.loginError.textContent = message;
      this.loginError.classList.add('show');
      
      // Auto-hide error after 5 seconds
      setTimeout(() => {
        this.hideError();
      }, 5000);
    }
  }

  hideError() {
    if (this.loginError) {
      this.loginError.classList.remove('show');
    }
  }

  setLoginLoading(loading) {
    const loginBtn = document.querySelector('.btn-admin-login');
    if (loginBtn) {
      if (loading) {
        loginBtn.classList.add('loading');
        loginBtn.disabled = true;
      } else {
        loginBtn.classList.remove('loading');
        loginBtn.disabled = false;
      }
    }
  }

  clearAdminData() {
    // Clear any cached admin data
    // This would be implemented based on your data caching strategy
    console.log('Clearing admin data cache');
  }

  // Utility methods for other modules
  getCurrentUser() {
    return this.currentUser;
  }

  isAdminAuthenticated() {
    return this.isAuthenticated;
  }

  // Method to check if current user can perform specific admin actions
  canPerformAction(action) {
    if (!this.isAuthenticated || !this.currentUser) {
      return false;
    }

    // Define permission levels here
    const permissions = {
      'view_users': true,
      'edit_users': true,
      'delete_users': AdminUtils.isAdmin(this.currentUser),
      'view_analytics': true,
      'system_settings': AdminUtils.isAdmin(this.currentUser),
      'export_data': true
    };

    return permissions[action] || false;
  }
}

// Initialize admin authentication when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.adminAuth = new AdminAuth();
});

// Export for use in other modules
window.AdminAuth = AdminAuth;