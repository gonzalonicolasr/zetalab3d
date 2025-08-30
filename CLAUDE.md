# CLAUDE.md

Este archivo proporciona orientación a Claude Code (claude.ai/code) al trabajar con código en este repositorio.

## Descripción del Proyecto

ZETALAB es una aplicación web para calcular costos de impresión 3D que incluye:
- Sistema de autenticación con Supabase
- Calculadora de precios de piezas 3D
- Gestión de piezas guardadas con historial de versiones
- Generación de presupuestos en HTML

## Arquitectura de Alto Nivel

### Frontend
- **Aplicación vanilla JavaScript** (sin frameworks)
- **Páginas principales**:
  - `index.html`: Login/registro con Supabase Auth
  - `calculadora.html`: Calculadora principal de costos
  - `mis-piezas.html`: Gestión de piezas guardadas

### Backend/Base de Datos
- **Supabase** como backend-as-a-service
- **Tablas principales**:
  - `pieces`: Piezas guardadas del usuario
  - `piece_versions`: Historial de versiones/cálculos de cada pieza
- **Autenticación**: Supabase Auth con email/password y magic links

### Estructura de Archivos
```
├── index.html          # Página de login/registro
├── calculadora.html    # Calculadora principal
├── mis-piezas.html     # Listado de piezas guardadas
├── app.js             # Lógica principal de la calculadora
├── auth.js            # Guard de autenticación (ES Module)
├── mis-piezas.js      # Lógica del listado de piezas (ES Module)
├── style.css          # Estilos globales con tema oscuro
├── logo.png           # Logo de la aplicación
└── batpuertos.bat     # Script para cerrar procesos en puerto
```

## Sistema de Cálculo de Costos

El núcleo del negocio está en `app.js` función `calcular()`:

1. **Gastos fijos**: Material (kg), energía (kWh), desgaste de máquina, repuestos
2. **Parámetros de pieza**: Tiempo (h/min), gramos de filamento, insumos
3. **Margen**: Multiplicador de ganancia y comisión de MercadoLibre
4. **Fórmula**: `(material + energía + desgaste + error) × multiplicador + insumos + ML_fee`

## Persistencia de Datos

### LocalStorage
- `zl_calc_form`: Estado completo del formulario de calculadora
- `zl_calc_fixed_presets`: Perfiles de gastos fijos guardados
- Transferencia de datos entre páginas vía localStorage

### Supabase
- Las piezas se guardan en tabla `pieces` con metadatos
- Cada cálculo crea una versión en `piece_versions` con parámetros completos
- RLS (Row Level Security) activo por usuario

## Comandos de Desarrollo

Este proyecto es frontend puro, sin build system:

### Servidor Local
```bash
# Cualquier servidor HTTP estático, ej:
python -m http.server 8000
# o
npx serve .
```

### Debugging
- Usar herramientas de desarrollo del navegador
- Console.log está presente para debugging de errores Supabase

## Edge Functions y Proxy

- `og-proxy`: Edge function en Supabase para extraer metadatos OpenGraph
- Se usa para autocompletar nombre e imagen desde URLs de MakerWorld

## Configuración Supabase

Las credenciales están hardcodeadas en el código (típico para keys públicas):
- URL: `https://fwmyiovamcxvinoxnput.supabase.co`
- Anon Key: Visible en `index.html` y `app.js`

## Características Especiales

### Generación de Presupuestos
- `buildClientHtml()` en `app.js` genera HTML standalone
- Dos modos: detalle discreto vs. detalle completo
- Descarga automática como archivo HTML

### Gestión de Versiones
- Cada guardado de pieza crea snapshot completo de parámetros
- Historial navegable con restauración de versiones anteriores
- UI de acordeón para mostrar historial

### Sistema de Presets
- Perfiles de gastos fijos reutilizables
- Almacenados en localStorage del usuario
- CRUD completo con nombres personalizables



## 🎯 Ejemplo de interacción esperada
Usuario:  
```
Agregá validación de email en el registro
```

Claude (responde):  
```js
// auth.js
function validarEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Uso en el form
if (!validarEmail(user.email)) {
  alert("Email inválido");
  return;
}
```
## 🛠️ Reglas para Claude (Optimización de tokens)

- **No repitas** descripción de Supabase ni arquitectura, ya está arriba.
- **Siempre mostrar solo snippets o diffs** de código modificados, nunca archivos completos salvo que se pida explícito.
- **Comentar brevemente en el código** los cambios hechos (1-2 líneas).
- Si hay varias correcciones → listá primero en bullets, luego mostrá ejemplos mínimos.
- Cuando generes código nuevo → respetar estructura modular (un archivo por responsabilidad).
- **No reescribir boilerplate** de NestJS/JS ni copiar dependencias ya conocidas.
- Cuando termines una tarea → entregar un **resumen breve** (ej: “Agregué validación X en Y y actualicé Z”).