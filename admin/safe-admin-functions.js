// ============================================
// SAFE ADMIN DASHBOARD FUNCTIONS FOR ZETALAB
// Handles missing tables/views gracefully with fallbacks
// ============================================

// Safe Supabase client initialization (reuse existing from main page)
// const { createClient } = supabase;
// const supabaseUrl = 'https://fwmyiovamcxvinoxnput.supabase.co';  
// const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3bXlpb3ZhbWN4dmluYXhucHV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTM4NTA5ODIsImV4cCI6MjAwOTQyNjk4Mn0.1qzT8K6i5CXVzehc1RYg6ZdGPFe26Ycbj6m2zxdOKnc';
// const supabase = createClient(supabaseUrl, supabaseKey);

// Utility function to safely execute Supabase queries
async function safeSupabaseQuery(tableName, queryFn, fallbackData = null) {
    try {
        const result = await queryFn();
        return result;
    } catch (error) {
        console.warn(`⚠️ Table/View '${tableName}' not available:`, error.message);
        return { data: fallbackData, error: null };
    }
}

// ============================================
// SAFE STATISTICS LOADING
// ============================================

async function loadStatsSafe() {
    try {
        console.log('🔄 Loading dashboard statistics safely...');
        
        // Try to get total users count (most reliable)
        const totalUsers = await getAllUsersCountSafe();
        
        // Count pieces and active users (safer approach)
        const { data: pieces, error: piecesError } = await safeSupabaseQuery('pieces',
            () => supabase.from('pieces').select('user_id, created_at')
        );
        
        const totalPieces = pieces?.length || 0;
        const activeUsers = new Set(pieces?.map(p => p.user_id)).size;
        
        // Count piece versions (calculations)
        const { data: versions, error: versionsError } = await safeSupabaseQuery('piece_versions',
            () => supabase.from('piece_versions').select('id, created_at')
        );
        
        const totalCalculations = versions?.length || 0;
        
        // Try subscription stats (with fallback)
        let totalSubscriptions = 0;
        let activeSubscriptions = 0;
        
        const { data: subscriptions } = await safeSupabaseQuery('subscriptions',
            () => supabase.from('subscriptions').select('status')
        );
        
        if (subscriptions) {
            totalSubscriptions = subscriptions.length;
            activeSubscriptions = subscriptions.filter(s => s.status === 'active').length;
        }
        
        // Update dashboard metrics
        updateMetricValue('totalUsers', totalUsers);
        updateMetricValue('totalPieces', totalPieces); 
        updateMetricValue('totalCalculations', totalCalculations);
        updateMetricValue('activeUsers', activeUsers);
        updateMetricValue('totalSubscriptions', totalSubscriptions);
        updateMetricValue('activeSubscriptions', activeSubscriptions);
        
        console.log('✅ Statistics loaded successfully');
        
    } catch (error) {
        console.error('❌ Error loading statistics:', error);
        showNotification('Error cargando estadísticas', 'error');
    }
}

async function getAllUsersCountSafe() {
    try {
        // First try the admin view if it exists
        const { data: adminUsers, error: adminError } = await safeSupabaseQuery('admin_user_activity',
            () => supabase.from('admin_user_activity').select('user_id', { count: 'exact' })
        );
        
        if (adminUsers) {
            return adminUsers.length;
        }
        
        // Fallback: count unique user_ids from pieces table
        const { data: pieces, error: piecesError } = await supabase
            .from('pieces')
            .select('user_id');
            
        if (pieces) {
            return new Set(pieces.map(p => p.user_id)).size;
        }
        
        return 0;
        
    } catch (error) {
        console.warn('Cannot determine user count:', error);
        return 0;
    }
}

// ============================================
// SAFE USER LOADING
// ============================================

