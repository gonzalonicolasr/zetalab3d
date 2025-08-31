/* ==============================
   ZETALAB Admin Users Helper Functions
   Support functions for enhanced user display
============================== */

// Add helper methods to AdminUsers class
AdminUsers.prototype.getStatusText = function(statusClass) {
  const statusMap = {
    'active': '🟢 Activo',
    'inactive': '🟡 Inactivo', 
    'disabled': '🔴 Deshabilitado',
    'trial': '🔵 Prueba',
    'expired': '🟠 Expirado',
    'banned': '⚫ Bloqueado'
  };
  return statusMap[statusClass] || '🟢 Activo';
};

AdminUsers.prototype.getSubscriptionText = function(subscriptionType) {
  const subMap = {
    'free': 'Gratuito',
    'trial': 'Prueba 7 días',
    'monthly': 'Plan Mensual',
    'yearly': 'Plan Anual',
    'premium': 'Premium',
    'none': 'Sin Suscripción'
  };
  return subMap[subscriptionType] || 'Sin Suscripción';
};

AdminUsers.prototype.getActivityIndicator = function(user) {
  const score = user.activity_score || 0;
  const indicators = {
    5: { icon: '🟢', text: 'Muy Activo', class: 'very-high' },
    4: { icon: '🟢', text: 'Activo', class: 'high' },
    3: { icon: '🟡', text: 'Moderado', class: 'medium' },
    2: { icon: '🟠', text: 'Bajo', class: 'low' },
    1: { icon: '🔴', text: 'Muy Bajo', class: 'very-low' },
    0: { icon: '⚪', text: 'Inactivo', class: 'none' }
  };
  
  const indicator = indicators[score] || indicators[0];
  return `<div class="activity-indicator ${indicator.class}" title="${indicator.text}">
    ${indicator.icon}
  </div>`;
};

AdminUsers.prototype.getSubscriptionBadge = function(user) {
  const type = user.subscription_type || 'free';
  const status = user.subscription_status || 'none';
  
  let badgeClass = 'subscription-badge';
  let badgeText = this.getSubscriptionText(type);
  let badgeIcon = '💳';
  
  // Customize based on type
  switch(type) {
    case 'trial':
      badgeClass += ' trial';
      badgeIcon = '🎯';
      break;
    case 'monthly':
    case 'yearly':
    case 'premium':
      badgeClass += ' premium';
      badgeIcon = '⭐';
      break;
    case 'free':
    default:
      badgeClass += ' free';
      badgeIcon = '📦';
      break;
  }
  
  // Add status modifier
  if (status === 'expired' || status === 'canceled') {
    badgeClass += ' expired';
    badgeIcon = '⚠️';
  }
  
  return `<span class="${badgeClass}">
    ${badgeIcon} ${badgeText}
  </span>`;
};

AdminUsers.prototype.getEmailStatus = function(user) {
  if (user.email_confirmed_at) {
    return '<span class="verified-badge" title="Email verificado">✓</span>';
  } else {
    return '<span class="unverified-badge" title="Email no verificado">⚠️</span>';
  }
};

AdminUsers.prototype.getActivityRowClass = function(user) {
  const score = user.activity_score || 0;
  if (score >= 4) return 'high-activity-row';
  if (score >= 2) return 'medium-activity-row';
  if (score >= 1) return 'low-activity-row';
  return 'no-activity-row';
};

AdminUsers.prototype.displayEmail = function(user) {
  if (user.email && user.email.includes('@zetalab.local')) {
    return `<span class="placeholder-email" title="Email placeholder - Usuario identificado por ID">${user.id.substring(0, 12)}...</span>`;
  }
  return user.email || 'Sin email';
};

AdminUsers.prototype.getSubscriptionDetails = function(user) {
  if (!user.subscription || !user.subscription_expires_at) {
    return '<div class="subscription-detail">Sin fecha de expiración</div>';
  }
  
  const expiresAt = new Date(user.subscription_expires_at);
  const now = new Date();
  const isExpired = expiresAt < now;
  const daysUntilExpiry = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
  
  if (isExpired) {
    return '<div class="subscription-detail expired">⚠️ Expirada</div>';
  } else if (daysUntilExpiry <= 7) {
    return `<div class="subscription-detail warning">📅 ${daysUntilExpiry} día${daysUntilExpiry > 1 ? 's' : ''}</div>`;
  } else {
    return `<div class="subscription-detail active">📅 ${daysUntilExpiry} días</div>`;
  }
};

AdminUsers.prototype.formatDateShort = function(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-AR', { 
    day: '2-digit', 
    month: '2-digit',
    year: '2-digit'
  });
};

