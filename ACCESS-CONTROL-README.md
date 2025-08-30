# ZETALAB Access Control System

Sistema integral de control de acceso basado en suscripciones para la aplicación ZETALAB.

## 🎯 Descripción

Este sistema implementa controles de acceso granulares que restringen características premium basándose en el estado de suscripción del usuario. Permite una experiencia fluida donde los usuarios gratuitos pueden usar funciones básicas, pero se les solicita actualizar para características avanzadas.

## 🚀 Características

### Funciones Premium Protegidas

- **🔐 Guardado de Piezas** (`piece-saving`)
  - Guardar piezas calculadas en la base de datos
  - Acceso al historial de cálculos

- **📄 Exportación HTML** (`export-html`)
  - Generar presupuestos profesionales en HTML
  - Descarga de archivos de presupuesto

- **🔗 Autocompletado de URLs** (`auto-url-complete`)
  - Extracción automática de metadatos desde URLs
  - Autocompletado de nombres e imágenes

- **⚙️ Presets Avanzados** (`advanced-presets`)
  - Creación y gestión de perfiles personalizados
  - Guardado de configuraciones de gastos fijos

- **📁 Gestión de Piezas** (`piece-management`)
  - Página completa de administración de piezas
  - Acceso a `/mis-piezas.html`

- **📋 Historial de Versiones** (`version-history`)
  - Acceso al historial completo de modificaciones
  - Restauración de versiones anteriores

## 🔧 Implementación

### Archivos Principales

1. **`access-control.js`** - Sistema principal de control de acceso
2. **`calculadora.html`** - Integración en la calculadora principal
3. **`mis-piezas.html`** - Protección de página completa
4. **`app.js`** - Controles integrados en funciones críticas
5. **`style.css`** - Estilos para indicadores premium

### Inicialización

```javascript
// El sistema se inicializa automáticamente cuando el usuario está listo
window.addEventListener('userReady', () => {
  window.accessControl.initialize();
});
```

### Verificación de Acceso

```javascript
// Verificar acceso a una característica específica
const hasAccess = window.checkFeatureAccess('piece-saving');

if (!hasAccess) {
  window.accessControl.showUpgradePrompt('piece-saving');
  return;
}

// Proceder con la funcionalidad
```

## 🎨 Indicadores Visuales

### Indicadores Premium
- ⭐ Iconos dorados junto a funciones premium
- Tooltips informativos sobre requisitos
- Animaciones sutiles para llamar la atención

### Estados de Elementos
- **Deshabilitado**: Elementos premium inaccesibles para usuarios gratuitos
- **Overlays**: Capas informativas sobre funciones bloqueadas
- **Prompts de Upgrade**: Modales elegantes que explican beneficios premium

## 🔄 Flujo de Usuario

### Usuario Gratuito
1. Ve indicadores ⭐ junto a funciones premium
2. Al intentar usar función premium → Modal de upgrade
3. Puede usar funciones básicas sin restricciones
4. Call-to-action claro para upgrade

### Usuario Premium
1. Acceso completo a todas las funciones
2. Sin indicadores ni restricciones
3. Experiencia fluida y sin interrupciones

## 📱 Experiencia Responsive

- Modales adaptativos a diferentes tamaños de pantalla
- Indicadores premium optimizados para móvil
- Botones de upgrade accesibles en todas las resoluciones

## 🔒 Seguridad

### Client-Side
- Validación inmediata en la interfaz
- Prevención de acciones premium no autorizadas
- Manejo graceful de errores de acceso

### Server-Side
- Integración con sistema de suscripciones Supabase
- Validación de estado de suscripción en tiempo real
- RLS (Row Level Security) para protección de datos

## 🧪 Testing

### Herramientas de Testing
```javascript
// Simular usuario sin suscripción
window.testAccessControl.simulateSubscriptionChange(false);

// Simular usuario premium
window.testAccessControl.simulateSubscriptionChange(true);

// Mostrar estado actual
window.testAccessControl.showStatus();

// Restaurar estado original
window.testAccessControl.restore();
```

### Verificaciones Automáticas
- Test de inicialización del sistema
- Verificación de características protegidas
- Validación de elementos premium en DOM
- Control de eventos de suscripción

## 🎯 Beneficios

### Para el Negocio
- **Conversión**: Prompts contextuales aumentan conversiones
- **Retención**: Funciones básicas mantienen usuarios
- **Revenue**: Monetización efectiva de características avanzadas

### Para el Usuario
- **Claridad**: Sabe exactamente qué obtienes con Premium
- **Transparencia**: No hay sorpresas ni funciones ocultas
- **Valor**: Entiende el valor de la suscripción

### Para Desarrolladores
- **Modular**: Sistema fácil de extender
- **Mantenible**: Código organizado y documentado
- **Flexible**: Fácil agregar/quitar características premium

## 🔄 Mantenimiento

### Agregar Nueva Función Premium
1. Añadir ID a `premiumFeatures` set en `access-control.js`
2. Proteger función con `checkFeatureAccess()` 
3. Añadir indicador visual ⭐ en UI
4. Actualizar información de características

### Modificar Comportamientos
- Editar prompts de upgrade en `getFeatureInfo()`
- Ajustar estilos CSS para indicadores
- Personalizar mensajes y tooltips

## 📊 Métricas Recomendadas

- **Intentos de uso premium** por usuarios gratuitos
- **Click-through rate** en prompts de upgrade
- **Conversión** de gratuito a premium post-prompt
- **Abandono** vs **engagement** después de restricciones

## 🚀 Roadmap Future

- [ ] A/B testing de diferentes prompts de upgrade
- [ ] Límites de uso (ej: 3 cálculos gratis por día)
- [ ] Previsualización de funciones premium
- [ ] Sistema de puntos/gamificación
- [ ] Integración con analytics avanzados

---

*Sistema desarrollado como parte de ZETALAB - Calculadora profesional de costos de impresión 3D*