async function loadUsersSafe() {
    try {
        console.log('🔄 Loading users data safely...');
        
        // Try admin view first
        let { data: usersData, error: usersError } = await safeSupabaseQuery('admin_user_activity',
            () => supabase.from('admin_user_activity').select('*').order('registered_at', { ascending: false }).limit(10)
        );
        
        if (!usersData || usersData.length === 0) {
            // Fallback: get users from pieces table
            console.log('📋 Using fallback user data from pieces table...');
            const { data: pieces } = await supabase
                .from('pieces')
                .select('user_id, created_at, name')
                .order('created_at', { ascending: false })
                .limit(10);
                
            // Create user-like objects from pieces data
            usersData = pieces?.map(piece => ({
                user_id: piece.user_id,
                email: `user-${piece.user_id.substring(0, 8)}@example.com`,
                registered_at: piece.created_at,
                total_pieces: 1,
                total_calculations: 0,
                activity_level: 'active',
                last_piece_created: piece.created_at
            })) || [];
        }
        
        // Update users table
        const usersTable = document.getElementById('usersTable');
        if (usersTable) {
            let html = '';
            
            if (usersData && usersData.length > 0) {
                usersData.forEach(user => {
                    html += `
                        <tr onclick="openUserDetail('${user.user_id}')">
                            <td>${user.email || 'N/A'}</td>
                            <td>${formatDate(user.registered_at || user.created_at)}</td>
                            <td>
                                <span class="activity-badge ${user.activity_level || 'unknown'}">
                                    ${user.activity_level || 'Unknown'}
                                </span>
                            </td>
                            <td>${user.total_pieces || 0}</td>
                            <td>${user.total_calculations || 0}</td>
                            <td>${formatDate(user.last_piece_created || user.last_calculation_date)}</td>
                        </tr>
                    `;
                });
            } else {
                html = `
                    <tr>
                        <td colspan="6" style="text-align: center; color: var(--text-secondary);">
                            No hay datos de usuarios disponibles
                        </td>
                    </tr>
                `;
            }
            
            usersTable.innerHTML = html;
        }
        
        console.log('✅ Users loaded successfully');
        
    } catch (error) {
        console.error('❌ Error loading users:', error);
        const usersTable = document.getElementById('usersTable');
        if (usersTable) {
            usersTable.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: var(--error);">
                        Error cargando usuarios: ${error.message}
                    </td>
                </tr>
            `;
        }
        showNotification('Error cargando usuarios', 'error');
    }
}

// ============================================
// SAFE SUBSCRIPTION LOADING
// ============================================

async function loadSubscriptionsSafe() {
    try {
        console.log('🔄 Loading subscriptions data safely...');
        
        // Try to load from admin view first
        let { data: subscriptions, error } = await safeSupabaseQuery('admin_subscriptions_safe',
            () => supabase.from('admin_subscriptions_safe').select('*').order('created_at', { ascending: false }).limit(10)
        );
        
        if (!subscriptions) {
            // Fallback: try basic subscriptions table
            console.log('📋 Using fallback subscription data...');
            const { data: basicSubs } = await safeSupabaseQuery('subscriptions',
                () => supabase.from('subscriptions').select('*').order('created_at', { ascending: false }).limit(10)
            );
            
            subscriptions = basicSubs?.map(sub => ({
                subscription_id: sub.id,
                user_id: sub.user_id,
                user_email: `user-${sub.user_id.substring(0, 8)}@example.com`,
                status: sub.status || 'unknown',
                type: sub.type || 'unknown',
                plan_name: 'Unknown Plan',
                plan_price: sub.amount || 0,
                created_at: sub.created_at,
                updated_at: sub.updated_at
            })) || [];
        }
        
        // Update subscriptions table
        const subscriptionsTable = document.getElementById('subscriptionsTable');
        if (subscriptionsTable) {
            let html = '';
            
            if (subscriptions && subscriptions.length > 0) {
                subscriptions.forEach(sub => {
                    html += `
                        <tr onclick="openSubscriptionDetail('${sub.subscription_id}')">
                            <td>${sub.user_email || 'N/A'}</td>
                            <td>
                                <span class="plan-badge">${sub.plan_name || 'N/A'}</span>
                            </td>
                            <td>
                                <span class="status-badge ${sub.status}">
                                    ${sub.status || 'Unknown'}
                                </span>
                            </td>
                            <td>$${sub.plan_price || 0}</td>
                            <td>${sub.type || 'N/A'}</td>
                            <td>${formatDate(sub.created_at)}</td>
                            <td>
                                <button onclick="editSubscription('${sub.subscription_id}')" 
                                        class="action-btn">
                                    Editar
                                </button>
                            </td>
                        </tr>
                    `;
                });
            } else {
                html = `
                    <tr>
                        <td colspan="7" style="text-align: center; color: var(--text-secondary);">
                            No hay suscripciones disponibles
                        </td>
                    </tr>
                `;
            }
            
            subscriptionsTable.innerHTML = html;
        }
        
        console.log('✅ Subscriptions loaded successfully');
        
    } catch (error) {
        console.error('❌ Error loading subscriptions:', error);
        const subscriptionsTable = document.getElementById('subscriptionsTable');
        if (subscriptionsTable) {
            subscriptionsTable.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: var(--error);">
                        Error cargando suscripciones: ${error.message}
                    </td>
                </tr>
            `;
        }
        showNotification('Error cargando suscripciones', 'error');
    }
}

