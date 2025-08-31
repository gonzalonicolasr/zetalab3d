# ZETALAB Admin Panel

Panel de administración completo para ZETALAB con interfaz gráfica moderna y funcionalidades avanzadas de gestión de usuarios.

## 🎯 Características

### ✅ Implementado
- **Autenticación de Administrador**: Sistema seguro de login con verificación de roles
- **Dashboard Principal**: Vista general con estadísticas y métricas clave
- **Gestión de Usuarios**: Lista, filtrado, búsqueda y administración completa
- **Visualizaciones**: Gráficos interactivos con Chart.js
- **Exportación de Datos**: Export CSV de usuarios y estadísticas
- **Tema Consistente**: Diseño que mantiene la estética terminal de ZETALAB
- **Responsive**: Totalmente adaptable a móviles y tablets

### 🚧 En Desarrollo
- Gestión de Suscripciones
- Analíticas Avanzadas
- Gestión de Piezas
- Configuración del Sistema

## 📁 Estructura de Archivos

```
admin/
├── index.html              # Página principal del admin
├── admin.css              # Estilos del panel admin
├── admin-config.js        # Configuración y utilidades
├── admin-auth.js          # Sistema de autenticación
├── admin-dashboard.js     # Dashboard y estadísticas
├── admin-users.js         # Gestión de usuarios
├── admin-charts.js        # Visualizaciones y gráficos
├── admin-main.js          # Controlador principal
└── README.md              # Esta documentación
```

## 🚀 Instalación y Configuración

### 1. Configuración de Administradores

Edita `admin-config.js` para configurar los administradores:

```javascript
const ADMIN_CONFIG = {
  // Emails con acceso de administrador
  ADMIN_DOMAINS: [
    'admin@zetalab.com', 
    'gonzalo@zetalab.com'
  ],
  
  // IDs de usuarios admin (opcional)
  ADMIN_USER_IDS: [
    // Agregar IDs después de crear usuarios admin
  ]
};
```

### 2. Configuración de Base de Datos

El admin panel utiliza las tablas existentes de ZETALAB:
- `pieces` - Piezas de usuarios
- `piece_versions` - Versiones de piezas

**Tabla opcional para mejorar funcionalidad:**

```sql
-- Tabla de suscripciones (opcional)
CREATE TABLE subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL DEFAULT 'trial',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Tabla de perfiles de usuario (opcional)
CREATE TABLE user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  role TEXT DEFAULT 'user',
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS para admin
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden ver todas las suscripciones
CREATE POLICY "Admin can view all subscriptions" ON subscriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );
```

### 3. Configuración de Permisos Supabase

Para acceso completo a `auth.users`, necesitas configurar RLS:

```sql
-- Política para que admins puedan ver usuarios
CREATE POLICY "Admin can view users" ON auth.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );
```

## 🔐 Sistema de Autenticación

### Verificación de Admin

El sistema verifica administradores mediante:

1. **Email en lista de dominios**: Emails en `ADMIN_DOMAINS`
2. **User IDs específicos**: IDs en `ADMIN_USER_IDS`  
3. **Metadata de usuario**: `user_metadata.role === 'admin'`
4. **Tabla de perfiles**: `user_profiles.is_admin = true`

### Crear Primer Admin

```javascript
// Método 1: Agregar email a la configuración
ADMIN_DOMAINS: ['tu-email@dominio.com']

// Método 2: Usar Supabase Auth Admin
const { data: user } = await supabase.auth.admin.updateUserById(
  'user-id',
  { 
    user_metadata: { role: 'admin' }
  }
)
```

## 📊 Funcionalidades del Dashboard

### Estadísticas Principales
- **Total de Usuarios**: Conteo de usuarios únicos
- **Suscripciones Activas**: Suscripciones vigentes
- **Piezas Creadas**: Total de piezas en el sistema
- **Ingresos Mensuales**: Estimación basada en suscripciones

### Gráficos Interactivos
- **Crecimiento de Usuarios**: Línea temporal de registros
- **Distribución de Suscripciones**: Gráfico de dona con tipos
- **Actividad Reciente**: Lista de eventos del sistema

## 👥 Gestión de Usuarios

