/* ==============================
   ZETALAB Admin Configuration
   Supabase setup and constants
============================== */

// Supabase configuration - same as main app
const SUPABASE_URL = "https://fwmyiovamcxvinoxnput.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3bXlpb3ZhbWN4dmlub3hucHV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzAzODksImV4cCI6MjA3MTc0NjM4OX0.x94-SZj7-BR9CGMzeujkjyk_7iItajoHKkGRgIYPUTc";

// Initialize Supabase client
const supabaseAdmin = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Admin configuration
const ADMIN_CONFIG = {
  // Legacy - now using database-driven admin verification
  // ADMIN_DOMAINS: ['gonn.nicolas@gmail.com', 'gonzalo@zetalab.com'], // DEPRECATED
  // ADMIN_USER_IDS: [], // DEPRECATED
  
  // Database-driven admin verification (replaces hardcoded domains)
  USE_DATABASE_ADMIN_CHECK: true,
  
  // Pagination settings
  USERS_PER_PAGE: 25,
  DEFAULT_PAGE_SIZE: 25,
  
  // Date formats
  DATE_FORMAT: 'YYYY-MM-DD',
  DATETIME_FORMAT: 'YYYY-MM-DD HH:mm:ss',
  
  // Status mappings
  USER_STATUSES: {
    'active': 'Activo',
    'trial': 'En Prueba',
    'expired': 'Expirado',
    'disabled': 'Deshabilitado'
  },
  
  SUBSCRIPTION_TYPES: {
    'premium': 'Premium',
    'basic': 'Básico',
    'trial': 'Prueba',
    'none': 'Sin Suscripción'
  },
  
  // Chart colors
  CHART_COLORS: {
    primary: '#4f9a65',
    secondary: '#10b981',
    tertiary: '#34d399',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6'
  }
};

// Utility functions
const AdminUtils = {
  // Format date for display
  formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  // Format datetime for display
  formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('es-AR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  // Format currency
  formatCurrency(amount) {
    if (!amount || isNaN(amount)) return '$0';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(amount);
  },

  // Format number with thousands separator
  formatNumber(num) {
    if (!num || isNaN(num)) return '0';
    return num.toLocaleString('es-AR');
  },

  // Get relative time (e.g., "hace 2 días")
  getRelativeTime(dateString) {
    if (!dateString) return '-';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffTime / (1000 * 60));

    if (diffDays > 0) {
      return `hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      return `hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    } else if (diffMinutes > 0) {
      return `hace ${diffMinutes} minuto${diffMinutes > 1 ? 's' : ''}`;
    } else {
      return 'hace un momento';
    }
  },

  // Check if user is admin (database-driven)
  async isAdmin(user) {
    if (!user) return false;
    
    try {
      // Query admin_users table to verify admin status
      const { data: adminUser, error } = await supabaseAdmin
        .from('admin_users')
        .select('id, role, active, permissions')
        .eq('user_id', user.id)
        .eq('active', true)
        .single();
        
      if (error && error.code !== 'PGRST116') {
        console.error('Error checking admin status:', error);
        return false;
      }
      
      return !!adminUser;
    } catch (error) {
      console.error('Admin verification error:', error);
      return false;
    }
  },

  // Get admin details and permissions
  async getAdminDetails(user) {
    if (!user) return null;
    
    try {
      const { data: adminUser, error } = await supabaseAdmin
        .from('admin_users')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true)
        .single();
        
      if (error && error.code !== 'PGRST116') {
        console.error('Error getting admin details:', error);
        return null;
      }
      
      return adminUser;
    } catch (error) {
      console.error('Admin details error:', error);
      return null;
    }
  },

  // Check specific admin permission
  async hasPermission(user, permission) {
    const adminDetails = await this.getAdminDetails(user);
    if (!adminDetails) return false;
    
    return adminDetails.permissions?.[permission] === true;
  },

  // Log admin activity
  async logAdminActivity(action, resourceType, resourceId = null, details = null) {
    try {
      const { error } = await supabaseAdmin.rpc('log_admin_activity', {
        action_name: action,
        resource_type_name: resourceType,
        resource_uuid: resourceId,
        details_json: details,
        user_ip: null // Could be enhanced to capture real IP
      });
      
      if (error) {
        console.error('Error logging admin activity:', error);
      }
    } catch (error) {
      console.error('Admin activity logging error:', error);
    }
  },

  // Generate random color for charts
  generateRandomColor() {
    const colors = Object.values(ADMIN_CONFIG.CHART_COLORS);
    return colors[Math.floor(Math.random() * colors.length)];
  },

  // Debounce function for search
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Show loading state
  showLoading(element) {
    if (element) {
      element.style.opacity = '0.5';
      element.style.pointerEvents = 'none';
    }
    document.getElementById('loadingOverlay')?.classList.remove('hidden');
  },

  // Hide loading state
  hideLoading(element) {
    if (element) {
      element.style.opacity = '1';
      element.style.pointerEvents = 'auto';
    }
    document.getElementById('loadingOverlay')?.classList.add('hidden');
  },

  // Show toast notification
  showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Style the toast
    Object.assign(toast.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      padding: '12px 24px',
      backgroundColor: type === 'error' ? '#ef4444' : 
                      type === 'success' ? '#10b981' : 
                      type === 'warning' ? '#f59e0b' : '#4f9a65',
      color: 'white',
      borderRadius: '8px',
      zIndex: '10000',
      opacity: '0',
      transform: 'translateX(100%)',
      transition: 'all 0.3s ease'
    });
    
    document.body.appendChild(toast);
    
    // Show toast
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(0)';
    }, 100);
    
    // Hide and remove toast
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  },

  // Export data to CSV
  exportToCSV(data, filename) {
    if (!data || data.length === 0) {
      this.showToast('No hay datos para exportar', 'warning');
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header];
        // Escape commas and quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    this.showToast('Datos exportados correctamente', 'success');
  },

  // Copy text to clipboard
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('Copiado al portapapeles', 'success');
    } catch (err) {
      this.showToast('Error al copiar', 'error');
    }
  },

  // Confirm action dialog
  confirmAction(message, callback) {
    if (confirm(message)) {
      callback();
    }
  }
};

// Error handling
const AdminErrorHandler = {
  handle(error, context = '') {
    console.error(`Admin Error ${context}:`, error);
    
    let message = 'Ha ocurrido un error inesperado';
    
    if (error.message) {
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
    }
    
    // Show user-friendly message
    AdminUtils.showToast(message, 'error');
  },

  // Handle Supabase errors specifically
  handleSupabaseError(error, context = '') {
    console.error(`Supabase Error ${context}:`, error);
    
    let message = 'Error de conexión con la base de datos';
    
    if (error.code === 'PGRST301') {
      message = 'No tienes permisos para realizar esta acción';
    } else if (error.code === '23505') {
      message = 'Ya existe un registro con estos datos';
    } else if (error.message) {
      message = error.message;
    }
    
    AdminUtils.showToast(message, 'error');
  }
};

// Global error handler
window.addEventListener('error', (event) => {
  AdminErrorHandler.handle(event.error, 'Global');
});

window.addEventListener('unhandledrejection', (event) => {
  AdminErrorHandler.handle(event.reason, 'Promise Rejection');
});

// Export for use in other modules
window.AdminConfig = {
  supabaseAdmin,
  ADMIN_CONFIG,
  AdminUtils,
  AdminErrorHandler
};