/* ==============================
   ZETALAB - Simple Premium Control
   Sistema simplificado de control de acceso premium
============================== */

class SimplePremiumControl {
  constructor() {
    this.isChecking = false;
  }

  // Verificar si el usuario tiene acceso premium
  async hasAccess() {
    try {
      if (!window.currentUser || !window.subscriptionService) {
        return false;
      }
      
      return await window.subscriptionService.hasActiveSubscription(window.currentUser.id);
    } catch (error) {
      console.error('Error verificando acceso premium:', error);
      return false;
    }
  }

  // Mostrar popup simple cuando se requiere premium
  showPremiumRequired(featureName = 'esta función') {
    // Evitar múltiples popups
    if (document.querySelector('.premium-required-popup')) {
      return;
    }

    const popup = document.createElement('div');
    popup.className = 'premium-required-popup';
    popup.innerHTML = `
      <div class="popup-overlay"></div>
      <div class="popup-content">
        <h2>⭐ Premium Requerido</h2>
        <p>Para usar ${featureName} necesitas una suscripción Premium activa.</p>
        
        <div class="price-info">
          <span class="price">$5.000 ARS/mes</span>
          <span class="description">Acceso completo a todas las funciones</span>
        </div>
        
        <div class="actions">
          <button class="btn-get-premium">💳 Obtener Premium</button>
          <button class="btn-close">Cerrar</button>
        </div>
      </div>
    `;

    // Estilos inline para simplicidad
    const style = document.createElement('style');
    style.textContent = `
      .premium-required-popup {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(0,0,0,0.8); z-index: 10000; 
        display: flex; align-items: center; justify-content: center;
        opacity: 0; transition: opacity 0.3s ease;
      }
      .premium-required-popup.show { opacity: 1; }
      .premium-required-popup .popup-content {
        background: var(--bg-secondary); border: 1px solid var(--border-primary);
        border-radius: 16px; padding: 30px; max-width: 400px; width: 90%;
        text-align: center; color: var(--text-primary);
        box-shadow: 0 20px 40px rgba(0,0,0,0.5);
      }
      .premium-required-popup h2 {
        margin: 0 0 15px; color: #FFD700; font-size: 1.5em;
      }
      .premium-required-popup p {
        margin: 0 0 20px; color: var(--text-secondary); line-height: 1.4;
      }
      .premium-required-popup .price-info {
        background: var(--bg-tertiary); border-radius: 8px; padding: 15px; margin: 20px 0;
      }
      .premium-required-popup .price {
        display: block; font-size: 1.8em; font-weight: 700; 
        color: var(--terminal-green); margin-bottom: 5px;
      }
      .premium-required-popup .description {
        font-size: 12px; color: var(--text-secondary);
      }
      .premium-required-popup .actions {
        display: flex; gap: 10px; margin-top: 20px;
      }
      .premium-required-popup .btn-get-premium {
        flex: 1; padding: 14px; background: linear-gradient(135deg, var(--terminal-green), #5a9d6b);
        color: white; border: none; border-radius: 8px; font-weight: 600; 
        cursor: pointer; transition: all 0.2s ease;
      }
      .premium-required-popup .btn-get-premium:hover { transform: scale(1.02); }
      .premium-required-popup .btn-close {
        flex: 1; padding: 14px; background: var(--bg-tertiary); color: var(--text-primary);
        border: 1px solid var(--border-primary); border-radius: 8px; cursor: pointer;
      }
      .premium-required-popup .btn-close:hover { background: var(--bg-hover); }
    `;
    document.head.appendChild(style);

    // Event handlers
    popup.addEventListener('click', (e) => {
      if (e.target.classList.contains('popup-overlay') || 
          e.target.classList.contains('btn-close')) {
        popup.remove();
      }
      
      if (e.target.classList.contains('btn-get-premium')) {
        popup.remove();
        if (window.subscriptionService) {
          window.subscriptionService.showSubscriptionModal();
        }
      }
    });

    document.body.appendChild(popup);
    setTimeout(() => popup.classList.add('show'), 10);
  }

  // Verificar acceso y mostrar popup si es necesario
  async checkAndRequirePremium(featureName) {
    const hasAccess = await this.hasAccess();
    
    if (!hasAccess) {
      this.showPremiumRequired(featureName);
      return false;
    }
    
    return true;
  }

  // Método conveniente para funciones específicas
  async requirePremiumFor(action, featureName, callback) {
    const hasAccess = await this.checkAndRequirePremium(featureName);
    
    if (hasAccess && typeof callback === 'function') {
      callback();
    }
    
    return hasAccess;
  }
}

// Instancia global
window.simplePremiumControl = new SimplePremiumControl();

// Función global conveniente para verificar acceso
window.checkPremiumAccess = async (featureName) => {
  return await window.simplePremiumControl.checkAndRequirePremium(featureName);
};