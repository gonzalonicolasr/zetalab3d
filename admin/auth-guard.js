/**
 * ZETALAB Admin Authentication Guard
 * Protege el dashboard verificando sesión de administrador válida
 */

// Configuración de Supabase (usando anon key para verificaciones)
const SUPABASE_URL = 'https://fwmyiovamcxvinoxnput.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3bXlpb3ZhbWN4dmlub3hucHV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzAzODksImV4cCI6MjA3MTc0NjM4OX0.ZiYf2v8C1U1ZjJQwJFhI7b2wz0Cjss3HT9VIzNn7uCE';

// Variable global para la sesión admin
let currentAdminSession = null;
let authGuardSupabase = null;

/**
 * Inicializar guard de autenticación
 */
async function initAuthGuard() {
    console.log('🔐 Inicializando Auth Guard...');
    
    // Crear cliente Supabase para verificaciones
    authGuardSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    try {
        // Verificar sesión existente
        const isAuthenticated = await checkAdminAuthentication();
        
        if (!isAuthenticated) {
            console.log('❌ No autenticado, redirigiendo a login...');
            redirectToLogin();
            return false;
        }
        
        console.log('✅ Usuario admin autenticado:', currentAdminSession.email);
        
        // Configurar verificación periódica de sesión
        startSessionMonitoring();
        
        // Configurar logout automático por inactividad (30 minutos)
        startInactivityMonitoring();
        
        return true;
        
    } catch (error) {
        console.error('❌ Error inicializando Auth Guard:', error);
        redirectToLogin();
        return false;
    }
}

/**
 * Verificar autenticación de administrador
 */
async function checkAdminAuthentication() {
    try {
        // 1. Obtener sesión del localStorage
        const adminSessionStr = localStorage.getItem('admin_session');
        
        if (!adminSessionStr) {
            console.log('❌ No hay sesión en localStorage');
            return false;
        }
        
        const adminSession = JSON.parse(adminSessionStr);
        
        // 2. Verificar expiración
        if (adminSession.expires_at && new Date(adminSession.expires_at) <= new Date()) {
            console.log('❌ Sesión expirada');
            clearSession();
            return false;
        }
        
        // 3. Verificar token con Supabase Auth
        const { data: { user }, error } = await authGuardSupabase.auth.getUser(adminSession.token);
        
        if (error || !user || user.id !== adminSession.user_id) {
            console.log('❌ Token inválido:', error?.message);
            clearSession();
            return false;
        }
        
        // 4. Verificar que sigue siendo admin activo
        const { data: adminUser, error: adminError } = await authGuardSupabase
            .from('admin_users')
            .select('*')
            .eq('user_id', adminSession.user_id)
            .eq('active', true)
            .single();
        
        if (adminError || !adminUser) {
            console.log('❌ Usuario ya no es admin activo');
            clearSession();
            return false;
        }
        
        // 5. Actualizar sesión actual
        currentAdminSession = {
            ...adminSession,
            admin_data: adminUser,
            last_check: new Date().toISOString()
        };
        
        // 6. Actualizar localStorage con datos frescos
        localStorage.setItem('admin_session', JSON.stringify(currentAdminSession));
        
        return true;
        
    } catch (error) {
        console.error('❌ Error verificando autenticación:', error);
        clearSession();
        return false;
    }
}

/**
 * Verificar permisos específicos del admin
 */
function checkPermission(permission) {
    if (!currentAdminSession || !currentAdminSession.admin_data) {
        return false;
    }
    
    const permissions = currentAdminSession.admin_data.permissions || {};
    return permissions[permission] === true;
}

/**
 * Obtener información del admin actual
 */
function getCurrentAdmin() {
    return currentAdminSession;
}

/**
 * Monitoreo periódico de la sesión (cada 5 minutos)
 */
function startSessionMonitoring() {
    setInterval(async () => {
        console.log('🔄 Verificando sesión admin...');
        const isValid = await checkAdminAuthentication();
        
        if (!isValid) {
            alert('Tu sesión de administrador ha expirado. Serás redirigido al login.');
            redirectToLogin();
        }
    }, 5 * 60 * 1000); // 5 minutos
}

/**
 * Monitoreo de inactividad (logout automático)
 */
