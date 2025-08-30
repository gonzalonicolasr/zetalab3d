/* ==============================
   ZETALAB - Access Control System
   Sistema de control de acceso basado en suscripciones
============================== */

class AccessControlService {
  constructor() {
    this.isInitialized = false;
    this.subscriptionStatus = null;
    this.premiumFeatures = new Set();
    this.restrictedElements = new Map();
    this.overlays = new Map();
    
    // Definir características premium
    this.setupPremiumFeatures();
  }

  // Definir qué features son premium
  setupPremiumFeatures() {
    this.premiumFeatures = new Set([
      'piece-saving',           // Guardar piezas
      'piece-management',       // Gestión de piezas guardadas  
      'export-html',           // Exportar presupuestos HTML
      'advanced-presets',      // Perfiles avanzados de gastos fijos
      'version-history',       // Historial de versiones
      'auto-url-complete',     // Autocompletado desde URLs
      'premium-templates',     // Templates premium
      'bulk-operations',       // Operaciones masivas
      'advanced-calculations', // Cálculos avanzados
      'data-export',          // Exportación de datos
      'priority-support'       // Soporte prioritario
    ]);
  }

  // Inicializar sistema de control de acceso
  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Verificar que el usuario esté autenticado
      if (!window.currentUser) {
        console.warn('Access Control: Usuario no autenticado');
        return;
      }

      // Obtener estado de suscripción
      await this.updateSubscriptionStatus();
      
      // Aplicar controles de acceso
      this.applyAccessControls();
      
      // Configurar observadores de DOM para elementos dinámicos
      this.setupDOMObserver();
      
      this.isInitialized = true;
      console.log('✅ Access Control System inicializado');
      