AdminUsers.prototype.formatDateLong = function(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-AR', { 
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

AdminUsers.prototype.getRelativeTime = function(dateString) {
  if (!dateString) return 'Nunca';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  if (diffInSeconds < 60) return 'Ahora';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d`;
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)}me`;
  return `${Math.floor(diffInSeconds / 31536000)}a`;
};

AdminUsers.prototype.getLastActivityText = function(user) {
  // Determine the most recent activity
  const activities = [
    { date: user.last_sign_in_at, label: 'Login' },
    { date: user.last_piece_created, label: 'Pieza' },
    { date: user.created_at, label: 'Registro' }
  ].filter(a => a.date).sort((a, b) => new Date(b.date) - new Date(a.date));
  
  if (activities.length === 0) return 'Sin actividad';
  
  const latest = activities[0];
  return `${this.getRelativeTime(latest.date)} (${latest.label})`;
};

AdminUsers.prototype.getActivityScore = function(user) {
  const score = user.activity_score || 0;
  const maxScore = 5;
  
  let scoreDisplay = '';
  for (let i = 1; i <= maxScore; i++) {
    if (i <= score) {
      scoreDisplay += '⭐';
    } else {
      scoreDisplay += '☆';
    }
  }
  
  return `<div class="activity-score" title="Puntuación de actividad: ${score}/5">
    ${scoreDisplay}
  </div>`;
};

// New user management methods
AdminUsers.prototype.manageUserSubscription = function(userId) {
  const user = this.users.find(u => u.id === userId);
  if (!user) return;
  
  // Create subscription management modal
  const modal = this.createSubscriptionModal(user);
  document.body.appendChild(modal);
  modal.classList.add('active');
};

AdminUsers.prototype.createSubscriptionModal = function(user) {
  const modal = document.createElement('div');
  modal.className = 'modal subscription-modal';
  modal.innerHTML = `
    <div class="modal-overlay"></div>
    <div class="modal-content">
      <div class="modal-header">
        <h3>💳 Gestionar Suscripción - ${user.email}</h3>
        <button class="modal-close">×</button>
      </div>
      <div class="modal-body">
        <div class="subscription-current">
          <h4>Estado Actual</h4>
          <div class="current-plan">
            ${this.getSubscriptionBadge(user)}
            ${this.getSubscriptionDetails(user)}
          </div>
        </div>
        
        <div class="subscription-actions">
          <h4>Acciones Disponibles</h4>
          <div class="action-grid">
            <button class="action-btn primary" onclick="adminUsers.activateTrial('${user.id}')">
              🎯 Activar Prueba
            </button>
            <button class="action-btn success" onclick="adminUsers.activatePremium('${user.id}')">
              ⭐ Activar Premium
            </button>
            <button class="action-btn warning" onclick="adminUsers.extendSubscription('${user.id}')">
              📅 Extender Tiempo
            </button>
            <button class="action-btn danger" onclick="adminUsers.cancelSubscription('${user.id}')">
              🚫 Cancelar
            </button>
          </div>
        </div>
        
        <div class="subscription-history">
          <h4>Historial de Pagos</h4>
          <div id="paymentHistory">Cargando...</div>
        </div>
      </div>
    </div>
  `;
  
  // Bind close events
  modal.querySelector('.modal-close').onclick = () => {
    modal.remove();
  };
  modal.querySelector('.modal-overlay').onclick = () => {
    modal.remove();
  };
  
  return modal;
};

AdminUsers.prototype.activateTrial = function(userId) {
  AdminUtils.showToast('Activando prueba de 7 días...', 'info');
  // Implementation would go here
};

AdminUsers.prototype.activatePremium = function(userId) {
  AdminUtils.showToast('Activando suscripción premium...', 'info');
  // Implementation would go here
};

AdminUsers.prototype.extendSubscription = function(userId) {
  AdminUtils.showToast('Extendiendo suscripción...', 'info');
  // Implementation would go here
};

AdminUsers.prototype.cancelSubscription = function(userId) {
  const confirmed = confirm('¿Está seguro de que desea cancelar la suscripción?');
  if (confirmed) {
    AdminUtils.showToast('Cancelando suscripción...', 'warning');
    // Implementation would go here
  }
};

AdminUsers.prototype.deleteUser = function(userId) {
  const user = this.users.find(u => u.id === userId);
  if (!user) return;
  
  const confirmed = confirm(
    `¿Está seguro de que desea eliminar permanentemente al usuario ${user.email}?\n\n` +
    `Esta acción no se puede deshacer y eliminará:\n` +
    `- ${user.piece_count} piezas\n` +
    `- ${user.version_count} versiones\n` +
    `- Todos los datos asociados`
  );
  
  if (confirmed) {
    const doubleConfirmed = confirm('CONFIRMACIÓN FINAL: Esta acción es irreversible. ¿Continuar?');
    if (doubleConfirmed) {
      AdminUtils.showToast('Eliminando usuario...', 'warning');
      // Implementation would go here
    }
  }
};

console.log('✅ Admin Users Helper Functions loaded');