// ============================================
// SAFE PAYMENT LOADING
// ============================================

async function loadPaymentsSafe() {
    try {
        console.log('🔄 Loading payments data safely...');
        
        // Try admin payments view first
        let { data: payments, error } = await safeSupabaseQuery('admin_payments_view',
            () => supabase.from('admin_payments_view').select('*').order('payment_date', { ascending: false }).limit(10)
        );
        
        if (!payments) {
            // Fallback: try basic payment_transactions table
            console.log('📋 Using fallback payment data...');
            const { data: basicPayments } = await safeSupabaseQuery('payment_transactions',
                () => supabase.from('payment_transactions').select('*').order('created_at', { ascending: false }).limit(10)
            );
            
            payments = basicPayments?.map(payment => ({
                payment_id: payment.id,
                user_id: payment.user_id,
                user_email: `user-${payment.user_id.substring(0, 8)}@example.com`,
                amount: payment.amount || 0,
                status: payment.status || 'unknown',
                payment_method: payment.payment_method || 'N/A',
                payment_provider: payment.payment_provider || 'N/A',
                payment_date: payment.created_at,
                provider_fee: payment.provider_fee || 0,
                net_amount: payment.net_amount || payment.amount || 0
            })) || [];
        }
        
        // Update payments table
        const paymentsTable = document.getElementById('paymentsTable');
        if (paymentsTable) {
            let html = '';
            
            if (payments && payments.length > 0) {
                payments.forEach(payment => {
                    html += `
                        <tr onclick="openPaymentDetail('${payment.payment_id}')">
                            <td>
                                <input type="checkbox" class="payment-checkbox" 
                                       value="${payment.payment_id}" 
                                       onchange="togglePaymentSelection('${payment.payment_id}')" 
                                       onclick="event.stopPropagation()">
                            </td>
                            <td>${payment.user_email || 'N/A'}</td>
                            <td>$${payment.amount || 0}</td>
                            <td>
                                <span class="status-badge ${payment.status}">
                                    ${payment.status || 'Unknown'}
                                </span>
                            </td>
                            <td>${payment.payment_method || 'N/A'}</td>
                            <td>${payment.payment_provider || 'N/A'}</td>
                            <td>${formatDate(payment.payment_date)}</td>
                            <td>$${payment.provider_fee || 0}</td>
                            <td>$${payment.net_amount || 0}</td>
                            <td>
                                <button onclick="processRefund('${payment.payment_id}')" 
                                        class="action-btn ${payment.status === 'completed' ? '' : 'disabled'}"
                                        ${payment.status !== 'completed' ? 'disabled' : ''}>
                                    Reembolso
                                </button>
                            </td>
                        </tr>
                    `;
                });
            } else {
                html = `
                    <tr>
                        <td colspan="10" style="text-align: center; color: var(--text-secondary);">
                            No hay transacciones de pago disponibles
                        </td>
                    </tr>
                `;
            }
            
            paymentsTable.innerHTML = html;
        }
        
        console.log('✅ Payments loaded successfully');
        
    } catch (error) {
        console.error('❌ Error loading payments:', error);
        const paymentsTable = document.getElementById('paymentsTable');
        if (paymentsTable) {
            paymentsTable.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align: center; color: var(--error);">
                        Error cargando pagos: ${error.message}
                    </td>
                </tr>
            `;
        }
        showNotification('Error cargando pagos', 'error');
    }
}

// ============================================
// SAFE PIECES LOADING
// ============================================

async function loadPiecesSafe() {
    try {
        console.log('🔄 Loading pieces data safely...');
        
        // This should work as pieces is a core table
        const { data: pieces, error } = await supabase
            .from('pieces')
            .select('id, name, user_id, created_at, updated_at')
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        
        // Update pieces table
        const piecesTable = document.getElementById('piecesTable');
        if (piecesTable) {
            let html = '';
            
            if (pieces && pieces.length > 0) {
                pieces.forEach(piece => {
                    html += `
                        <tr onclick="openPieceDetail('${piece.id}')">
                            <td>${piece.name || 'Sin nombre'}</td>
                            <td>user-${piece.user_id.substring(0, 8)}@example.com</td>
                            <td>${formatDate(piece.created_at)}</td>
                            <td>$0</td>
                            <td>
                                <button onclick="viewPieceVersions('${piece.id}')" 
                                        class="action-btn">
                                    Ver Versiones
                                </button>
                            </td>
                        </tr>
                    `;
                });
            } else {
                html = `
                    <tr>
                        <td colspan="5" style="text-align: center; color: var(--text-secondary);">
                            No hay piezas disponibles
                        </td>
                    </tr>
                `;
            }
            
            piecesTable.innerHTML = html;
        }
        
        console.log('✅ Pieces loaded successfully');
        
    } catch (error) {
        console.error('❌ Error loading pieces:', error);
        const piecesTable = document.getElementById('piecesTable');
        if (piecesTable) {
            piecesTable.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; color: var(--error);">
                        Error cargando piezas: ${error.message}
                    </td>
                </tr>
            `;
        }
        showNotification('Error cargando piezas', 'error');
    }
}