      // Disparar evento de inicialización
      window.dispatchEvent(new CustomEvent('accessControlReady', {
        detail: { hasActiveSubscription: this.hasActiveSubscription() }
      }));
      
    } catch (error) {
      console.error('❌ Error inicializando Access Control:', error);
    }
  }

  // Actualizar estado de suscripción
  async updateSubscriptionStatus() {
    try {
      if (!window.subscriptionService) {
        console.warn('⚠️ SubscriptionService no disponible');
        this.subscriptionStatus = { isActive: false, subscription: null, planType: 'free' };
        return;
      }
      
      if (!window.currentUser) {
        console.warn('⚠️ Usuario no autenticado');
        this.subscriptionStatus = { isActive: false, subscription: null, planType: 'free' };
        return;
      }
      
      console.log('🔍 Verificando suscripción para usuario:', window.currentUser.id);
      
      const hasActive = await window.subscriptionService.hasActiveSubscription(window.currentUser.id);
      const subscription = await window.subscriptionService.getCurrentSubscription(window.currentUser.id);
      
      console.log('📊 Resultados de verificación:', {
        hasActive,
        subscription,
        planType: subscription?.plan_type
      });
      
      this.subscriptionStatus = {
        isActive: hasActive,
        subscription: subscription,
        planType: subscription?.plan_type || 'free'
      };
      
      console.log('✅ Estado de suscripción actualizado:', this.subscriptionStatus);
      
    } catch (error) {
      console.error('❌ Error obteniendo estado de suscripción:', error);
      this.subscriptionStatus = { isActive: false, subscription: null, planType: 'free' };
    }
  }

  // Verificar si el usuario tiene suscripción activa
  hasActiveSubscription() {
    const isActive = this.subscriptionStatus?.isActive === true;
    console.log('🔍 Verificando suscripción activa:', {
      subscriptionStatus: this.subscriptionStatus,
      isActive: isActive,
      planType: this.subscriptionStatus?.planType,
      subscription: this.subscriptionStatus?.subscription
    });
    return isActive;
  }

  // Verificar si una característica específica está disponible
  hasFeatureAccess(featureId) {
    if (!this.premiumFeatures.has(featureId)) {
      return true; // Feature gratuita
    }
    
    return this.hasActiveSubscription();
  }

  // Aplicar controles de acceso a elementos existentes
  applyAccessControls() {
    // Controlar botones de guardado
    this.controlSaveFeatures();
    
    // Controlar exportación HTML
    this.controlExportFeatures();
    
    // Controlar gestión de piezas
    this.controlPieceManagement();
    
    // Controlar presets avanzados
    this.controlAdvancedPresets();
    
    // Controlar autocompletado de URLs
    this.controlUrlAutoComplete();
    
    // Aplicar estilos visuales
    this.applyVisualIndicators();
  }

  // Controlar características de guardado
  controlSaveFeatures() {
    const saveButtons = document.querySelectorAll('[data-action="save"], #savePieceBtn, .save-piece');
    const saveInputs = document.querySelectorAll('#pieceName, #pieceUrl');
    
    saveButtons.forEach(btn => {
      this.applyFeatureControl(btn, 'piece-saving', {
        disableMessage: 'Guardar piezas requiere suscripción Premium',
        upgradeAction: () => this.showUpgradePrompt('piece-saving')
      });
    });
    
    saveInputs.forEach(input => {
      this.applyFeatureControl(input, 'piece-saving', {
        placeholderOverride: 'Premium: Guardar piezas',
        disableMessage: 'Función premium'
      });
    });
  }

  // Controlar exportación HTML
  controlExportFeatures() {
    const exportButtons = document.querySelectorAll('[data-action="export"], #exportBtn, .export-html');
    
    exportButtons.forEach(btn => {
      this.applyFeatureControl(btn, 'export-html', {
        disableMessage: 'Exportar presupuestos requiere suscripción Premium',
        upgradeAction: () => this.showUpgradePrompt('export-html')
      });
    });
  }

  // Controlar gestión de piezas
  controlPieceManagement() {
    const pieceLinks = document.querySelectorAll('a[href*="mis-piezas"]');
    
    pieceLinks.forEach(link => {
      if (!this.hasFeatureAccess('piece-management')) {
        this.addPremiumOverlay(link, 'piece-management', {
          title: 'Gestión de Piezas',
          description: 'Administra tus piezas guardadas con historial de versiones',
          upgradeAction: () => this.showUpgradePrompt('piece-management')
        });
      }
    });
  }

  // Controlar presets avanzados  
  controlAdvancedPresets() {
    const presetButtons = document.querySelectorAll('[data-preset-action]');
    
    presetButtons.forEach(btn => {
      if (btn.dataset.presetAction !== 'load-basic') {
        this.applyFeatureControl(btn, 'advanced-presets', {
          disableMessage: 'Presets avanzados requieren Premium',
          upgradeAction: () => this.showUpgradePrompt('advanced-presets')
        });
      }
    });
  }

  // Controlar autocompletado de URLs
  controlUrlAutoComplete() {
    const urlInputs = document.querySelectorAll('#pieceUrl, input[data-auto-complete]');
    
    urlInputs.forEach(input => {
      if (!this.hasFeatureAccess('auto-url-complete')) {
        // Deshabilitar eventos de autocompletado
        this.disableUrlAutoComplete(input);
      }
    });
  }

  // Aplicar control a un elemento específico
  applyFeatureControl(element, featureId, options = {}) {
    if (!element) return;
    
    const hasAccess = this.hasFeatureAccess(featureId);
    
    if (!hasAccess) {
      // Deshabilitar elemento
      element.disabled = true;
      element.classList.add('premium-disabled');
      
      // Cambiar placeholder si es input
      if (element.tagName === 'INPUT' && options.placeholderOverride) {
        element.setAttribute('data-original-placeholder', element.placeholder);
        element.placeholder = options.placeholderOverride;
      }
      
      // Añadir tooltip
      if (options.disableMessage) {
        element.title = options.disableMessage;
        element.setAttribute('data-tooltip', options.disableMessage);
      }
      
      // Interceptar clics
      const clickHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (options.upgradeAction) {
          options.upgradeAction();
        } else {
          this.showUpgradePrompt(featureId);
        }
      };
      
      element.addEventListener('click', clickHandler, { capture: true });
      element.addEventListener('submit', clickHandler, { capture: true });
      
      // Guardar referencia para limpieza posterior
      this.restrictedElements.set(element, {
        featureId,
        clickHandler,
        originalState: {
          disabled: element.disabled,
          placeholder: element.placeholder,
          title: element.title
        }
      });
    }
  }

  // Añadir overlay premium a un elemento
  addPremiumOverlay(element, featureId, options = {}) {
    if (!element || this.hasFeatureAccess(featureId)) return;
    
    // Crear overlay
    const overlay = document.createElement('div');
    overlay.className = 'premium-overlay';
    overlay.innerHTML = `
      <div class="premium-overlay-content">
        <div class="premium-badge">⭐ PREMIUM</div>
        <h3>${options.title || 'Función Premium'}</h3>
        <p>${options.description || 'Esta función requiere suscripción Premium'}</p>
        <button class="btn-upgrade-mini">
          🚀 Upgrade ($5.000/mes)
        </button>
      </div>
    `;
    
    // Posicionamiento
    element.style.position = 'relative';
    element.appendChild(overlay);
    
    // Event handler para upgrade
    const upgradeBtn = overlay.querySelector('.btn-upgrade-mini');
    upgradeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (options.upgradeAction) {
        options.upgradeAction();
      } else {
        this.showUpgradePrompt(featureId);
      }
    });
    
    this.overlays.set(element, overlay);
  }

  // Deshabilitar autocompletado de URLs
  disableUrlAutoComplete(input) {
    if (!input) return;
    
    // Remover event listeners existentes de autocompletado
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    
    // Añadir indicador visual
    newInput.classList.add('premium-disabled');
    newInput.setAttribute('data-tooltip', 'Autocompletado desde URL requiere Premium');
    
    // Interceptar intentos de uso
    newInput.addEventListener('paste', (e) => {
      if (e.clipboardData.getData('text').includes('http')) {
        e.preventDefault();
        this.showUpgradePrompt('auto-url-complete');
      }
    });
  }

  // Mostrar prompt simple para funciones premium
  showUpgradePrompt(featureId) {
    const featureInfo = this.getFeatureInfo(featureId);
    
    // Modal simple y directo
    const modal = document.createElement('div');
    modal.className = 'simple-premium-popup';
    modal.innerHTML = `
      <div class="popup-overlay"></div>
      <div class="popup-content">
        <div class="popup-header">
          <h2>⭐ Premium Requerido</h2>
          <button class="popup-close">✕</button>
        </div>
        
        <div class="popup-body">
          <div class="feature-info">
            <div class="feature-icon">${featureInfo.icon}</div>
            <h3>${featureInfo.title}</h3>
            <p>${featureInfo.description}</p>
          </div>
          
          <div class="premium-price">
            <span class="price">$5.000 ARS/mes</span>
            <span class="price-note">Acceso completo premium</span>
          </div>
          
          <div class="popup-actions">
            <button class="btn-get-premium">
              💳 Obtener Premium
            </button>
            <button class="btn-cancel">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    `;
    
    // Estilos simples
    const style = document.createElement('style');
    style.textContent = `
      .simple-premium-popup {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 10000;
        opacity: 0; transition: opacity 0.2s ease;
      }
      .simple-premium-popup.show { opacity: 1; }
      .popup-overlay {
        position: absolute; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(3px);
      }
      .popup-content {
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: var(--bg-secondary); border: 1px solid var(--border-primary);
        border-radius: 16px; padding: 24px; max-width: 400px; width: 90%;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
      }
      .popup-header {
        display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;
      }
      .popup-header h2 { margin: 0; color: #FFD700; font-size: 1.4em; }
      .popup-close {
        background: none; border: none; font-size: 20px; color: var(--text-secondary);
        cursor: pointer; padding: 4px; border-radius: 4px;
      }
      .popup-close:hover { background: var(--bg-tertiary); color: var(--text-primary); }
      .popup-body { text-align: center; }
      .feature-info { margin-bottom: 20px; }
      .feature-icon { font-size: 2em; margin-bottom: 8px; }
      .feature-info h3 { margin: 0 0 8px; color: var(--text-primary); }
      .feature-info p { margin: 0; color: var(--text-secondary); font-size: 14px; }
      .premium-price { margin: 20px 0; }
      .premium-price .price {
        display: block; font-size: 1.8em; font-weight: 700; color: var(--terminal-green);
        margin-bottom: 4px;
      }
      .premium-price .price-note {
        font-size: 12px; color: var(--text-secondary);
      }
      .popup-actions { display: flex; gap: 12px; margin-top: 20px; }
      .btn-get-premium {
        flex: 1; padding: 14px; background: linear-gradient(135deg, var(--terminal-green), #5a9d6b);
        color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;
        transition: all 0.2s ease;
      }
      .btn-get-premium:hover { transform: scale(1.02); }
      .btn-cancel {
        flex: 1; padding: 14px; background: var(--bg-tertiary); color: var(--text-primary);
        border: 1px solid var(--border-primary); border-radius: 8px; cursor: pointer;
        transition: all 0.2s ease;
      }
      .btn-cancel:hover { background: var(--bg-hover); }
    `;
    document.head.appendChild(style);
    
    // Event handlers - simple y directo
    modal.addEventListener('click', (e) => {
      if (e.target.classList.contains('popup-overlay') || 
          e.target.classList.contains('popup-close') ||
          e.target.classList.contains('btn-cancel')) {
        modal.remove();
      }
      
      if (e.target.classList.contains('btn-get-premium')) {
        modal.remove();
        // Abrir modal de suscripción
        if (window.subscriptionService) {
          window.subscriptionService.showSubscriptionModal();
        }
      }
    });
    
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 10);
  }

  // Obtener información de una característica
  getFeatureInfo(featureId) {
    const features = {
      'piece-saving': {
        icon: '💾',
        title: 'Guardar Piezas',
        description: 'Guarda tus cálculos y piezas para acceso posterior con historial completo.'
      },
      'export-html': {
        icon: '📄',
        title: 'Exportar Presupuestos',
        description: 'Genera presupuestos profesionales en formato HTML para tus clientes.'
      },
      'piece-management': {
        icon: '📁',
        title: 'Gestión de Piezas',
        description: 'Administra todas tus piezas guardadas con historial de versiones.'
      },
      'advanced-presets': {
        icon: '⚙️',
        title: 'Presets Avanzados',
        description: 'Crea y usa perfiles personalizados de gastos fijos para diferentes setups.'
      },
      'auto-url-complete': {
        icon: '🔗',
        title: 'Autocompletado de URLs',
        description: 'Completa automáticamente datos de piezas desde URLs de MakerWorld y otros.'
      },
      'version-history': {
        icon: '📋',
        title: 'Historial de Versiones',
        description: 'Accede al historial completo de modificaciones de tus piezas.'
      }
    };
    
    return features[featureId] || {
      icon: '⭐',
      title: 'Función Premium',
      description: 'Esta función requiere una suscripción Premium activa.'
    };
  }

  // Aplicar indicadores visuales
  applyVisualIndicators() {
    // CAMBIO: No mostrar botón "Upgrade a Premium" - solo usar "Suscripciones"
    console.log('✅ Sistema simplificado - solo botón Suscripciones, sin Upgrade a Premium');
    
    // Siempre remover cualquier botón de upgrade que pueda existir
    this.removeUpgradeIndicator();
    
    // Aplicar estilos CSS
    this.injectAccessControlStyles();
  }

  // Añadir indicador de upgrade - REMOVIDO
  // El botón "Upgrade a Premium" ha sido eliminado según solicitud del usuario
  // Solo queda el botón "Suscripciones" en el header
  addUpgradeIndicator() {
    // Función deshabilitada - no mostrar botón "Upgrade a Premium"
    console.log('addUpgradeIndicator() deshabilitado - solo usar botón Suscripciones');
    return;
  }

  // Remover indicador de upgrade
  removeUpgradeIndicator() {
    const upgradeIndicator = document.querySelector('.upgrade-indicator');
    if (upgradeIndicator) {
      upgradeIndicator.remove();
      console.log('🗑️ Botón de upgrade removido');
    }
  }

  // Configurar observer para elementos dinámicos
  setupDOMObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldReapply = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              shouldReapply = true;
            }
          });
        }
      });
      
      if (shouldReapply) {
        // Debounce re-aplicación
        clearTimeout(this.reapplyTimeout);
        this.reapplyTimeout = setTimeout(() => {
          this.applyAccessControls();
        }, 200);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    this.domObserver = observer;
  }

  // Inyectar estilos CSS
  injectAccessControlStyles() {
    if (document.getElementById('access-control-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'access-control-styles';
    style.textContent = `
      /* Access Control Styles */
      .premium-disabled {
        opacity: 0.6 !important;
        cursor: not-allowed !important;
        position: relative;
      }
      
      .premium-disabled::after {
        content: '⭐';
        position: absolute;
        top: -8px;
        right: -8px;
        background: linear-gradient(135deg, #FFD700, #FFA500);
        color: white;
        border-radius: 50%;
        width: 18px;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        z-index: 10;
        pointer-events: none;
      }
      
      .premium-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(3px);
        border-radius: inherit;
        z-index: 100;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      
      .premium-overlay:hover {
        opacity: 1;
      }
      
      .premium-overlay-content {
        text-align: center;
        color: white;
        padding: 20px;
      }
      
      .premium-badge {
        background: linear-gradient(135deg, #FFD700, #FFA500);
        color: white;
        padding: 4px 12px;
        border-radius: 15px;
        font-size: 11px;
        font-weight: 700;
        display: inline-block;
        margin-bottom: 8px;
      }
      
      .premium-overlay h3 {
        margin: 0 0 8px;
        font-size: 16px;
      }
      
      .premium-overlay p {
        margin: 0 0 12px;
        font-size: 13px;
        opacity: 0.9;
      }
      
      .btn-upgrade-mini {
        background: linear-gradient(135deg, var(--terminal-green), #5a9d6b);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .btn-upgrade-mini:hover {
        background: linear-gradient(135deg, #5a9d6b, var(--terminal-green));
        transform: scale(1.05);
      }
      
      .upgrade-indicator {
        background: linear-gradient(135deg, #FFD700, #FFA500) !important;
        color: white !important;
        cursor: pointer;
        animation: premium-pulse 3s infinite;
        border: none !important;
      }
      
      .upgrade-indicator:hover {
        background: linear-gradient(135deg, #FFA500, #FFD700) !important;
        transform: scale(1.05);
      }
      
      @keyframes premium-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.4); }
        50% { box-shadow: 0 0 0 10px rgba(255, 215, 0, 0); }
      }
      
      .access-control-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      
      .access-control-modal.show {
        opacity: 1;
      }
      
      .access-control-modal .modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(5px);
      }
      
      .access-control-modal .modal-content {
        position: relative;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--bg-secondary);
        border: 1px solid var(--border-primary);
        border-radius: 20px;
        padding: 0;
        max-width: 480px;
        width: 90%;
        max-height: 90vh;
        overflow: hidden;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.6);
      }
      
      .premium-prompt-header {
        background: linear-gradient(135deg, #FFD700, #FFA500);
        color: white;
        padding: 20px 24px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .premium-prompt-header h2 {
        margin: 0;
        font-size: 1.3em;
      }
      
      .premium-prompt-header .modal-close {
        background: none;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: background 0.2s ease;
      }
      
      .premium-prompt-header .modal-close:hover {
        background: rgba(255, 255, 255, 0.2);
      }
      
      .premium-prompt-body {
        padding: 24px;
        color: var(--text-primary);
      }
      
      .feature-highlight {
        text-align: center;
        margin-bottom: 24px;
        padding: 20px;
        background: var(--bg-tertiary);
        border-radius: 12px;
        border: 1px solid var(--border-primary);
      }
      
      .feature-icon {
        font-size: 2.5em;
        margin-bottom: 12px;
      }
      
      .feature-highlight h3 {
        margin: 0 0 8px;
        color: var(--text-primary);
      }
      
      .feature-highlight p {
        margin: 0;
        color: var(--text-secondary);
        font-size: 14px;
        line-height: 1.4;
      }
      
      .premium-benefits h4 {
        margin: 0 0 16px;
        color: var(--text-primary);
      }
      
      .premium-benefits ul {
        list-style: none;
        padding: 0;
        margin: 0 0 24px;
      }
      
      .premium-benefits li {
        padding: 6px 0;
        font-size: 14px;
        color: var(--text-primary);
      }
      
      .pricing-info {
        text-align: center;
        margin-bottom: 24px;
        padding: 16px;
        background: linear-gradient(135deg, rgba(79, 154, 101, 0.1), rgba(90, 157, 107, 0.1));
        border-radius: 12px;
        border: 1px solid rgba(79, 154, 101, 0.2);
      }
      
      .price-tag {
        margin-bottom: 8px;
      }
      
      .price-tag .price {
        font-size: 1.8em;
        font-weight: 700;
        color: var(--terminal-green);
      }
      
      .price-tag .period {
        font-size: 1em;
        color: var(--text-secondary);
      }
      
      .price-description {
        margin: 0;
        font-size: 13px;
        color: var(--text-secondary);
      }
      
      .prompt-actions {
        display: flex;
        gap: 12px;
      }
      
      .btn-upgrade-now {
        flex: 1;
        padding: 16px;
        background: linear-gradient(135deg, var(--terminal-green), #5a9d6b);
        color: white;
        border: none;
        border-radius: 10px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .btn-upgrade-now:hover {
        background: linear-gradient(135deg, #5a9d6b, var(--terminal-green));
        transform: translateY(-1px);
      }
      
      .btn-maybe-later {
        flex: 1;
        padding: 16px;
        background: var(--bg-tertiary);
        color: var(--text-primary);
        border: 1px solid var(--border-primary);
        border-radius: 10px;
        font-size: 16px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      
      .btn-maybe-later:hover {
        background: var(--bg-hover);
        border-color: var(--border-focus);
      }
      
      @media (max-width: 600px) {
        .prompt-actions {
          flex-direction: column;
        }
      }
    `;
    
    document.head.appendChild(style);
  }

  // Limpiar controles (para cuando se active suscripción)
  cleanup() {
    // Restaurar elementos restringidos
    this.restrictedElements.forEach((data, element) => {
      element.disabled = data.originalState.disabled;
      element.placeholder = data.originalState.placeholder;
      element.title = data.originalState.title;
      element.classList.remove('premium-disabled');
      element.removeEventListener('click', data.clickHandler, { capture: true });
      element.removeEventListener('submit', data.clickHandler, { capture: true });
    });
    this.restrictedElements.clear();
    
    // Remover overlays
    this.overlays.forEach((overlay, element) => {
      overlay.remove();
    });
    this.overlays.clear();
    
    // Remover indicador de upgrade
    this.removeUpgradeIndicator();
    
    // Desconectar observer
    if (this.domObserver) {
      this.domObserver.disconnect();
    }
  }

  // Refresh - reaplica controles después de cambios de suscripción
  async refresh() {
    console.log('🔄 Refrescando Access Control...');
    this.cleanup();
    await this.updateSubscriptionStatus();
    this.applyAccessControls();
    
    // Forzar actualización de indicadores visuales
    this.applyVisualIndicators();
    
    console.log('✅ Access Control actualizado completamente');
  }
}

// Instancia global
window.accessControl = new AccessControlService();

// Auto-inicializar cuando el usuario esté listo
window.addEventListener('userReady', () => {
  setTimeout(() => {
    window.accessControl.initialize();
  }, 500);
});

// Listener para cambios de suscripción
window.addEventListener('subscriptionChanged', () => {
  if (window.accessControl) {
    window.accessControl.refresh();
  }
});

// Exposer método para verificación manual
window.checkFeatureAccess = (featureId) => {
  return window.accessControl?.hasFeatureAccess(featureId) || false;
};