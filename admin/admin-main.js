/* ==============================
   ZETALAB Admin Main Controller
   Orchestrates all admin components
============================== */

class AdminMain {
  constructor() {
    this.isInitialized = false;
    this.currentSection = 'dashboard';
    this.components = {
      auth: null,
      dashboard: null,
      users: null,
      charts: null
    };
  }

  // Initialize the admin panel
  async init() {
    if (this.isInitialized) return;

    console.log('Initializing ZETALAB Admin Panel...');

    try {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }

      // Initialize components in order
      await this.initializeComponents();

      // Set up global event listeners
      this.setupGlobalEvents();

      // Set up keyboard shortcuts
      this.setupKeyboardShortcuts();

      // Set up periodic tasks
      this.setupPeriodicTasks();

      this.isInitialized = true;
      console.log('ZETALAB Admin Panel initialized successfully');

    } catch (error) {
      console.error('Failed to initialize admin panel:', error);
      AdminErrorHandler.handle(error, 'initializing admin panel');
    }
  }

  async initializeComponents() {
    // Authentication is already initialized by admin-auth.js
    this.components.auth = window.adminAuth;

    // Initialize charts component
    if (window.AdminCharts) {
      this.components.charts = window.AdminCharts;
      this.components.charts.init();
    }

    // Dashboard and Users will be initialized when first accessed
    this.components.dashboard = window.AdminDashboard;
    this.components.users = window.AdminUsers;
  }

  setupGlobalEvents() {
    // Handle browser back/forward
    window.addEventListener('popstate', (e) => {
      if (e.state && e.state.section) {
        this.switchToSection(e.state.section, false);
      }
    });

    // Handle window resize for responsive charts
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.handleWindowResize();
      }, 250);
    });

    // Handle visibility change (page focus/blur)
    document.addEventListener('visibilitychange', () => {
      this.handleVisibilityChange();
    });

    // Global error handler for unhandled clicks
    document.addEventListener('click', (e) => {
      this.handleGlobalClick(e);
    });

    // Handle escape key to close modals
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllModals();
      }
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Only handle shortcuts if user is authenticated and no modals are open
      if (!this.components.auth?.isAdminAuthenticated()) return;
      if (document.querySelector('.modal.active')) return;

      // Handle Ctrl/Cmd + key combinations
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case '1':
            e.preventDefault();
            this.switchToSection('dashboard');
            break;
          case '2':
            e.preventDefault();
            this.switchToSection('users');
            break;
          case '3':
            e.preventDefault();
            this.switchToSection('subscriptions');
            break;
          case '4':
            e.preventDefault();
            this.switchToSection('analytics');
            break;
          case '5':
            e.preventDefault();
            this.switchToSection('pieces');
            break;
          case '6':
            e.preventDefault();
            this.switchToSection('system');
            break;
          case 'r':
            e.preventDefault();
            this.refreshCurrentSection();
            break;
          case 'e':
            e.preventDefault();
            this.exportCurrentSectionData();
            break;
        }
      }

      // Handle single key shortcuts
      switch (e.key) {
        case 'F5':
          // Allow normal F5 refresh
          break;
        case '?':
          if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            this.showKeyboardShortcuts();
          }
          break;
      }
    });
  }

  setupPeriodicTasks() {
    // Refresh dashboard data every 5 minutes
    setInterval(() => {
      if (this.currentSection === 'dashboard' && this.components.dashboard) {
        this.components.dashboard.loadDashboardData();
      }
    }, 5 * 60 * 1000);

    // Update charts every 10 minutes
    setInterval(() => {
      if (this.components.charts) {
        this.components.charts.updateAllCharts();
      }
    }, 10 * 60 * 1000);

    // Clean up expired sessions every hour
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60 * 60 * 1000);
  }

  // Section switching
  switchToSection(sectionName, pushState = true) {
    if (sectionName === this.currentSection) return;

    console.log(`Switching to section: ${sectionName}`);

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
    this.initializeSection(sectionName);

    // Update browser history
    if (pushState) {
      history.pushState(
        { section: sectionName },
        `ZETALAB Admin - ${this.getSectionTitle(sectionName)}`,
        `#${sectionName}`
      );
    }

    this.currentSection = sectionName;

    // Track section view (for analytics)
    this.trackSectionView(sectionName);
  }

  async initializeSection(sectionName) {
    try {
      switch (sectionName) {
        case 'dashboard':
          if (this.components.dashboard && !this.components.dashboard.initialized) {
            await this.components.dashboard.init();
          }
          break;

        case 'users':
          if (this.components.users && !this.components.users.initialized) {
            await this.components.users.init();
          }
          break;

        case 'subscriptions':
          // Initialize subscriptions component when ready
          this.showComingSoonMessage('Gestión de Suscripciones');
          break;

        case 'analytics':
          // Initialize analytics component when ready
          this.showComingSoonMessage('Analíticas Avanzadas');
          break;

        case 'pieces':
          // Initialize pieces component when ready
          this.showComingSoonMessage('Gestión de Piezas');
          break;

        case 'system':
          // Initialize system component when ready
          this.showComingSoonMessage('Configuración del Sistema');
          break;

        default:
          console.warn(`Unknown section: ${sectionName}`);
      }
    } catch (error) {
      console.error(`Error initializing section ${sectionName}:`, error);
      AdminErrorHandler.handle(error, `initializing ${sectionName} section`);
    }
  }

  // Event handlers
  handleWindowResize() {
    // Resize charts if they exist
    if (this.components.charts) {
      Object.values(this.components.charts.charts).forEach(chart => {
        if (chart && typeof chart.resize === 'function') {
          chart.resize();
        }
      });
    }

    // Handle responsive layout changes
    this.handleResponsiveLayout();
  }

  handleVisibilityChange() {
    if (document.hidden) {
      console.log('Admin panel hidden - pausing real-time updates');
      this.pauseRealTimeUpdates();
    } else {
      console.log('Admin panel visible - resuming real-time updates');
      this.resumeRealTimeUpdates();
    }
  }

  handleGlobalClick(e) {
    // Handle clicks outside dropdowns to close them
    if (!e.target.closest('.dropdown')) {
      this.closeAllDropdowns();
    }

    // Handle navigation clicks
    if (e.target.closest('.nav-item')) {
      const navItem = e.target.closest('.nav-item');
      const section = navItem.dataset.section;
      if (section) {
        this.switchToSection(section);
      }
    }

    // Handle modal backdrop clicks
    if (e.target.classList.contains('modal')) {
      e.target.classList.remove('active');
    }
  }

  // Utility methods
  refreshCurrentSection() {
    console.log(`Refreshing section: ${this.currentSection}`);

    switch (this.currentSection) {
      case 'dashboard':
        if (this.components.dashboard) {
          this.components.dashboard.refreshDashboard();
        }
        break;

      case 'users':
        if (this.components.users) {
          this.components.users.loadUsers();
        }
        break;

      default:
        AdminUtils.showToast('Sección actualizada', 'info');
    }
  }

  exportCurrentSectionData() {
    console.log(`Exporting data for section: ${this.currentSection}`);

    switch (this.currentSection) {
      case 'dashboard':
        this.exportDashboardData();
        break;

      case 'users':
        if (this.components.users) {
          this.components.users.exportUsers();
        }
        break;

      default:
        AdminUtils.showToast('Exportación no disponible para esta sección', 'warning');
    }
  }

  exportDashboardData() {
    if (!this.components.dashboard) return;

    const dashboardData = [{
      'Total Usuarios': this.components.dashboard.stats.totalUsers,
      'Suscripciones Activas': this.components.dashboard.stats.activeSubscriptions,
      'Total Piezas': this.components.dashboard.stats.totalPieces,
      'Ingresos Mensuales': AdminUtils.formatCurrency(this.components.dashboard.stats.monthlyRevenue),
      'Fecha Exportación': new Date().toLocaleString('es-AR')
    }];

    AdminUtils.exportToCSV(dashboardData, 'dashboard_zetalab');
  }

  showComingSoonMessage(sectionTitle) {
    AdminUtils.showToast(`${sectionTitle} - Próximamente disponible`, 'info');
  }

  getSectionTitle(sectionName) {
    const titles = {
      dashboard: 'Panel de Control',
      users: 'Usuarios',
      subscriptions: 'Suscripciones',
      analytics: 'Analíticas',
      pieces: 'Piezas',
      system: 'Sistema'
    };
    return titles[sectionName] || sectionName;
  }

  trackSectionView(sectionName) {
    // Here you could track analytics, page views, etc.
    console.log(`Section viewed: ${sectionName}`);
  }

  // Modal management
  closeAllModals() {
    document.querySelectorAll('.modal.active').forEach(modal => {
      modal.classList.remove('active');
    });
  }

  closeAllDropdowns() {
    document.querySelectorAll('.dropdown.active').forEach(dropdown => {
      dropdown.classList.remove('active');
    });
  }

  // Real-time updates
  pauseRealTimeUpdates() {
    // Pause any real-time update intervals
    if (this.components.dashboard?.refreshInterval) {
      clearInterval(this.components.dashboard.refreshInterval);
    }
  }

  resumeRealTimeUpdates() {
    // Resume real-time updates
    if (this.components.dashboard) {
      this.components.dashboard.setupAutoRefresh();
    }
  }

  // Responsive layout
  handleResponsiveLayout() {
    const width = window.innerWidth;
    const adminInterface = document.querySelector('.admin-interface');

    if (width < 1024) {
      adminInterface?.classList.add('mobile-layout');
    } else {
      adminInterface?.classList.remove('mobile-layout');
    }

    if (width < 768) {
      adminInterface?.classList.add('compact-layout');
    } else {
      adminInterface?.classList.remove('compact-layout');
    }
  }

  // Session management
  cleanupExpiredSessions() {
    // Clean up any expired cached data
    console.log('Cleaning up expired sessions...');
  }

  // Keyboard shortcuts help
  showKeyboardShortcuts() {
    const shortcuts = [
      { key: 'Ctrl/Cmd + 1-6', action: 'Cambiar entre secciones' },
      { key: 'Ctrl/Cmd + R', action: 'Actualizar sección actual' },
      { key: 'Ctrl/Cmd + E', action: 'Exportar datos de la sección' },
      { key: 'Escape', action: 'Cerrar modales' },
      { key: '?', action: 'Mostrar esta ayuda' }
    ];

    let helpContent = '<h4>Atajos de Teclado</h4><ul>';
    shortcuts.forEach(shortcut => {
      helpContent += `<li><strong>${shortcut.key}</strong>: ${shortcut.action}</li>`;
    });
    helpContent += '</ul>';

    // Show in a simple modal-like toast
    const helpToast = document.createElement('div');
    helpToast.innerHTML = helpContent;
    helpToast.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--bg-secondary);
      border: 2px solid var(--border-primary);
      border-radius: 12px;
      padding: 2rem;
      z-index: 10000;
      color: var(--text-primary);
      font-family: inherit;
      max-width: 400px;
      box-shadow: var(--shadow-xl);
    `;

    document.body.appendChild(helpToast);

    // Remove after 5 seconds or on click
    const removeHelp = () => {
      if (document.body.contains(helpToast)) {
        document.body.removeChild(helpToast);
      }
    };

    setTimeout(removeHelp, 5000);
    helpToast.addEventListener('click', removeHelp);
  }

  // Public API methods
  getCurrentSection() {
    return this.currentSection;
  }

  getComponent(componentName) {
    return this.components[componentName];
  }

  isReady() {
    return this.isInitialized && this.components.auth?.isAdminAuthenticated();
  }

  // Cleanup method
  destroy() {
    console.log('Destroying ZETALAB Admin Panel...');

    // Cleanup components
    if (this.components.dashboard) {
      this.components.dashboard.destroy?.();
    }

    if (this.components.charts) {
      this.components.charts.destroy();
    }

    // Clear intervals and event listeners
    this.pauseRealTimeUpdates();

    this.isInitialized = false;
  }
}

// Initialize admin panel when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.adminMain = new AdminMain();
  
  // Auto-initialize if not already done
  if (!window.adminMain.isInitialized) {
    window.adminMain.init();
  }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
  if (window.adminMain) {
    window.adminMain.destroy();
  }
});

// Export for global access
window.AdminMain = AdminMain;

// Auto-initialize on script load
(() => {
  console.log('ZETALAB Admin Panel loaded - waiting for DOM ready...');
})();