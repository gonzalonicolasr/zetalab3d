// ============================================
// SAFE ADMIN FUNCTIONS FOR ZETALAB
// Uses ONLY real database schema columns
// ============================================

// Global state management
const AdminState = {
    currentSection: 'dashboard',
    selectedItems: {
        subscriptions: new Set(),
        payments: new Set(),
        pieces: new Set()
    },
    data: {
        metrics: null,
        subscriptions: [],
        payments: [],
        pieces: []
    },
    filters: {
        subscriptions: { search: '', plan: '', active: '' },
        payments: { search: '', status: '', dateFrom: '', dateTo: '' },
        pieces: { search: '' }
    }
};

// ============================================
// INITIALIZATION AND NAVIGATION
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing ZETALAB Safe Admin Dashboard');
    
    initializeNavigation();
    initializeEventListeners();
    loadInitialData();
});

function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all links
            navLinks.forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            link.classList.add('active');
            
            // Get target section
            const targetSection = link.dataset.section;
            showSection(targetSection);
        });
    });
}

function showSection(sectionId) {
    // Hide all sections
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => section.classList.remove('active'));
    
    // Show target section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
        AdminState.currentSection = sectionId;
        
        // Load section-specific data
        loadSectionData(sectionId);
    }
}

function initializeEventListeners() {
    // Search filters
    document.getElementById('subscriptionSearch')?.addEventListener('input', debounce(filterSubscriptions, 300));
    document.getElementById('subscriptionPlanFilter')?.addEventListener('change', filterSubscriptions);
    document.getElementById('subscriptionActiveFilter')?.addEventListener('change', filterSubscriptions);
    
    document.getElementById('paymentSearch')?.addEventListener('input', debounce(filterPayments, 300));
    document.getElementById('paymentStatusFilter')?.addEventListener('change', filterPayments);
    document.getElementById('paymentDateFrom')?.addEventListener('change', filterPayments);
    document.getElementById('paymentDateTo')?.addEventListener('change', filterPayments);
    
    document.getElementById('pieceSearch')?.addEventListener('input', debounce(filterPieces, 300));
}

// ============================================
// DATA LOADING FUNCTIONS
// ============================================

async function loadInitialData() {
    try {
        showGlobalLoading(true);
        console.log('📊 Loading initial dashboard data...');
        
        // Load dashboard metrics
        await loadDashboardMetrics();
        
        showGlobalLoading(false);
        showNotification('Dashboard cargado correctamente', 'success');
        
    } catch (error) {
        console.error('❌ Error loading initial data:', error);
        showGlobalLoading(false);
        showNotification('Error cargando el dashboard', 'error');
    }
}

async function loadSectionData(sectionId) {
    switch(sectionId) {
        case 'subscriptions':
            await loadSubscriptionsData();
            break;
        case 'payments':
            await loadPaymentsData();
            break;
        case 'pieces':
            await loadPiecesData();
            break;
        default:
            break;
    }
}

// ============================================
// DASHBOARD METRICS
// ============================================

async function loadDashboardMetrics() {
    try {
        console.log('📊 Loading dashboard metrics...');
        
        const metrics = await calculateRealMetrics();
        
        // Update metric cards
        updateMetricCard('totalPieces', metrics.total_pieces || 0);
        updateMetricCard('totalCalculations', metrics.total_calculations || 0);
        updateMetricCard('activeSubscriptions', metrics.active_subscriptions || 0);
        updateMetricCard('totalRevenue', formatCurrency(metrics.total_revenue || 0));
        
        AdminState.data.metrics = metrics;
        console.log('✅ Dashboard metrics loaded');
        
    } catch (error) {
        console.error('❌ Error loading dashboard metrics:', error);
        showNotification('Error cargando métricas del dashboard', 'error');
    }
}

