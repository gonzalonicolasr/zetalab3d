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

      // Remove hardcoded email check - will verify against database after login

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
          // For admin users, offer to resend confirmation
          this.showError('Email no confirmado. ¿Reenviar confirmación?');
          this.offerResendConfirmation(email);
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

    try {
      // Use the database-driven admin check
      const isAdmin = await AdminUtils.isAdmin(user);
      
      if (isAdmin) {
        // Log admin login activity
        await AdminUtils.logAdminActivity('admin_login', 'admin', user.id);
        
        // Update last login timestamp
        await supabaseAdmin
          .from('admin_users')
          .update({ last_login_at: new Date().toISOString() })
          .eq('user_id', user.id);
          
        // Create admin session record
        await supabaseAdmin
          .from('admin_sessions')
          .insert({
            admin_id: (await AdminUtils.getAdminDetails(user))?.id,
            login_at: new Date().toISOString(),
            ip_address: null, // Could be enhanced with real IP
            user_agent: navigator.userAgent
          });
      }
      
      return isAdmin;
    } catch (error) {
      console.error('Error verifying admin privileges:', error);
      return false;
    }
  }

  // Legacy method - now checks database instead of hardcoded list
  async isEmailAdmin(email) {
    try {
      const { data, error } = await supabaseAdmin
        .from('admin_users')
        .select('id')
        .eq('email', email)
        .eq('active', true)
        .single();
        
      return !error && !!data;
    } catch (error) {
      console.error('Error checking admin email:', error);
      return false;
    }
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

  // Offer to resend confirmation email for unconfirmed admin accounts
  async offerResendConfirmation(email) {
    const resendBtn = document.createElement('button');
    resendBtn.textContent = 'Reenviar email de confirmación';
    resendBtn.className = 'btn-secondary btn-small mt-2';
    resendBtn.onclick = async () => {
      try {
        const { error } = await supabaseAdmin.auth.resend({
          type: 'signup',
          email: email
        });
        
        if (error) {
          this.showError('Error al reenviar: ' + error.message);
        } else {
          this.showError('Email de confirmación enviado. Revisa tu bandeja.');
          resendBtn.remove();
        }
      } catch (err) {
        this.showError('Error al reenviar confirmación');
      }
    };
    
    this.loginError.appendChild(resendBtn);
  }

  // Utility methods for other modules
  getCurrentUser() {
    return this.currentUser;
  }

  isAdminAuthenticated() {
    return this.isAuthenticated;
  }

  // Method to check if current user can perform specific admin actions
  async canPerformAction(action) {
    if (!this.isAuthenticated || !this.currentUser) {
      return false;
    }

    try {
      // Get admin details and permissions from database
      const adminDetails = await AdminUtils.getAdminDetails(this.currentUser);
      if (!adminDetails) return false;
      
      // Check specific permissions from database
      const hasPermission = await AdminUtils.hasPermission(this.currentUser, action);
      
      // For some actions, check role level
      if (action === 'admin_management' || action === 'system_settings') {
        return adminDetails.role === 'super_admin';
      }
      
      return hasPermission;
    } catch (error) {
      console.error('Error checking action permission:', error);
      return false;
    }
  }
}

// Initialize admin authentication when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.adminAuth = new AdminAuth();
});

// Export for use in other modules
window.AdminAuth = AdminAuth;