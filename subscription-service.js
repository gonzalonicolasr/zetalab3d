/* ==============================
   ZETALAB - Subscription Service
   Sistema de suscripciones con MercadoPago
============================== */

class SubscriptionService {
  constructor() {
    // Detectar entorno y usar URL apropiada
    this.API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:3001'
      : 'https://zetalabbackend-production.up.railway.app';
    
    // Solo plan mensual disponible
    this.plans = {
      monthly: { days: 30, price: 5000, name: 'Mensual Premium', description: 'Plan mensual completo por $5000 ARS' }
    };
  }

  // Obtener estado actual de suscripción
  async getCurrentSubscription(userId) {
    try {
      if (!window.supa) {
        throw new Error('Supabase no disponible');
      }

      const { data, error } = await window.supa
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('active', true)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        throw error;
      }

      return data || null;
    } catch (error) {
      console.error('Error obteniendo suscripción:', error);
      return null;
    }
  }

  // Verificar si el usuario tiene suscripción activa
  async hasActiveSubscription(userId) {
    const subscription = await this.getCurrentSubscription(userId);
    if (!subscription) return false;

    const now = new Date();
    const expiresAt = new Date(subscription.expires_at);
    
    return expiresAt > now;
  }

  // Crear pago en MercadoPago - Solo plan mensual
  async createPayment(userEmail, userId) {
    try {
      const response = await fetch(`${this.API_BASE}/create-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userEmail,
          userId
        })
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Error creando pago');
      }

      return data;
    } catch (error) {
      console.error('Error creando pago:', error);
      throw error;
    }
  }

  // Activar suscripción (trial gratuito o después de pago)
  async activateSubscription(userId, planType, paymentId = null) {
    try {
      const plan = this.plans[planType];
      if (!plan) {
        throw new Error('Plan no válido');
      }

      const now = new Date();
      const expiresAt = new Date(now.getTime() + (plan.days * 24 * 60 * 60 * 1000));

      const subscriptionData = {
        user_id: userId,
        plan_type: planType,
        active: true,
        created_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        payment_id: paymentId
      };

      // Desactivar suscripciones previas
      await window.supa
        .from('subscriptions')
        .update({ active: false })
        .eq('user_id', userId);

      // Crear nueva suscripción
      const { data, error } = await window.supa
        .from('subscriptions')
        .insert([subscriptionData])
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error activando suscripción:', error);
      throw error;
    }
  }

  // Mostrar modal de suscripción
  showSubscriptionModal() {
    const modal = this.createSubscriptionModal();
    document.body.appendChild(modal);
    
    // Animación de entrada
    setTimeout(() => modal.classList.add('show'), 10);
  }

  // Crear modal de suscripción - Solo plan mensual
  createSubscriptionModal() {
    const modal = document.createElement('div');
    modal.className = 'subscription-modal';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>⭐ ZETALAB Premium</h2>
          <button class="modal-close" onclick="this.closest('.subscription-modal').remove()">✕</button>
        </div>
        
        <div class="single-plan-container">
          <div class="plan-hero">
            <div class="plan-badge">Plan Único</div>
            <h3>🚀 Acceso Premium Mensual</h3>
            <div class="price-display">
              <span class="currency">$</span>
              <span class="amount">5.000</span>
              <span class="period">ARS/mes</span>
            </div>
            <p class="plan-description">
              Acceso completo a todas las funciones de la calculadora profesional de impresión 3D más avanzada
            </p>
          </div>

          <div class="features-list">
            <h4>✨ Incluye todo:</h4>
            <ul>
              <li>✅ Calculadora de costos profesional</li>
              <li>✅ Guardado ilimitado de piezas</li>
              <li>✅ Generación de presupuestos HTML</li>
              <li>✅ Historial de versiones</li>
              <li>✅ Perfiles de gastos fijos</li>
              <li>✅ Autocompletado desde URLs</li>
              <li>✅ Soporte técnico prioritario</li>
              <li>✅ Actualizaciones y nuevas funciones</li>
            </ul>
          </div>

          <div class="action-section">
            <button class="btn-subscribe" data-plan="monthly">
              💳 Suscribirse por $5.000/mes
            </button>
            <p class="payment-info">
              💳 Pago seguro con MercadoPago<br>
              🔒 Puedes cancelar cuando quieras
            </p>
          </div>
        </div>
      </div>
    `;

    // CSS del modal simplificado
    const style = document.createElement('style');
    style.textContent = `
      .subscription-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
      .subscription-modal.show {
        opacity: 1;
      }
      .modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(5px);
      }
      .modal-content {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--panel);
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 32px;
        max-width: 500px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.6);
      }
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
      }
      .modal-header h2 {
        margin: 0;
        color: var(--text);
        font-size: 1.8em;
      }
      .modal-close {
        background: none;
        border: none;
        font-size: 28px;
        color: var(--muted);
        cursor: pointer;
        padding: 4px;
      }
      .single-plan-container {
        text-align: center;
      }
      .plan-hero {
        margin-bottom: 32px;
        padding: 24px;
        background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
        border-radius: 16px;
        border: 2px solid var(--accent);
        position: relative;
      }
      .plan-badge {
        position: absolute;
        top: -12px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--accent);
        color: white;
        padding: 6px 16px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .plan-hero h3 {
        margin: 16px 0;
        color: var(--text);
        font-size: 1.5em;
      }
      .price-display {
        margin: 20px 0;
        font-weight: 700;
      }
      .currency {
        font-size: 1.2em;
        color: var(--accent);
        vertical-align: top;
      }
      .amount {
        font-size: 3em;
        color: var(--accent);
      }
      .period {
        font-size: 1em;
        color: var(--muted);
        vertical-align: bottom;
      }
      .plan-description {
        color: var(--text-secondary);
        font-size: 1em;
        line-height: 1.5;
        margin: 16px 0 0;
      }
      .features-list {
        text-align: left;
        margin-bottom: 32px;
      }
      .features-list h4 {
        text-align: center;
        margin-bottom: 20px;
        color: var(--text);
        font-size: 1.2em;
      }
      .features-list ul {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .features-list li {
        padding: 8px 0;
        color: var(--text);
        font-size: 15px;
        display: flex;
        align-items: center;
      }
      .action-section {
        text-align: center;
      }
      .btn-subscribe {
        width: 100%;
        padding: 18px 24px;
        background: linear-gradient(135deg, var(--accent) 0%, #5a9d6b 100%);
        color: white;
        border: none;
        border-radius: 12px;
        font-size: 18px;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.3s ease;
        margin-bottom: 16px;
        box-shadow: 0 8px 20px rgba(79, 154, 101, 0.3);
      }
      .btn-subscribe:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 30px rgba(79, 154, 101, 0.4);
        background: linear-gradient(135deg, #5a9d6b 0%, var(--accent) 100%);
      }
      .payment-info {
        color: var(--muted);
        font-size: 13px;
        line-height: 1.4;
        margin: 0;
      }
    `;
    document.head.appendChild(style);

    // Event listeners
    modal.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        modal.remove();
      }
      
      if (e.target.classList.contains('btn-subscribe')) {
        const planType = e.target.dataset.plan;
        this.handlePlanSelection(planType, modal);
      }
    });

    return modal;
  }

  // Manejar selección de plan - Solo mensual
  async handlePlanSelection(planType, modal) {
    try {
      if (!window.currentUser) {
        alert('Debes estar autenticado para suscribirte');
        return;
      }

      const userEmail = window.currentUser.email;
      const userId = window.currentUser.id;

      // Mostrar loading
      const button = modal.querySelector('.btn-subscribe');
      const originalText = button.textContent;
      button.textContent = '⏳ Procesando pago...';
      button.disabled = true;

      try {
        // Crear pago con MercadoPago
        const payment = await this.createPayment(userEmail, userId);
        
        // Redirigir a MercadoPago
        window.open(payment.initPoint, '_blank');
        modal.remove();
        
        // Mostrar mensaje informativo
        setTimeout(() => {
          const statusEl = document.getElementById('subscriptionStatus');
          if (statusEl) {
            statusEl.style.display = 'flex';
            statusEl.style.background = '#f59e0b';
            statusEl.style.color = 'white';
            document.getElementById('subscriptionText').textContent = '⏳ Pago pendiente';
          }
        }, 500);

      } catch (error) {
        // Restaurar botón en caso de error
        button.textContent = originalText;
        button.disabled = false;
        throw error;
      }

    } catch (error) {
      console.error('Error procesando suscripción:', error);
      alert('Error procesando suscripción: ' + error.message);
    }
  }

  // Verificar si es necesario mostrar modal
  async checkSubscriptionStatus(userId) {
    const hasActive = await this.hasActiveSubscription(userId);
    return hasActive;
  }

  // Mostrar botón de upgrade a Premium (solo para usuarios con plan trial o monthly)
  showUpgradeButton() {
    // Eliminar botón existente si lo hay
    const existingButton = document.getElementById('upgrade-premium-btn');
    if (existingButton) {
      existingButton.remove();
    }

    const upgradeBtn = document.createElement('button');
    upgradeBtn.id = 'upgrade-premium-btn';
    upgradeBtn.innerHTML = '⭐ Upgrade Premium';
    upgradeBtn.className = 'pill';
    upgradeBtn.style.cssText = `
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      cursor: pointer;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s ease;
    `;

    upgradeBtn.addEventListener('mouseenter', () => {
      upgradeBtn.style.transform = 'scale(1.05)';
    });

    upgradeBtn.addEventListener('mouseleave', () => {
      upgradeBtn.style.transform = 'scale(1)';
    });

    upgradeBtn.addEventListener('click', () => {
      this.showUpgradeModal();
    });

    // Insertarlo junto al indicador de suscripción
    const subscriptionStatus = document.getElementById('subscriptionStatus');
    if (subscriptionStatus) {
      subscriptionStatus.parentNode.insertBefore(upgradeBtn, subscriptionStatus);
    }
  }

  // Modal específico para upgrade a Premium
  showUpgradeModal() {
    const modal = this.createUpgradeModal();
    document.body.appendChild(modal);
    
    // Animación de entrada
    setTimeout(() => modal.classList.add('show'), 10);
  }

  // Crear modal de upgrade a Premium
  createUpgradeModal() {
    const modal = document.createElement('div');
    modal.className = 'subscription-modal';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>⭐ Upgrade a Premium</h2>
          <button class="modal-close" onclick="this.closest('.subscription-modal').remove()">✕</button>
        </div>
        
        <div class="upgrade-content">
          <div class="current-plan">
            <h3>Tu plan actual</h3>
            <div class="plan-comparison">
              <div class="plan-item current">
                <span class="plan-name">Plan actual</span>
                <span class="plan-features">Funciones básicas</span>
              </div>
              <div class="upgrade-arrow">→</div>
              <div class="plan-item premium">
                <span class="plan-name">Premium</span>
                <span class="plan-price">$100 ARS/mes</span>
                <span class="plan-features">+ Funciones avanzadas</span>
              </div>
            </div>
          </div>

          <div class="premium-benefits">
            <h3>🚀 Beneficios Premium</h3>
            <ul>
              <li>✅ Todas las funciones del plan básico</li>
              <li>⚡ Soporte técnico 24/7</li>
              <li>🎨 Templates premium de presupuestos</li>
              <li>📊 Análisis avanzado de costos</li>
              <li>🔧 Herramientas de cálculo avanzadas</li>
              <li>📱 Acceso prioritario a nuevas funciones</li>
            </ul>
          </div>

          <div class="upgrade-action">
            <button class="btn-upgrade-premium" data-plan="premium">
              ⭐ Upgrade por $100 ARS
            </button>
            <p class="upgrade-note">
              💳 Pago seguro con MercadoPago • 🔒 30 días de acceso premium
            </p>
          </div>
        </div>
      </div>
    `;

    // CSS específico para el modal de upgrade
    const style = document.createElement('style');
    style.textContent = `
      .upgrade-content {
        text-align: center;
      }
      .current-plan {
        margin-bottom: 24px;
      }
      .plan-comparison {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 20px;
        margin: 16px 0;
        flex-wrap: wrap;
      }
      .plan-item {
        background: var(--panel2);
        border: 1px solid var(--border);
        border-radius: 8px;
        padding: 12px 16px;
        min-width: 120px;
      }
      .plan-item.premium {
        border-color: var(--accent);
        box-shadow: 0 0 15px rgba(79, 154, 101, 0.2);
      }
      .plan-name {
        display: block;
        font-weight: 600;
        color: var(--text);
      }
      .plan-price {
        display: block;
        font-size: 1.2em;
        color: var(--accent);
        font-weight: 700;
      }
      .plan-features {
        display: block;
        font-size: 12px;
        color: var(--muted);
        margin-top: 4px;
      }
      .upgrade-arrow {
        font-size: 24px;
        color: var(--accent);
        font-weight: bold;
      }
      .premium-benefits {
        text-align: left;
        margin: 24px 0;
      }
      .premium-benefits h3 {
        text-align: center;
        margin-bottom: 16px;
      }
      .premium-benefits ul {
        list-style: none;
        padding: 0;
      }
      .premium-benefits li {
        padding: 6px 0;
        color: var(--text);
      }
      .upgrade-action {
        margin-top: 24px;
      }
      .btn-upgrade-premium {
        width: 100%;
        padding: 16px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 18px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .btn-upgrade-premium:hover {
        background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
        transform: scale(1.02);
      }
      .upgrade-note {
        font-size: 12px;
        color: var(--muted);
        margin-top: 12px;
      }
      @media (max-width: 600px) {
        .plan-comparison {
          flex-direction: column;
        }
        .upgrade-arrow {
          transform: rotate(90deg);
        }
      }
    `;
    document.head.appendChild(style);

    // Event listeners
    modal.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        modal.remove();
      }
      
      if (e.target.classList.contains('btn-upgrade-premium')) {
        const planType = e.target.dataset.plan;
        this.handlePlanSelection(planType, modal);
      }
    });

    return modal;
  }
}

// Instancia global
window.subscriptionService = new SubscriptionService();