async function calculateRealMetrics() {
    try {
        console.log('🔄 Calculating real metrics from actual tables...');
        
        // Count pieces (usar solo columnas que existen)
        const { count: totalPieces, error: piecesError } = await supabase
            .from('pieces')
            .select('*', { count: 'exact', head: true });
        
        if (piecesError) {
            console.error('Error counting pieces:', piecesError);
        }
        
        // Count calculations (piece_versions)
        const { count: totalCalculations, error: versionsError } = await supabase
            .from('piece_versions')
            .select('*', { count: 'exact', head: true });
            
        if (versionsError) {
            console.error('Error counting versions:', versionsError);
        }
        
        // Count active subscriptions (usar solo active=true)
        const { count: activeSubscriptions, error: subsError } = await supabase
            .from('subscriptions')
            .select('*', { count: 'exact', head: true })
            .eq('active', true);
            
        if (subsError) {
            console.error('Error counting subscriptions:', subsError);
        }
        
        // Calculate revenue from payment_transactions (usar solo amount)
        const { data: payments, error: paymentsError } = await supabase
            .from('payment_transactions')
            .select('amount')
            .eq('status', 'approved');
        
        if (paymentsError) {
            console.error('Error fetching payments:', paymentsError);
        }
        
        const totalRevenue = payments?.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0) || 0;
        
        return {
            total_pieces: totalPieces || 0,
            total_calculations: totalCalculations || 0,
            active_subscriptions: activeSubscriptions || 0,
            total_revenue: totalRevenue
        };
        
    } catch (error) {
        console.error('❌ Error calculating real metrics:', error);
        return {
            total_pieces: 0,
            total_calculations: 0,
            active_subscriptions: 0,
            total_revenue: 0
        };
    }
}

function updateMetricCard(metricId, value) {
    const element = document.getElementById(metricId);
    if (element) {
        element.textContent = value;
        
        // Add animation
        element.classList.add('metric-updated');
        setTimeout(() => {
            element.classList.remove('metric-updated');
        }, 500);
    }
}

// ============================================
// SUBSCRIPTIONS MANAGEMENT
// ============================================

