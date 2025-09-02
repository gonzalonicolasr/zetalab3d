# ZETALAB Admin Authentication System 🔐

Sistema de autenticación seguro para proteger el dashboard administrativo de ZETALAB.

## 🚀 Setup Inicial (Solo una vez)

### 1. Configurar primer administrador
```
Acceder a: /admin/setup-admin-user.html
- Completar datos del administrador
- Sistema creará usuario y permisos automáticamente
- 🔥 IMPORTANTE: Eliminar setup-admin-user.html después del uso
```

### 2. Estructura de archivos creada
```
admin/
├── login.html              # Página de login para admins
├── auth-guard.js            # Script de protección de autenticación
├── setup-admin-user.html    # Setup inicial (ELIMINAR después)
└── simple-real-data-dashboard.html # Dashboard protegido
```

## 🔐 Cómo funciona la autenticación

### Flujo de login
1. **admin/login.html**: Página de login con Supabase Auth
2. **Verificación dual**: Usuario válido + admin activo en `admin_users`
3. **Sesión segura**: Token JWT + datos de admin en localStorage
4. **Logging**: Registro de sesiones en `admin_sessions` y actividad en `admin_activity_log`

### Protección del dashboard
1. **auth-guard.js**: Se ejecuta automáticamente al cargar dashboard
2. **Verificación continua**: Cada 5 minutos verifica sesión
3. **Auto-logout**: 30 minutos de inactividad
4. **Service role protegido**: Solo accesible si admin autenticado

## 📊 Tablas de base de datos utilizadas

### admin_users
- Usuarios con permisos de administrador
- Roles: `admin`, `super_admin`
- Permisos granulares en JSON
- Campo `active` para activar/desactivar

### admin_sessions
- Registro de sesiones de login/logout
- IP address y user agent
- Duración de sesiones

### admin_activity_log
- Log completo de acciones de administrador
- Auditoría de operaciones sensibles
- Trazabilidad completa

## 🛡️ Características de Seguridad

### ✅ Implementadas
- Autenticación dual (Auth + admin_users)
- Verificación periódica de sesión
- Auto-logout por inactividad
- Logging completo de actividad
- Protección contra acceso directo
- Service role key solo accesible si autenticado
- Verificación de permisos por rol

### 🔒 Sesión Management
- Sesión almacenada en localStorage
- Verificación de expiración automática
- Refresh token handling
- Logout seguro con limpieza completa

## 🚪 Uso del sistema

### Para administradores
1. Acceder a `/admin/login.html`
2. Usar email/password del admin
3. Dashboard se abre automáticamente si autenticado
4. Botón "Cerrar Sesión" disponible en dashboard

### Para desarrollo
```javascript
// Verificar si usuario es admin autenticado
const admin = window.authGuard?.getCurrentAdmin();

// Verificar permisos específicos
const canManageUsers = window.authGuard?.checkPermission('users');

// Registrar actividad
window.authGuard?.logActivity(adminId, 'UPDATE', 'USER', userId, details);
```

## ⚠️ Consideraciones importantes

### Seguridad
- El service role key SOLO es accesible después de autenticación
- Las verificaciones se hacen tanto en frontend como con Supabase
- Todas las operaciones sensibles están protegidas
- Log de actividad para auditoría

### Mantenimiento
- Eliminar `setup-admin-user.html` después del setup inicial
- Monitorear logs de actividad regularmente
- Revisar sesiones activas en `admin_sessions`

## 🔧 Troubleshooting

### Problema: No puede acceder al dashboard
**Solución**: Verificar que el usuario esté en `admin_users` con `active = true`

### Problema: Sesión se cierra constantemente
**Solución**: Verificar conectividad y que el token no haya expirado

### Problema: Error de permisos
**Solución**: Verificar campo `permissions` en `admin_users`

## 📝 Logs y Monitoreo

### Consultar actividad reciente
```sql
SELECT * FROM admin_activity_log 
ORDER BY created_at DESC 
LIMIT 50;
```

### Ver sesiones activas
```sql
SELECT * FROM admin_sessions 
WHERE logout_at IS NULL 
ORDER BY login_at DESC;
```

### Administradores activos
```sql
SELECT * FROM admin_users 
WHERE active = true;
```