// ============================================
// SAFE MAIN DATA LOADING FUNCTION
// ============================================

async function loadAllDataSafe() {
    try {
        console.log('🔄 Loading all dashboard data safely...');
        
        // Show loading indicators
        showGlobalLoadingState();
        
        // Load data in parallel with error isolation
        await Promise.allSettled([
            loadStatsSafe(),
            loadUsersSafe(), 
            loadSubscriptionsSafe(),
            loadPiecesSafe(),
            loadPaymentsSafe()
        ]);
        
        hideGlobalLoadingState();
        console.log('✅ All dashboard data loaded');
        showNotification('Dashboard cargado correctamente', 'success');
        
    } catch (error) {
        console.error('❌ Critical error loading dashboard:', error);
        hideGlobalLoadingState();
        showNotification('Error crítico cargando dashboard', 'error');
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function showGlobalLoadingState() {
    // Add loading class to main container
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.classList.add('loading');
    }
}

function hideGlobalLoadingState() {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.classList.remove('loading');
    }
}

function showLoadingState(tableId) {
    const table = document.getElementById(tableId);
    if (table) {
        table.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 40px;">
                    <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
                        <div class="loading-spinner"></div>
                        Cargando datos...
                    </div>
                </td>
            </tr>
        `;
    }
}

// ============================================
// EXPORT FUNCTIONS FOR GLOBAL USE
// ============================================

// Replace the original functions with safe versions
window.loadStats = loadStatsSafe;
window.loadUsers = loadUsersSafe;
window.loadSubscriptions = loadSubscriptionsSafe;
window.loadPieces = loadPiecesSafe;
window.loadPayments = loadPaymentsSafe;
window.loadAllData = loadAllDataSafe;

console.log('✅ Safe admin functions loaded and ready');