async function loadSubscriptionsData() {
    try {
        showTableLoading('subscriptionsTable');
        console.log('💳 Loading subscriptions data...');
        
        // Usar solo columnas reales: id, user_id, plan_type, active, created_at, expires_at, payment_id, amount, payment_status
        const { data: subscriptions, error } = await supabase
            .from('subscriptions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);
        
        if (error) {
            console.error('❌ Error loading subscriptions:', error);
            throw error;
        }
        
        AdminState.data.subscriptions = subscriptions || [];
        renderSubscriptionsTable(AdminState.data.subscriptions);
        
        console.log(`✅ Loaded ${subscriptions?.length || 0} subscriptions`);
        
    } catch (error) {
        console.error('❌ Error loading subscriptions:', error);
        showTableError('subscriptionsTable', 'Error cargando suscripciones');
    }
}

function renderSubscriptionsTable(subscriptions) {
    const tbody = document.getElementById('subscriptionsTable');
    if (!tbody) return;
    
    if (!subscriptions || subscriptions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted">
                    No hay suscripciones disponibles
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = subscriptions.map(sub => {
        // Calcular días hasta expiración
        const daysUntilExpiration = sub.expires_at ? 
            Math.ceil((new Date(sub.expires_at) - new Date()) / (1000 * 60 * 60 * 24)) : null;
            
        return `
        <tr onclick="openSubscriptionDetail('${sub.id}')" style="cursor: pointer;">
            <td onclick="event.stopPropagation()">
                <input type="checkbox" 
                       value="${sub.id}" 
                       onchange="toggleSubscriptionSelection('${sub.id}')">
            </td>
            <td>user-${sub.user_id.substring(0, 8)}</td>
            <td>
                <span class="plan-badge">
                    ${getPlanLabel(sub.plan_type)}
                </span>
            </td>
            <td>
                <span class="status-badge ${sub.active ? 'active' : 'inactive'}">
                    ${sub.active ? 'Activa' : 'Inactiva'}
                </span>
            </td>
            <td>${formatCurrency(sub.amount || 0)}</td>
            <td>${formatDate(sub.created_at)}</td>
            <td>${sub.expires_at ? formatDate(sub.expires_at) : 'Sin vencimiento'}</td>
            <td>${daysUntilExpiration !== null ? 
                (daysUntilExpiration > 0 ? `${daysUntilExpiration}d` : 'Vencida') : 
                '-'}</td>
            <td onclick="event.stopPropagation()">
                <button class="btn btn-sm btn-secondary" onclick="editSubscription('${sub.id}')">
                    Editar
                </button>
            </td>
        </tr>
    `;
    }).join('');
    
    // Update bulk actions visibility
    updateBulkActionsVisibility('subscription');
}

// ============================================
// PAYMENTS MANAGEMENT
// ============================================

async function loadPaymentsData() {
    try {
        showTableLoading('paymentsTable');
        console.log('💰 Loading payments data...');
        
        // Usar solo columnas reales de payment_transactions
        const { data: payments, error } = await supabase
            .from('payment_transactions')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);
        
        if (error) {
            console.error('❌ Error loading payments:', error);
            throw error;
        }
        
        AdminState.data.payments = payments || [];
        renderPaymentsTable(AdminState.data.payments);
        
        console.log(`✅ Loaded ${payments?.length || 0} payments`);
        
    } catch (error) {
        console.error('❌ Error loading payments:', error);
        showTableError('paymentsTable', 'Error cargando pagos');
    }
}

function renderPaymentsTable(payments) {
    const tbody = document.getElementById('paymentsTable');
    if (!tbody) return;
    
    if (!payments || payments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted">
                    No hay transacciones de pago disponibles
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = payments.map(payment => `
        <tr onclick="openPaymentDetail('${payment.id}')" style="cursor: pointer;">
            <td onclick="event.stopPropagation()">
                <input type="checkbox" 
                       value="${payment.id}" 
                       onchange="togglePaymentSelection('${payment.id}')">
            </td>
            <td>user-${payment.user_id.substring(0, 8)}</td>
            <td>${formatCurrency(payment.amount || 0)}</td>
            <td>
                <span class="status-badge ${normalizePaymentStatus(payment.status)}">
                    ${getPaymentStatusLabel(payment.status)}
                </span>
            </td>
            <td>${payment.mp_payment_id || 'N/A'}</td>
            <td>${formatDate(payment.created_at)}</td>
            <td onclick="event.stopPropagation()">
                <button class="btn btn-sm btn-danger" 
                        onclick="processRefund('${payment.id}')"
                        ${payment.status !== 'approved' ? 'disabled' : ''}>
                    Reembolso
                </button>
            </td>
        </tr>
    `).join('');
    
    // Update bulk actions visibility
    updateBulkActionsVisibility('payment');
}

// ============================================
// PIECES MANAGEMENT
// ============================================

async function loadPiecesData() {
    try {
        showTableLoading('piecesTable');
        console.log('🔧 Loading pieces data...');
        
        // Usar solo columnas reales de pieces
        const { data: pieces, error } = await supabase
            .from('pieces')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);
        
        if (error) {
            console.error('❌ Error loading pieces:', error);
            throw error;
        }
        
        AdminState.data.pieces = pieces || [];
        renderPiecesTable(AdminState.data.pieces);
        
        console.log(`✅ Loaded ${pieces?.length || 0} pieces`);
        
    } catch (error) {
        console.error('❌ Error loading pieces:', error);
        showTableError('piecesTable', 'Error cargando piezas');
    }
}

function renderPiecesTable(pieces) {
    const tbody = document.getElementById('piecesTable');
    if (!tbody) return;
    
    if (!pieces || pieces.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted">
                    No hay piezas disponibles
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = pieces.map(piece => `
        <tr onclick="openPieceDetail('${piece.id}')" style="cursor: pointer;">
            <td>${piece.title || 'Sin título'}</td>
            <td>user-${piece.user_id.substring(0, 8)}</td>
            <td>${formatDate(piece.created_at)}</td>
            <td>${formatCurrency(piece.est_price_ars || 0)}</td>
            <td>${(piece.est_weight_grams || 0)}g</td>
            <td onclick="event.stopPropagation()">
                <button class="btn btn-sm btn-secondary" onclick="viewPieceVersions('${piece.id}')">
                    Ver Versiones
                </button>
            </td>
        </tr>
    `).join('');
}

// ============================================
// ACTION HANDLERS
// ============================================

async function editSubscription(subscriptionId) {
    console.log('✏️ Editing subscription:', subscriptionId);
    
    const subscription = AdminState.data.subscriptions.find(s => s.id === subscriptionId);
    if (!subscription) return;
    
    const modalBody = `
        <div class="form-group">
            <label class="form-label">Plan (plan_type)</label>
            <select class="form-input" id="editSubscriptionPlan">
                <option value="trial" ${subscription.plan_type === 'trial' ? 'selected' : ''}>Trial</option>
                <option value="monthly" ${subscription.plan_type === 'monthly' ? 'selected' : ''}>Monthly</option>
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Activa</label>
            <select class="form-input" id="editSubscriptionActive">
                <option value="true" ${subscription.active ? 'selected' : ''}>Sí</option>
                <option value="false" ${!subscription.active ? 'selected' : ''}>No</option>
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Fecha de Vencimiento (expires_at)</label>
            <input type="datetime-local" class="form-input" id="editSubscriptionExpiry" 
                   value="${subscription.expires_at ? new Date(subscription.expires_at).toISOString().slice(0, -1) : ''}">
        </div>
        <div class="form-group">
            <label class="form-label">Monto</label>
            <input type="number" class="form-input" id="editSubscriptionAmount" 
                   value="${subscription.amount || 0}" step="0.01">
        </div>
        <div class="form-group">
            <label class="form-label">Estado de Pago (payment_status)</label>
            <input type="text" class="form-input" id="editSubscriptionPaymentStatus" 
                   value="${subscription.payment_status || ''}">
        </div>
    `;
    
    showEditModal('Editar Suscripción', modalBody, () => saveSubscriptionEdit(subscriptionId));
}

async function saveSubscriptionEdit(subscriptionId) {
    try {
        const planType = document.getElementById('editSubscriptionPlan').value;
        const active = document.getElementById('editSubscriptionActive').value === 'true';
        const expiresAt = document.getElementById('editSubscriptionExpiry').value;
        const amount = parseFloat(document.getElementById('editSubscriptionAmount').value) || 0;
        const paymentStatus = document.getElementById('editSubscriptionPaymentStatus').value;
        
        console.log('💾 Saving subscription edit:', { subscriptionId, planType, active, expiresAt, amount, paymentStatus });
        
        // Actualizar usando solo columnas reales
        const { error } = await supabase
            .from('subscriptions')
            .update({
                plan_type: planType,
                active: active,
                expires_at: expiresAt || null,
                amount: amount,
                payment_status: paymentStatus
            })
            .eq('id', subscriptionId);
        
        if (error) throw error;
        
        // Refresh subscriptions data
        await loadSubscriptionsData();
        
        closeEditModal();
        showNotification('Suscripción actualizada correctamente', 'success');
        
    } catch (error) {
        console.error('❌ Error saving subscription edit:', error);
        showNotification('Error actualizando suscripción: ' + error.message, 'error');
    }
}

async function processRefund(paymentId) {
    if (!confirm('¿Está seguro de que desea procesar este reembolso?')) return;
    
    try {
        console.log('💸 Processing refund for payment:', paymentId);
        
        // Actualizar el estado del pago
        const { error } = await supabase
            .from('payment_transactions')
            .update({
                status: 'refunded',
                description: (await supabase.from('payment_transactions').select('description').eq('id', paymentId).single()).data?.description + ' [REEMBOLSADO]'
            })
            .eq('id', paymentId);
        
        if (error) throw error;
        
        // Refresh payments data
        await loadPaymentsData();
        
        showNotification('Reembolso procesado correctamente', 'success');
        
    } catch (error) {
        console.error('❌ Error processing refund:', error);
        showNotification('Error procesando reembolso: ' + error.message, 'error');
    }
}

// Bulk operations
function toggleSubscriptionSelection(subscriptionId) {
    if (AdminState.selectedItems.subscriptions.has(subscriptionId)) {
        AdminState.selectedItems.subscriptions.delete(subscriptionId);
    } else {
        AdminState.selectedItems.subscriptions.add(subscriptionId);
    }
    
    updateBulkActionsVisibility('subscription');
}

function togglePaymentSelection(paymentId) {
    if (AdminState.selectedItems.payments.has(paymentId)) {
        AdminState.selectedItems.payments.delete(paymentId);
    } else {
        AdminState.selectedItems.payments.add(paymentId);
    }
    
    updateBulkActionsVisibility('payment');
}

function updateBulkActionsVisibility(type) {
    const selectedCount = AdminState.selectedItems[type + 's'].size;
    const bulkActions = document.getElementById(type + 'BulkActions');
    const bulkCount = document.getElementById(type + 'BulkCount');
    
    if (bulkActions && bulkCount) {
        if (selectedCount > 0) {
            bulkActions.classList.add('show');
            bulkCount.textContent = `${selectedCount} seleccionada${selectedCount > 1 ? 's' : ''}`;
        } else {
            bulkActions.classList.remove('show');
        }
    }
}

async function bulkExtendSubscriptions() {
    const selectedIds = Array.from(AdminState.selectedItems.subscriptions);
    if (selectedIds.length === 0) return;
    
    const days = prompt('¿Por cuántos días extender las suscripciones?', '30');
    if (!days || isNaN(days)) return;
    
    try {
        console.log(`📅 Extending ${selectedIds.length} subscriptions by ${days} days`);
        
        for (const id of selectedIds) {
            const subscription = AdminState.data.subscriptions.find(s => s.id === id);
            if (subscription) {
                const currentExpiry = new Date(subscription.expires_at || Date.now());
                const newExpiry = new Date(currentExpiry.getTime() + (parseInt(days) * 24 * 60 * 60 * 1000));
                
                await supabase
                    .from('subscriptions')
                    .update({ expires_at: newExpiry.toISOString() })
                    .eq('id', id);
            }
        }
        
        // Clear selections and refresh
        AdminState.selectedItems.subscriptions.clear();
        await loadSubscriptionsData();
        
        showNotification(`${selectedIds.length} suscripciones extendidas`, 'success');
        
    } catch (error) {
        console.error('❌ Error extending subscriptions:', error);
        showNotification('Error extendiendo suscripciones: ' + error.message, 'error');
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatCurrency(amount) {
    if (amount === null || amount === undefined) return '$0';
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0
    }).format(amount);
}

function getPlanLabel(planType) {
    const labels = {
        'trial': 'Trial',
        'monthly': 'Mensual'
    };
    return labels[planType] || planType;
}

function getPaymentStatusLabel(status) {
    const labels = {
        'approved': 'Aprobado',
        'pending': 'Pendiente',
        'cancelled': 'Cancelado',
        'rejected': 'Rechazado',
        'refunded': 'Reembolsado'
    };
    return labels[status] || status;
}

function normalizePaymentStatus(status) {
    const mapping = {
        'approved': 'success',
        'pending': 'warning',
        'cancelled': 'danger',
        'rejected': 'danger',
        'refunded': 'info'
    };
    return mapping[status] || 'secondary';
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// UI Helper Functions
function showGlobalLoading(show) {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        if (show) {
            mainContent.style.opacity = '0.6';
            mainContent.style.pointerEvents = 'none';
        } else {
            mainContent.style.opacity = '1';
            mainContent.style.pointerEvents = 'auto';
        }
    }
}

function showTableLoading(tableId) {
    const table = document.getElementById(tableId);
    if (table) {
        table.innerHTML = `
            <tr class="table-loading">
                <td colspan="10" style="text-align: center; padding: 40px;">
                    <div class="loading-spinner"></div>
                    <div style="margin-top: 10px;">Cargando datos...</div>
                </td>
            </tr>
        `;
    }
}

function showTableError(tableId, message) {
    const table = document.getElementById(tableId);
    if (table) {
        table.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 40px; color: var(--error);">
                    ❌ ${message}
                </td>
            </tr>
        `;
    }
}

function showEditModal(title, body, saveCallback) {
    const modal = document.getElementById('editModal');
    const modalTitle = document.getElementById('editModalTitle');
    const modalBody = document.getElementById('editModalBody');
    const saveButton = document.getElementById('saveEditButton');
    
    if (modal && modalTitle && modalBody && saveButton) {
        modalTitle.textContent = title;
        modalBody.innerHTML = body;
        
        saveButton.onclick = saveCallback;
        
        modal.classList.add('active');
    }
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notificationContainer');
    if (!container) {
        console.log(`${type.toUpperCase()}: ${message}`);
        return;
    }
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Hide and remove notification
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (container.contains(notification)) {
                container.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Filter functions
function filterSubscriptions() {
    const search = document.getElementById('subscriptionSearch')?.value.toLowerCase() || '';
    const plan = document.getElementById('subscriptionPlanFilter')?.value || '';
    const active = document.getElementById('subscriptionActiveFilter')?.value || '';
    
    let filtered = AdminState.data.subscriptions;
    
    if (search) {
        filtered = filtered.filter(sub => 
            sub.user_id.toLowerCase().includes(search) ||
            (sub.payment_id && sub.payment_id.toLowerCase().includes(search))
        );
    }
    
    if (plan) {
        filtered = filtered.filter(sub => sub.plan_type === plan);
    }
    
    if (active !== '') {
        filtered = filtered.filter(sub => sub.active === (active === 'true'));
    }
    
    renderSubscriptionsTable(filtered);
}

function filterPayments() {
    const search = document.getElementById('paymentSearch')?.value.toLowerCase() || '';
    const status = document.getElementById('paymentStatusFilter')?.value || '';
    const dateFrom = document.getElementById('paymentDateFrom')?.value || '';
    const dateTo = document.getElementById('paymentDateTo')?.value || '';
    
    let filtered = AdminState.data.payments;
    
    if (search) {
        filtered = filtered.filter(payment => 
            payment.user_id.toLowerCase().includes(search) ||
            (payment.mp_payment_id && payment.mp_payment_id.toLowerCase().includes(search))
        );
    }
    
    if (status) {
        filtered = filtered.filter(payment => payment.status === status);
    }
    
    if (dateFrom) {
        filtered = filtered.filter(payment => 
            new Date(payment.created_at) >= new Date(dateFrom)
        );
    }
    
    if (dateTo) {
        filtered = filtered.filter(payment => 
            new Date(payment.created_at) <= new Date(dateTo + 'T23:59:59')
        );
    }
    
    renderPaymentsTable(filtered);
}

function filterPieces() {
    const search = document.getElementById('pieceSearch')?.value.toLowerCase() || '';
    
    let filtered = AdminState.data.pieces;
    
    if (search) {
        filtered = filtered.filter(piece => 
            (piece.title && piece.title.toLowerCase().includes(search)) ||
            piece.user_id.toLowerCase().includes(search)
        );
    }
    
    renderPiecesTable(filtered);
}

// Refresh functions
async function refreshSubscriptions() {
    await loadSubscriptionsData();
    showNotification('Suscripciones actualizadas', 'success');
}

async function refreshPayments() {
    await loadPaymentsData();
    showNotification('Pagos actualizados', 'success');
}

async function refreshPieces() {
    await loadPiecesData();
    showNotification('Piezas actualizadas', 'success');
}

// Export functions
function exportSubscriptions() {
    exportToCSV(AdminState.data.subscriptions, 'subscriptions', [
        'user_id', 'plan_type', 'active', 'amount', 
        'created_at', 'expires_at', 'payment_status'
    ]);
}

function exportPayments() {
    exportToCSV(AdminState.data.payments, 'payments', [
        'user_id', 'amount', 'status', 'mp_payment_id', 
        'created_at', 'description'
    ]);
}

function exportPieces() {
    exportToCSV(AdminState.data.pieces, 'pieces', [
        'title', 'user_id', 'created_at', 'est_price_ars', 
        'est_weight_grams', 'updated_at'
    ]);
}

function exportToCSV(data, filename, columns) {
    if (!data || data.length === 0) {
        showNotification('No hay datos para exportar', 'warning');
        return;
    }
    
    // Create CSV content
    const headers = columns.join(',');
    const rows = data.map(item => 
        columns.map(col => {
            let value = item[col];
            if (value === null || value === undefined) value = '';
            if (typeof value === 'string' && value.includes(',')) {
                value = `"${value}"`;
            }
            return value;
        }).join(',')
    ).join('\n');
    
    const csv = headers + '\n' + rows;
    
    // Create and download file
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `zetalab-${filename}-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    showNotification(`Archivo ${filename}.csv descargado`, 'success');
}

// Detail view functions (placeholders)
function openSubscriptionDetail(subscriptionId) {
    console.log('💳 Opening subscription detail:', subscriptionId);
    showNotification(`Ver detalles de suscripción: ${subscriptionId}`, 'info');
}

function openPaymentDetail(paymentId) {
    console.log('💰 Opening payment detail:', paymentId);
    showNotification(`Ver detalles de pago: ${paymentId}`, 'info');
}

function openPieceDetail(pieceId) {
    console.log('🔧 Opening piece detail:', pieceId);
    showNotification(`Ver detalles de pieza: ${pieceId}`, 'info');
}

function viewPieceVersions(pieceId) {
    console.log('📋 Viewing piece versions:', pieceId);
    showNotification(`Ver versiones de pieza: ${pieceId}`, 'info');
}

console.log('✅ ZETALAB Safe Admin Dashboard functions loaded');