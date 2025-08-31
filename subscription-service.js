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
        console.error('Supabase cliente no disponible');
        return null;
      }

      console.log('🔍 Buscando suscripción para usuario:', userId);

      // Consultar directamente a Supabase para la suscripción más reciente
      // Buscar cualquier suscripción activa (verificaremos status después)
      let { data: subscription, error } = await window.supa
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('❌ Error consultando suscripción:', error);
        return null;
      }

      console.log('📊 Suscripción más reciente encontrada:', subscription);

      return subscription;
    } catch (error) {
      console.error('❌ Error obteniendo suscripción:', error);
      return null;
    }
  }

  // Verificar si el usuario tiene suscripción activa
  async hasActiveSubscription(userId) {
    try {
      const subscription = await this.getCurrentSubscription(userId);
      
      if (!subscription) {
        console.log('❌ No hay suscripción encontrada');
        return false;
      }

      // Verificar que la suscripción esté activa y no haya expirado
      const now = new Date();
      const expiresAt = new Date(subscription.expires_at);
      
      // Verificar tanto 'status' como 'active' por compatibilidad
      const isStatusActive = subscription.status === true || subscription.active === true;
      const isNotExpired = expiresAt > now;
      
      console.log('⏰ Verificando tiempos:');
      console.log('  - Ahora:', now.toISOString());
      console.log('  - Expira:', expiresAt.toISOString());
      console.log('  - Status field:', subscription.status);
      console.log('  - Active field:', subscription.active);
      console.log('  - ¿Status activo?:', isStatusActive);
      console.log('  - ¿No expirado?:', isNotExpired);
      console.log('  - ¿Activa final?:', isStatusActive && isNotExpired);
      
      return isStatusActive && isNotExpired;
    } catch (error) {
      console.error('❌ Error verificando suscripción activa:', error);
      return false;
    }
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
      let plan = this.plans[planType];
      
      // Si no existe el plan y es trial, crear plan de prueba dinámicamente
      if (!plan && planType === 'trial') {
        plan = { days: 7, price: 0, name: 'Prueba Gratuita', description: 'Prueba gratuita de 7 días con acceso completo' };
      }
      
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

  // Nuevo método: Activar trial automático para nuevos usuarios
  async activateTrialForNewUser(userId) {
    try {
      console.log('🎯 Activando trial automático para nuevo usuario:', userId);
      
      // Verificar si el usuario ya tiene alguna suscripción (incluso expirada)
      const { data: existingSubscriptions, error } = await window.supa
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error('Error verificando suscripciones existentes:', error);
        throw error;
      }

      // Si ya tiene suscripciones, no dar trial
      if (existingSubscriptions && existingSubscriptions.length > 0) {
        console.log('❌ Usuario ya tiene suscripciones previas, no se da trial');
        return null;
      }

      // Activar trial de 7 días
      console.log('✅ Usuario elegible para trial, activando...');
      const trialSubscription = await this.activateSubscription(userId, 'trial');
      
      console.log('🎉 Trial activado exitosamente:', trialSubscription);
      return trialSubscription;
      
    } catch (error) {
      console.error('❌ Error activando trial para nuevo usuario:', error);
      throw error;
    }
  }

  // Nuevo método: Verificar si un usuario es elegible para trial
  async isEligibleForTrial(userId) {
    try {
      const { data: subscriptions, error } = await window.supa
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      // Es elegible si no tiene suscripciones previas
      return !subscriptions || subscriptions.length === 0;
    } catch (error) {
      console.error('Error verificando elegibilidad para trial:', error);
      return false;
    }
  }

  // Mostrar modal de suscripción (verificar estado primero)
  async showSubscriptionModal() {
    console.log('🎯 showSubscriptionModal() llamado');
    
    if (!window.currentUser) {
      console.error('❌ Usuario no autenticado');
      alert('Debes estar autenticado para ver suscripciones');
      return;
    }

    console.log('👤 Usuario autenticado:', window.currentUser.id);

    try {
      // Remover cualquier modal existente antes de crear uno nuevo
      const existingModal = document.querySelector('.subscription-modal');
      if (existingModal) {
        console.log('🗑️ Removiendo modal existente');
        existingModal.remove();
      }

      console.log('🔍 Verificando si el usuario tiene suscripción activa...');
      
      // Verificar si el usuario tiene suscripción activa
      const hasActive = await this.hasActiveSubscription(window.currentUser.id);
      
      console.log('📊 Resultado de verificación de suscripción:', hasActive);
      
      if (hasActive) {
        console.log('✅ Usuario con suscripción activa - mostrando gestión');
        // Usuario con suscripción activa - mostrar gestión
        await this.showSubscriptionManagement();
      } else {
        console.log('❌ Usuario sin suscripción activa');
        
        // Verificar si es elegible para trial
        const isEligible = await this.isEligibleForTrial(window.currentUser.id);
        
        if (isEligible) {
          console.log('🎁 Usuario elegible para trial - mostrando modal con opción de trial');
          // Mostrar modal con opción de trial gratuito y pago
          const modal = this.createTrialAndSubscriptionModal();
          this.showModal(modal);
        } else {
          console.log('💳 Usuario no elegible para trial - mostrando modal de pago');
          // Usuario sin suscripción - mostrar modal de pago
          const modal = this.createSubscriptionModal();
          this.showModal(modal);
        }
      }
    } catch (error) {
      console.error('❌ Error verificando suscripción:', error);
      alert('Error al verificar tu suscripción. Por favor intenta nuevamente.');
    }
  }

  // Método helper para limpiar estilos existentes
  removeExistingModalStyles() {
    const existingStyles = document.querySelectorAll('#subscription-modal-styles, style[id*="subscription"]');
    existingStyles.forEach(style => style.remove());
  }

  // Método helper para mostrar modales con mejor debugging
  showModal(modal) {
    console.log('🎨 Mostrando modal...');
    
    // Limpiar estilos conflictivos
    this.removeExistingModalStyles();
    
    // Asegurar que el modal tenga la clase correcta
    modal.className = 'subscription-modal';
    
    // Agregar estilos inline como fallback
    modal.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      z-index: 99999 !important;
      opacity: 0 !important;
      transition: opacity 0.3s ease !important;
      pointer-events: all !important;
      display: block !important;
    `;
    
    // Agregar al DOM
    document.body.appendChild(modal);
    console.log('✅ Modal añadido al DOM');
    
    // Forzar reflow antes de agregar la clase show
    modal.offsetHeight;
    
    // Mostrar modal con animación
    requestAnimationFrame(() => {
      modal.classList.add('show');
      modal.style.opacity = '1';
      console.log('✨ Modal mostrado con opacity 1');
      
      // Verificar que el modal sea visible
      const modalRect = modal.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(modal);
      
      console.log('📏 Dimensiones del modal:', {
        top: modalRect.top,
        left: modalRect.left,
        width: modalRect.width,
        height: modalRect.height,
        opacity: computedStyle.opacity,
        zIndex: computedStyle.zIndex,
        display: computedStyle.display,
        position: computedStyle.position
      });
      
      // Verificación adicional - si todavía no es visible, forzar
      if (modalRect.width === 0 || modalRect.height === 0) {
        console.warn('⚠️ Modal sin dimensiones - aplicando estilos de emergencia');
        modal.style.cssText += `
          background: rgba(0,0,0,0.8) !important;
          backdrop-filter: blur(5px) !important;
        `;
      }
    });
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

    // CSS del modal simplificado - Fixed z-index and visibility
    const style = document.createElement('style');
    style.id = 'subscription-modal-styles';
    style.textContent = `
      .subscription-modal {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        z-index: 99999 !important;
        opacity: 0 !important;
        transition: opacity 0.3s ease !important;
        pointer-events: all !important;
        display: block !important;
      }
      .subscription-modal.show {
        opacity: 1 !important;
      }
      .modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(5px);
        z-index: 1;
      }
      .modal-content {
        position: relative;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--bg-secondary);
        border: 1px solid var(--border-primary);
        border-radius: 20px;
        padding: 32px;
        max-width: 500px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.6);
        z-index: 2;
        color: var(--text-primary);
      }
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
      }
      .modal-header h2 {
        margin: 0;
        color: var(--text-primary);
        font-size: 1.8em;
      }
      .modal-close {
        background: none;
        border: none;
        font-size: 28px;
        color: var(--text-secondary);
        cursor: pointer;
        padding: 4px;
      }
      .modal-close:hover {
        background: var(--bg-tertiary);
        color: var(--text-primary);
        border-radius: 4px;
      }
      .single-plan-container {
        text-align: center;
      }
      .plan-hero {
        margin-bottom: 32px;
        padding: 24px;
        background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
        border-radius: 16px;
        border: 2px solid var(--terminal-green);
        position: relative;
      }
      .plan-badge {
        position: absolute;
        top: -12px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--terminal-green);
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
        color: var(--text-primary);
        font-size: 1.5em;
      }
      .price-display {
        margin: 20px 0;
        font-weight: 700;
      }
      .currency {
        font-size: 1.2em;
        color: var(--terminal-green);
        vertical-align: top;
      }
      .amount {
        font-size: 3em;
        color: var(--terminal-green);
      }
      .period {
        font-size: 1em;
        color: var(--text-secondary);
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
        color: var(--text-primary);
        font-size: 1.2em;
      }
      .features-list ul {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .features-list li {
        padding: 8px 0;
        color: var(--text-primary);
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
        background: linear-gradient(135deg, var(--terminal-green) 0%, #5a9d6b 100%);
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
        background: linear-gradient(135deg, #5a9d6b 0%, var(--terminal-green) 100%);
      }
      .payment-info {
        color: var(--text-secondary);
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

  // Crear modal combinado con trial gratuito y suscripción
  createTrialAndSubscriptionModal() {
    const modal = document.createElement('div');
    modal.className = 'subscription-modal';
    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>🎁 ¡Bienvenido a ZETALAB!</h2>
          <button class="modal-close" onclick="this.closest('.subscription-modal').remove()">✕</button>
        </div>
        
        <div class="trial-options-container">
          <div class="welcome-message">
            <h3>🚀 Comienza tu experiencia Premium</h3>
            <p>Elige cómo quieres acceder a todas las funciones de la calculadora más avanzada de impresión 3D:</p>
          </div>

          <div class="options-grid">
            <!-- Opción Trial Gratuito -->
            <div class="option-card trial-card">
              <div class="option-badge free">🆓 Recomendado</div>
              <h4>🎯 Prueba Gratuita</h4>
              <div class="option-price">
                <span class="price-big">GRATIS</span>
                <span class="price-period">7 días</span>
              </div>
              <p class="option-description">
                Prueba todas las funciones sin restricciones durante 7 días
              </p>
              <ul class="features-mini">
                <li>✅ Acceso completo inmediato</li>
                <li>✅ Sin tarjeta de crédito</li>
                <li>✅ Guardado ilimitado</li>
                <li>✅ Todas las funciones premium</li>
              </ul>
              <button class="btn-option btn-trial" data-action="start-trial">
                🎁 Comenzar Prueba Gratuita
              </button>
            </div>

            <!-- Opción Suscripción Directa -->
            <div class="option-card subscription-card">
              <div class="option-badge premium">💳 Directo</div>
              <h4>⭐ Suscripción Premium</h4>
              <div class="option-price">
                <span class="currency">$</span>
                <span class="price-big">5.000</span>
                <span class="price-period">ARS/mes</span>
              </div>
              <p class="option-description">
                Acceso inmediato y permanente a todas las funciones
              </p>
              <ul class="features-mini">
                <li>✅ Sin período de espera</li>
                <li>✅ Facturación mensual</li>
                <li>✅ Soporte prioritario</li>
                <li>✅ Nuevas funciones primero</li>
              </ul>
              <button class="btn-option btn-subscribe" data-action="subscribe">
                💳 Suscribirse Ahora
              </button>
            </div>
          </div>

          <div class="trial-note">
            <p>💡 <strong>Tip:</strong> Puedes comenzar con la prueba gratuita y suscribirte en cualquier momento dentro de los 7 días para continuar sin interrupción.</p>
          </div>
        </div>
      </div>
    `;

    // CSS específico para el modal de trial y suscripción
    const style = document.createElement('style');
    style.textContent = `
      .trial-options-container {
        text-align: center;
      }
      .welcome-message {
        margin-bottom: 30px;
      }
      .welcome-message h3 {
        margin: 0 0 12px;
        color: var(--text-primary);
        font-size: 1.3em;
      }
      .welcome-message p {
        margin: 0;
        color: var(--text-secondary);
        line-height: 1.5;
      }
      .options-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
        margin-bottom: 24px;
      }
      @media (max-width: 600px) {
        .options-grid {
          grid-template-columns: 1fr;
        }
      }
      .option-card {
        background: var(--bg-tertiary);
        border: 2px solid var(--border-primary);
        border-radius: 16px;
        padding: 24px;
        position: relative;
        transition: all 0.3s ease;
      }
      .option-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 25px rgba(0,0,0,0.2);
      }
      .trial-card {
        border-color: var(--terminal-green);
        box-shadow: 0 0 20px rgba(79, 154, 101, 0.2);
      }
      .subscription-card {
        border-color: #8b5cf6;
        box-shadow: 0 0 20px rgba(139, 92, 246, 0.2);
      }
      .option-badge {
        position: absolute;
        top: -12px;
        left: 50%;
        transform: translateX(-50%);
        padding: 6px 14px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .option-badge.free {
        background: var(--terminal-green);
        color: white;
      }
      .option-badge.premium {
        background: #8b5cf6;
        color: white;
      }
      .option-card h4 {
        margin: 16px 0 12px;
        color: var(--text-primary);
        font-size: 1.2em;
      }
      .option-price {
        margin: 16px 0;
        font-weight: 700;
      }
      .price-big {
        font-size: 2.2em;
        color: var(--terminal-green);
      }
      .subscription-card .price-big {
        color: #8b5cf6;
      }
      .currency {
        font-size: 1em;
        color: var(--terminal-green);
        vertical-align: top;
      }
      .subscription-card .currency {
        color: #8b5cf6;
      }
      .price-period {
        font-size: 0.9em;
        color: var(--text-secondary);
        display: block;
        margin-top: 4px;
      }
      .option-description {
        color: var(--text-secondary);
        font-size: 14px;
        line-height: 1.4;
        margin: 12px 0 16px;
      }
      .features-mini {
        list-style: none;
        padding: 0;
        margin: 16px 0;
        text-align: left;
      }
      .features-mini li {
        padding: 4px 0;
        color: var(--text-primary);
        font-size: 13px;
      }
      .btn-option {
        width: 100%;
        padding: 14px 20px;
        border: none;
        border-radius: 10px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.3s ease;
        margin-top: 16px;
      }
      .btn-trial {
        background: linear-gradient(135deg, var(--terminal-green), #10b981);
        color: white;
      }
      .btn-trial:hover {
        background: linear-gradient(135deg, #10b981, var(--terminal-green));
        transform: scale(1.02);
      }
      .btn-subscribe {
        background: linear-gradient(135deg, #8b5cf6, #7c3aed);
        color: white;
      }
      .btn-subscribe:hover {
        background: linear-gradient(135deg, #7c3aed, #6d28d9);
        transform: scale(1.02);
      }
      .trial-note {
        background: rgba(79, 154, 101, 0.1);
        border: 1px solid var(--terminal-green);
        border-radius: 8px;
        padding: 16px;
        text-align: left;
      }
      .trial-note p {
        margin: 0;
        font-size: 13px;
        color: var(--text-primary);
        line-height: 1.4;
      }
    `;
    document.head.appendChild(style);

    // Event listeners
    modal.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        modal.remove();
      }
      
      const action = e.target.dataset.action;
      if (action === 'start-trial') {
        this.handleTrialActivation(modal);
      } else if (action === 'subscribe') {
        // Cerrar modal actual y mostrar modal de pago
        modal.remove();
        setTimeout(() => {
          const paymentModal = this.createSubscriptionModal();
          document.body.appendChild(paymentModal);
          setTimeout(() => paymentModal.classList.add('show'), 10);
        }, 100);
      }
    });

    return modal;
  }

  // Manejar activación del trial gratuito
  async handleTrialActivation(modal) {
    try {
      if (!window.currentUser) {
        alert('Debes estar autenticado para activar el trial');
        return;
      }

      // Mostrar loading
      const button = modal.querySelector('.btn-trial');
      const originalText = button.textContent;
      button.textContent = '⏳ Activando trial...';
      button.disabled = true;

      // Activar trial
      await this.activateTrialForNewUser(window.currentUser.id);

      // Mostrar éxito
      button.textContent = '🎉 ¡Trial activado!';
      
      setTimeout(() => {
        modal.remove();
        
        // Actualizar UI
        if (typeof window.initializeSubscriptionSystem === 'function') {
          window.initializeSubscriptionSystem();
        }
        
        // Mostrar notificación de éxito
        alert('¡Perfecto! Tu prueba gratuita de 7 días está activa. ¡Disfruta de todas las funciones premium!');
        
        // Recargar página para aplicar cambios
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }, 1500);

    } catch (error) {
      console.error('Error activando trial:', error);
      
      // Restaurar botón
      const button = modal.querySelector('.btn-trial');
      button.textContent = originalText;
      button.disabled = false;
      
      alert('Error activando el trial: ' + error.message);
    }
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

  // Mostrar modal de gestión para usuarios con suscripción activa
  async showSubscriptionManagement() {
    console.log('🎛️ showSubscriptionManagement() llamado');
    
    try {
      console.log('📡 Obteniendo datos de suscripción actual...');
      const subscription = await this.getCurrentSubscription(window.currentUser.id);
      
      if (!subscription) {
        console.error('❌ No se pudo obtener la suscripción');
        alert('Error: No se pudo cargar la información de tu suscripción');
        return;
      }
      
      console.log('✅ Suscripción obtenida, creando modal de gestión:', subscription);
      const modal = this.createSubscriptionManagementModal(subscription);
      
      // Usar el helper showModal para consistencia
      this.showModal(modal);
      
    } catch (error) {
      console.error('❌ Error en showSubscriptionManagement:', error);
      alert('Error al cargar información de tu suscripción');
    }
  }

  // Crear modal de gestión de suscripción
  createSubscriptionManagementModal(subscription) {
    const modal = document.createElement('div');
    modal.className = 'subscription-modal';
    
    // Calcular días restantes
    const expiresAt = new Date(subscription.expires_at);
    const now = new Date();
    const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
    const formattedDate = expiresAt.toLocaleDateString('es-AR');
    const isExpired = daysLeft < 0;
    
    // Determinar el tipo de plan y estilo
    let planBadge = '';
    let planName = '';
    let statusColor = '';
    
    if (isExpired) {
      statusColor = '#dc2626';
      if (subscription.plan_type === 'trial') {
        planBadge = '❌ Prueba Expirada';
        planName = 'Plan de Prueba (Expirado)';
      } else if (subscription.plan_type === 'monthly') {
        planBadge = '❌ Plan Expirado';
        planName = 'Acceso Premium (Expirado)';
      } else if (subscription.plan_type === 'premium') {
        planBadge = '❌ Premium Expirado';
        planName = 'Plan Premium (Expirado)';
      }
    } else {
      if (subscription.plan_type === 'trial') {
        planBadge = '🎯 Prueba Gratuita';
        planName = 'Plan de Prueba';
        statusColor = '#f59e0b';
      } else if (subscription.plan_type === 'monthly') {
        planBadge = '💳 Plan Mensual';
        planName = 'Acceso Premium Mensual';
        statusColor = '#10b981';
      } else if (subscription.plan_type === 'premium') {
        planBadge = '⭐ Premium';
        planName = 'Plan Premium';
        statusColor = '#8b5cf6';
      }
    }

    modal.innerHTML = `
      <div class="modal-overlay"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>🎛️ Mi Suscripción</h2>
          <button class="modal-close" onclick="this.closest('.subscription-modal').remove()">✕</button>
        </div>
        
        <div class="subscription-management">
          <div class="current-subscription">
            <div class="subscription-badge" style="background: ${statusColor}">
              ${planBadge}
            </div>
            <h3>${planName}</h3>
            <div class="subscription-status">
              <div class="status-item">
                <span class="label">Estado:</span>
                <span class="value ${isExpired ? 'expired' : 'active'}">${isExpired ? '❌ Expirada' : '✅ Activa'}</span>
              </div>
              <div class="status-item">
                <span class="label">${isExpired ? 'Expiró hace:' : 'Días restantes:'}</span>
                <span class="value">${isExpired ? Math.abs(daysLeft) : daysLeft} días</span>
              </div>
              <div class="status-item">
                <span class="label">${isExpired ? 'Expiró el:' : 'Expira el:'}</span>
                <span class="value">${formattedDate}</span>
              </div>
            </div>
          </div>

          <div class="subscription-features">
            <h4>✨ Tienes acceso a:</h4>
            <ul class="feature-list">
              <li>✅ Calculadora de costos profesional</li>
              <li>✅ Guardado ilimitado de piezas</li>
              <li>✅ Generación de presupuestos HTML</li>
              <li>✅ Historial de versiones</li>
              <li>✅ Perfiles de gastos fijos</li>
              <li>✅ Autocompletado desde URLs</li>
              <li>✅ Soporte técnico prioritario</li>
            </ul>
          </div>

          ${isExpired ? `
          <div class="renewal-notice expired">
            <h4>❌ Suscripción Expirada</h4>
            <p>Tu suscripción expiró hace ${Math.abs(daysLeft)} días. Renueva para recuperar tu acceso premium:</p>
            <button class="btn-renew urgent" data-action="renew">
              🔄 Renovar Ahora ($5.000 ARS)
            </button>
          </div>
          ` : daysLeft <= 7 ? `
          <div class="renewal-notice">
            <h4>⚠️ Renovación próxima</h4>
            <p>Tu suscripción expira en ${daysLeft} días. Para mantener tu acceso premium:</p>
            <button class="btn-renew" data-action="renew">
              🔄 Renovar Suscripción ($5.000 ARS)
            </button>
          </div>
          ` : ''}

          <div class="subscription-actions">
            ${!isExpired && subscription.plan_type === 'monthly' ? `
            <button class="btn-cancel" data-action="cancel">
              ⚠️ Cancelar Suscripción
            </button>
            ` : ''}
            <button class="btn-secondary" data-action="close">
              ← Continuar usando ZetaLab
            </button>
          </div>
        </div>
      </div>
    `;

    // CSS específico para el modal de gestión
    const style = document.createElement('style');
    style.textContent = `
      .subscription-management {
        text-align: center;
      }
      .current-subscription {
        background: var(--bg-tertiary);
        border-radius: 16px;
        padding: 24px;
        margin-bottom: 24px;
        border: 2px solid var(--border-primary);
      }
      .subscription-badge {
        display: inline-block;
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 700;
        margin-bottom: 16px;
      }
      .current-subscription h3 {
        margin: 0 0 20px;
        color: var(--text-primary);
        font-size: 1.4em;
      }
      .subscription-status {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .status-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
      }
      .status-item .label {
        color: var(--text-secondary);
        font-size: 14px;
      }
      .status-item .value {
        color: var(--text-primary);
        font-weight: 600;
      }
      .status-item .value.active {
        color: var(--text-success);
      }
      .status-item .value.expired {
        color: #dc2626;
      }
      .subscription-features {
        text-align: left;
        margin-bottom: 24px;
      }
      .subscription-features h4 {
        text-align: center;
        margin-bottom: 16px;
        color: var(--text-primary);
      }
      .feature-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .feature-list li {
        padding: 6px 0;
        color: var(--text-primary);
        font-size: 14px;
      }
      .renewal-notice {
        background: rgba(245, 158, 11, 0.1);
        border: 1px solid #f59e0b;
        border-radius: 12px;
        padding: 20px;
        margin-bottom: 24px;
        text-align: center;
      }
      .renewal-notice.expired {
        background: rgba(220, 38, 38, 0.1);
        border: 1px solid #dc2626;
      }
      .renewal-notice.expired h4 {
        color: #dc2626;
      }
      .renewal-notice h4 {
        margin: 0 0 12px;
        color: #f59e0b;
      }
      .renewal-notice p {
        margin: 0 0 16px;
        color: var(--text-secondary);
        font-size: 14px;
      }
      .btn-renew {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .btn-renew:hover {
        background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
        transform: scale(1.02);
      }
      .btn-renew.urgent {
        background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);
        animation: pulse 2s infinite;
      }
      .btn-renew.urgent:hover {
        background: linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%);
      }
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }
      .subscription-actions {
        display: flex;
        justify-content: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .btn-secondary {
        background: var(--bg-tertiary);
        color: var(--text-primary);
        border: 1px solid var(--border-primary);
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .btn-secondary:hover {
        background: var(--bg-hover);
        border-color: var(--border-focus);
      }
      .btn-cancel {
        background: transparent;
        color: #dc2626;
        border: 1px solid #dc2626;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 14px;
      }
      .btn-cancel:hover {
        background: #dc2626;
        color: white;
        transform: scale(1.02);
      }
    `;
    document.head.appendChild(style);

    // Event listeners
    modal.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        modal.remove();
      }
      
      const action = e.target.dataset.action;
      if (action === 'close') {
        modal.remove();
      } else if (action === 'renew') {
        // Cerrar modal actual y mostrar modal de pago
        modal.remove();
        setTimeout(() => {
          const paymentModal = this.createSubscriptionModal();
          document.body.appendChild(paymentModal);
          setTimeout(() => paymentModal.classList.add('show'), 10);
        }, 100);
      } else if (action === 'cancel') {
        this.handleSubscriptionCancellation(subscription, modal);
      }
    });

    return modal;
  }

  // Manejar cancelación de suscripción
  async handleSubscriptionCancellation(subscription, modal) {
    const confirmed = confirm(
      '⚠️ ¿Estás seguro de que quieres cancelar tu suscripción?\n\n' +
      '• Perderás acceso a las funciones premium cuando expire\n' +
      '• Tu suscripción permanecerá activa hasta: ' + new Date(subscription.expires_at).toLocaleDateString('es-AR') + '\n' +
      '• Podrás suscribirte nuevamente en cualquier momento\n\n' +
      'Presiona OK para confirmar la cancelación.'
    );

    if (!confirmed) return;

    try {
      // Marcar como cancelada (desactivar)
      const { error } = await window.supa
        .from('subscriptions')
        .update({ active: false })
        .eq('id', subscription.id);

      if (error) throw error;

      // Mostrar confirmación
      alert('✅ Suscripción cancelada exitosamente.\n\nTu acceso premium permanecerá activo hasta ' + 
            new Date(subscription.expires_at).toLocaleDateString('es-AR') + '.');

      // Cerrar modal y actualizar UI
      modal.remove();
      
      // Actualizar el sistema de suscripciones
      if (typeof window.initializeSubscriptionSystem === 'function') {
        setTimeout(() => {
          window.initializeSubscriptionSystem();
        }, 1000);
      }

    } catch (error) {
      console.error('Error cancelando suscripción:', error);
      alert('Error cancelando la suscripción. Por favor intenta nuevamente.');
    }
  }

  // Verificar si es necesario mostrar modal
  async checkSubscriptionStatus(userId) {
    const hasActive = await this.hasActiveSubscription(userId);
    return hasActive;
  }

  // ELIMINADO - Esta funcionalidad ya no se usa
  // El botón de upgrade se maneja desde calculadora.html

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
                <span class="plan-price">$5.000 ARS/mes</span>
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
            <button class="btn-upgrade-premium" data-plan="monthly">
              ⭐ Upgrade por $5.000 ARS/mes
            </button>
            <p class="upgrade-note">
              💳 Pago seguro con MercadoPago • 🔒 Acceso mensual premium
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
        border: 1px solid var(--border-primary);
        border-radius: 8px;
        padding: 12px 16px;
        min-width: 120px;
      }
      .plan-item.premium {
        border-color: var(--terminal-green);
        box-shadow: 0 0 15px rgba(79, 154, 101, 0.2);
      }
      .plan-name {
        display: block;
        font-weight: 600;
        color: var(--text-primary);
      }
      .plan-price {
        display: block;
        font-size: 1.2em;
        color: var(--terminal-green);
        font-weight: 700;
      }
      .plan-features {
        display: block;
        font-size: 12px;
        color: var(--text-secondary);
        margin-top: 4px;
      }
      .upgrade-arrow {
        font-size: 24px;
        color: var(--terminal-green);
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
        color: var(--text-primary);
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
        color: var(--text-secondary);
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