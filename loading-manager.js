/* ==============================
   Sistema de Gestión de Estados de Loading
   ZETALAB - Loading Manager
============================== */

/**
 * Gestor centralizado para todos los estados de carga de la aplicación
 * Maneja spinners, botones deshabilitados y feedback visual
 */
class LoadingManager {
  constructor() {
    this.loadingStates = new Map();
    this.defaultSpinner = this.createSpinner();
    this.initializeStyles();
  }

  /**
   * Crea el spinner SVG por defecto
   */
  createSpinner() {
    return `
      <svg class="zl-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="32" stroke-dashoffset="32">
          <animate attributeName="stroke-dasharray" dur="2s" values="32;16;32" repeatCount="indefinite"/>
          <animate attributeName="stroke-dashoffset" dur="2s" values="32;0;-32" repeatCount="indefinite"/>
        </circle>
      </svg>
    `;
  }

  /**
   * Inicializa los estilos CSS necesarios
   */
  initializeStyles() {
    if (document.getElementById('loading-manager-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'loading-manager-styles';
    style.textContent = `
      .zl-spinner {
        animation: zl-spin 1s linear infinite;
        display: inline-block;
        vertical-align: middle;
        margin-right: 6px;
      }
      
      @keyframes zl-spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      
      .zl-loading {
        position: relative;
        pointer-events: none;
        opacity: 0.7;
      }
      
      .zl-loading::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.1);
        border-radius: inherit;
        pointer-events: none;
      }
      
      .zl-btn-loading {
        position: relative;
        pointer-events: none;
      }
      
      .zl-btn-loading .original-text {
        opacity: 0;
      }
      
      .zl-btn-loading .loading-overlay {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        align-items: center;
        white-space: nowrap;
      }

      .zl-loading-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        color: white;
        font-family: system-ui, -apple-system, sans-serif;
      }

      .zl-loading-backdrop .spinner-large {
        width: 32px;
        height: 32px;
        margin-right: 12px;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Establece el estado de loading para una clave específica
   * @param {string} key - Identificador único del loading
   * @param {boolean} isLoading - Si está cargando o no
   * @param {Object} options - Opciones adicionales
   */
  setLoading(key, isLoading, options = {}) {
    const oldState = this.loadingStates.get(key);
    
    if (isLoading) {
      this.loadingStates.set(key, {
        isLoading: true,
        startTime: Date.now(),
        message: options.message || 'Cargando...',
        type: options.type || 'default', // 'button', 'form', 'overlay', 'global'
        element: options.element || null
      });
    } else {
      this.loadingStates.delete(key);
    }

    // Actualizar UI solo si el estado cambió
    if (!oldState || oldState.isLoading !== isLoading) {
      this.updateUI(key, isLoading, options);
    }
  }

  /**
   * Obtiene el estado de loading actual
   */
  isLoading(key) {
    return this.loadingStates.has(key);
  }

  /**
   * Obtiene todos los estados de loading activos
   */
  getActiveLoadings() {
    return Array.from(this.loadingStates.entries());
  }

  /**
   * Actualiza la interfaz basada en el estado de loading
   */
  updateUI(key, isLoading, options = {}) {
    const element = options.element || document.querySelector(`[data-loading-key="${key}"]`);
    
    if (!element) {
      // Si no hay elemento específico, aplicar loading global si es tipo 'global'
      if (options.type === 'global') {
        this.toggleGlobalLoading(isLoading, options.message);
      }
      return;
    }

    switch (options.type) {
      case 'button':
        this.toggleButtonLoading(element, isLoading, options.message);
        break;
      case 'form':
        this.toggleFormLoading(element, isLoading);
        break;
      case 'overlay':
        this.toggleOverlayLoading(element, isLoading, options.message);
        break;
      default:
        this.toggleDefaultLoading(element, isLoading);
    }
  }

  /**
   * Loading para botones
   */
  toggleButtonLoading(button, isLoading, message = 'Cargando...') {
    if (isLoading) {
      // Guardar texto original
      if (!button.dataset.originalText) {
        button.dataset.originalText = button.textContent;
      }
      
      button.disabled = true;
      button.classList.add('zl-btn-loading');
      
      const originalSpan = document.createElement('span');
      originalSpan.className = 'original-text';
      originalSpan.textContent = button.dataset.originalText;
      
      const loadingSpan = document.createElement('span');
      loadingSpan.className = 'loading-overlay';
      loadingSpan.innerHTML = `${this.defaultSpinner}${message}`;
      
      button.innerHTML = '';
      button.appendChild(originalSpan);
      button.appendChild(loadingSpan);
    } else {
      button.disabled = false;
      button.classList.remove('zl-btn-loading');
      button.textContent = button.dataset.originalText || 'Botón';
      delete button.dataset.originalText;
    }
  }

  /**
   * Loading para formularios completos
   */
  toggleFormLoading(form, isLoading) {
    const inputs = form.querySelectorAll('input, select, textarea, button');
    
    if (isLoading) {
      form.classList.add('zl-loading');
      inputs.forEach(input => {
        input.dataset.wasDisabled = input.disabled;
        input.disabled = true;
      });
    } else {
      form.classList.remove('zl-loading');
      inputs.forEach(input => {
        input.disabled = input.dataset.wasDisabled === 'true';
        delete input.dataset.wasDisabled;
      });
    }
  }

  /**
   * Loading con overlay sobre elemento
   */
  toggleOverlayLoading(element, isLoading, message = 'Cargando...') {
    const overlayId = `overlay-${Date.now()}`;
    
    if (isLoading) {
      element.style.position = 'relative';
      
      const overlay = document.createElement('div');
      overlay.id = overlayId;
      overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255,255,255,0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        border-radius: inherit;
        color: #333;
        font-family: system-ui, -apple-system, sans-serif;
      `;
      overlay.innerHTML = `${this.defaultSpinner}${message}`;
      
      element.appendChild(overlay);
      element.dataset.overlayId = overlayId;
    } else {
      const overlay = document.getElementById(element.dataset.overlayId);
      if (overlay) {
        overlay.remove();
      }
      delete element.dataset.overlayId;
    }
  }

  /**
   * Loading por defecto (solo clase CSS)
   */
  toggleDefaultLoading(element, isLoading) {
    if (isLoading) {
      element.classList.add('zl-loading');
    } else {
      element.classList.remove('zl-loading');
    }
  }

  /**
   * Loading global (toda la pantalla)
   */
  toggleGlobalLoading(isLoading, message = 'Cargando...') {
    const existingBackdrop = document.getElementById('zl-global-loading');
    
    if (isLoading && !existingBackdrop) {
      const backdrop = document.createElement('div');
      backdrop.id = 'zl-global-loading';
      backdrop.className = 'zl-loading-backdrop';
      backdrop.innerHTML = `
        ${this.defaultSpinner.replace('width="16" height="16"', 'width="32" height="32" class="spinner-large"')}
        ${message}
      `;
      document.body.appendChild(backdrop);
    } else if (!isLoading && existingBackdrop) {
      existingBackdrop.remove();
    }
  }

  /**
   * Wrapper para operaciones async con loading automático
   */
  async withLoading(key, operation, options = {}) {
    try {
      this.setLoading(key, true, options);
      const result = await operation();
      return result;
    } finally {
      this.setLoading(key, false, options);
    }
  }

  /**
   * Limpia todos los estados de loading
   */
  clearAll() {
    const keys = Array.from(this.loadingStates.keys());
    keys.forEach(key => this.setLoading(key, false));
  }

  /**
   * Obtiene estadísticas de loading (para debugging)
   */
  getStats() {
    return {
      activeCount: this.loadingStates.size,
      states: Object.fromEntries(this.loadingStates)
    };
  }
}

// Crear instancia global
const loadingManager = new LoadingManager();

// Exportar para uso global
window.LoadingManager = LoadingManager;
window.loadingManager = loadingManager;

// Helpers globales para fácil uso
window.setLoading = (key, isLoading, options) => loadingManager.setLoading(key, isLoading, options);
window.withLoading = (key, operation, options) => loadingManager.withLoading(key, operation, options);