### Características
- **Lista Paginada**: 25/50/100 usuarios por página
- **Filtros Avanzados**: Por estado, suscripción, fecha
- **Búsqueda**: Por email o ID de usuario
- **Acciones Masivas**: Habilitar/deshabilitar múltiples usuarios
- **Detalles Completos**: Modal con información detallada
- **Exportación**: CSV con datos de usuarios

### Estados de Usuario
- `active` - Usuario activo
- `trial` - En período de prueba
- `expired` - Suscripción expirada
- `disabled` - Usuario deshabilitado

### Tipos de Suscripción
- `premium` - Plan premium
- `basic` - Plan básico
- `trial` - Período de prueba
- `none` - Sin suscripción

## ⌨️ Atajos de Teclado

- `Ctrl/Cmd + 1-6` - Cambiar entre secciones
- `Ctrl/Cmd + R` - Actualizar sección actual
- `Ctrl/Cmd + E` - Exportar datos
- `Escape` - Cerrar modales
- `?` - Mostrar ayuda de atajos

## 🎨 Personalización de Tema

El admin panel hereda el tema terminal de ZETALAB:

```css
:root {
  --bg-primary: #0e1b17;      /* Fondo principal */
  --bg-secondary: #13251f;    /* Fondo secundario */
  --text-primary: #e8efe9;    /* Texto principal */
  --text-accent: #4f9a65;     /* Verde característico */
  --admin-accent: #dc2626;    /* Rojo para acciones admin */
}
```

## 📱 Compatibilidad

- **Navegadores**: Chrome 90+, Firefox 88+, Safari 14+
- **Responsive**: Optimizado para móviles y tablets
- **Resoluciones**: 320px - 4K+

## 🔧 Desarrollo y Extensión

### Agregar Nueva Sección

1. **HTML**: Crear sección en `index.html`
```html
<section id="mi-seccion" class="admin-section">
  <div class="section-header">
    <h2>Mi Sección</h2>
  </div>
  <!-- Contenido -->
</section>
```

2. **JavaScript**: Crear controlador
```javascript
class MiSeccion {
  async init() {
    // Inicialización
  }
}
```

3. **Navegación**: Agregar en sidebar
```html
<button class="nav-item" data-section="mi-seccion">
  <span class="nav-icon">🔧</span>
  <span class="nav-text">Mi Sección</span>
</button>
```

### Estructura de Componentes

```javascript
window.AdminConfig = {
  supabaseAdmin,    // Cliente Supabase
  ADMIN_CONFIG,     // Configuración
  AdminUtils,       // Utilidades
  AdminErrorHandler // Manejo de errores
};
```

## 🐛 Resolución de Problemas

### Problemas Comunes

**1. No puedo acceder como admin**
- Verificar que tu email esté en `ADMIN_DOMAINS`
- Revisar configuración en `admin-config.js`

**2. No cargan los usuarios**
- Verificar permisos RLS en Supabase
- Revisar logs del navegador para errores

**3. Gráficos no se muestran**
- Verificar que Chart.js se cargue correctamente
- Revisar errores de JavaScript en consola

**4. Datos no actualizados**
- Usar botón de actualización
- Verificar conexión a Supabase

### Logs y Debug

```javascript
// Habilitar logs detallados
localStorage.setItem('admin_debug', 'true');

// Ver estado de autenticación
console.log(window.adminAuth.getCurrentUser());

// Ver estadísticas del dashboard
console.log(window.AdminDashboard.stats);
```

## 📋 Lista de Tareas Futuras

- [ ] Gestión completa de suscripciones
- [ ] Sistema de notificaciones push
- [ ] Analíticas avanzadas con filtros personalizados
- [ ] Backup y restore de datos
- [ ] Gestión de contenido y configuración
- [ ] Sistema de auditoría y logs
- [ ] API REST para integración externa
- [ ] Dashboard personalizable con widgets

## 🤝 Soporte

Para soporte técnico:
1. Revisar logs del navegador (F12)
2. Verificar configuración en `admin-config.js`
3. Consultar documentación de Supabase
4. Contactar al equipo de desarrollo

---

**Versión**: 1.0.0  
**Última actualización**: Enero 2025  
**Compatibilidad**: ZETALAB v2.0+