function startInactivityMonitoring() {
    let lastActivity = Date.now();
    const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos
    
    // Detectar actividad del usuario
    const resetTimer = () => {
        lastActivity = Date.now();
    };
    
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
        document.addEventListener(event, resetTimer, true);
    });
    
    // Verificar inactividad cada minuto
    setInterval(() => {
        if (Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
            console.log('⏰ Logout por inactividad');
            alert('Sesión cerrada por inactividad (30 minutos)');
            logoutAdmin();
        }
    }, 60 * 1000);
}

/**
 * Logout del administrador
 */
async function logoutAdmin() {
    try {
        console.log('👋 Cerrando sesión admin...');
        
        if (currentAdminSession) {
            // Registrar logout en admin_sessions
            await authGuardSupabase
                .from('admin_sessions')
                .update({
                    logout_at: new Date().toISOString(),
                    session_duration_minutes: Math.floor(
                        (new Date() - new Date(currentAdminSession.created_at)) / (1000 * 60)
                    )
                })
                .eq('admin_id', currentAdminSession.admin_id)
                .eq('login_at', currentAdminSession.created_at);
            
            // Registrar actividad de logout
            await logAdminActivity(
                currentAdminSession.admin_id, 
                'LOGOUT', 
                'ADMIN_SESSION', 
                null,
                { logout_type: 'manual' }
            );
        }
        
        // Cerrar sesión de Supabase Auth
        await authGuardSupabase.auth.signOut();
        
    } catch (error) {
        console.warn('⚠️ Error en logout:', error);
    } finally {
        clearSession();
        redirectToLogin();
    }
}

/**
 * Limpiar sesión local
 */
function clearSession() {
    localStorage.removeItem('admin_session');
    currentAdminSession = null;
}

/**
 * Redirigir a login
 */
function redirectToLogin() {
    window.location.href = 'login.html';
}

/**
 * Registrar actividad del admin
 */
async function logAdminActivity(adminId, action, resourceType, resourceId = null, details = {}) {
    try {
        const ip = await getUserIP();
        
        await authGuardSupabase.from('admin_activity_log').insert({
            admin_id: adminId,
            action: action,
            resource_type: resourceType,
            resource_id: resourceId,
            details: {
                ...details,
                user_agent: navigator.userAgent,
                timestamp: new Date().toISOString()
            },
            ip_address: ip
        });
    } catch (error) {
        console.warn('⚠️ Error logging admin activity:', error);
    }
}

/**
 * Obtener IP del usuario
 */
async function getUserIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch {
        return null;
    }
}

/**
 * Crear botón de logout en el dashboard
 */
function addLogoutButton() {
    const header = document.querySelector('.header');
    if (header && !document.getElementById('logoutBtn')) {
        const logoutBtn = document.createElement('button');
        logoutBtn.id = 'logoutBtn';
        logoutBtn.innerHTML = '🚪 Cerrar Sesión';
        logoutBtn.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            border: none;
            padding: 10px 15px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: background 0.3s ease;
        `;
        
        logoutBtn.addEventListener('mouseover', () => {
            logoutBtn.style.background = '#ff6666';
        });
        
        logoutBtn.addEventListener('mouseout', () => {
            logoutBtn.style.background = '#ff4444';
        });
        
        logoutBtn.addEventListener('click', () => {
            if (confirm('¿Estás seguro de que quieres cerrar la sesión de administrador?')) {
                logoutAdmin();
            }
        });
        
        header.style.position = 'relative';
        header.appendChild(logoutBtn);
        
        // Mostrar información del admin
        if (currentAdminSession) {
            const adminInfo = document.createElement('div');
            adminInfo.style.cssText = `
                position: absolute;
                top: 60px;
                right: 20px;
                font-size: 0.8rem;
                color: #888;
                text-align: right;
            `;
            adminInfo.innerHTML = `
                Admin: ${currentAdminSession.email}<br>
                Rol: ${currentAdminSession.role || 'admin'}
            `;
            header.appendChild(adminInfo);
        }
    }
}

/**
 * Exponer funciones globales para uso en el dashboard
 */
window.authGuard = {
    init: initAuthGuard,
    checkPermission: checkPermission,
    getCurrentAdmin: getCurrentAdmin,
    logActivity: logAdminActivity,
    logout: logoutAdmin
};

// Auto-ejecutar cuando se carga el script
document.addEventListener('DOMContentLoaded', async () => {
    const isAuthenticated = await initAuthGuard();
    if (isAuthenticated) {
        addLogoutButton();
    }
});