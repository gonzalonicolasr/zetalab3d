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

composicion de la db:

-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.admin_activity_log (
id uuid NOT NULL DEFAULT gen_random_uuid(),
admin_id uuid NOT NULL,
action character varying NOT NULL,
resource_type character varying NOT NULL,
resource_id uuid,
details jsonb,
ip_address inet,
created_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT admin_activity_log_pkey PRIMARY KEY (id),
CONSTRAINT admin_activity_log_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admin_users(id)
);
CREATE TABLE public.admin_sessions (
id uuid NOT NULL DEFAULT gen_random_uuid(),
admin_id uuid NOT NULL,
login_at timestamp with time zone NOT NULL DEFAULT now(),
logout_at timestamp with time zone,
ip_address inet,
user_agent text,
session_duration_minutes integer,
CONSTRAINT admin_sessions_pkey PRIMARY KEY (id),
CONSTRAINT admin_sessions_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.admin_users(id)
);
CREATE TABLE public.admin_users (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid NOT NULL UNIQUE,
email character varying NOT NULL UNIQUE,
role character varying NOT NULL DEFAULT 'admin'::character varying CHECK (role::text = ANY (ARRAY['admin'::character varying, 'super_admin'::character varying]::text[])),
permissions jsonb NOT NULL DEFAULT '{"users": true, "analytics": true, "subscriptions": true}'::jsonb,
created_at timestamp with time zone NOT NULL DEFAULT now(),
created_by uuid,
last_login_at timestamp with time zone,
active boolean NOT NULL DEFAULT true,
notes text,
CONSTRAINT admin_users_pkey PRIMARY KEY (id),
CONSTRAINT admin_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
CONSTRAINT admin_users_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.admin_users(id)
);
CREATE TABLE public.config_profiles (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid NOT NULL,
name text NOT NULL,
config_data jsonb NOT NULL,
is_default boolean DEFAULT false,
is_public boolean DEFAULT false,
created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
consumo_w numeric DEFAULT 0,
precio_kwh numeric DEFAULT 0,
horas_desgaste integer DEFAULT 1,
precio_repuestos numeric DEFAULT 0,
margen_error numeric DEFAULT 0,
multiplicador numeric DEFAULT 1,
ml_fee numeric DEFAULT 0,
description text,
precio_kg numeric DEFAULT 0,
CONSTRAINT config_profiles_pkey PRIMARY KEY (id),
CONSTRAINT config_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.filaments (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid NOT NULL,
brand text,
material text,
color_name text,
color_hex text,
diameter_mm numeric DEFAULT 1.75,
stock_grams numeric,
spool_weight_grams numeric,
price_per_kg_ars numeric,
humidity_pct numeric,
notes text,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT filaments_pkey PRIMARY KEY (id),
CONSTRAINT filaments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.items (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid NOT NULL,
title text,
data jsonb,
created_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT items_pkey PRIMARY KEY (id),
CONSTRAINT items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.payment_transactions (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid NOT NULL,
subscription_id uuid,
mp_payment_id text,
mp_collection_id text,
mp_collection_status text,
mp_payment_type text,
amount numeric NOT NULL,
currency text DEFAULT 'ARS'::text,
description text,
status text NOT NULL DEFAULT 'pending'::text,
processed_at timestamp with time zone,
metadata jsonb DEFAULT '{}'::jsonb,
created_at timestamp with time zone DEFAULT now(),
updated_at timestamp with time zone DEFAULT now(),
CONSTRAINT payment_transactions_pkey PRIMARY KEY (id),
CONSTRAINT payment_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
CONSTRAINT payment_transactions_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.user_subscriptions(id)
);
CREATE TABLE public.piece_versions (
id uuid NOT NULL DEFAULT gen_random_uuid(),
piece_id uuid NOT NULL,
user_id uuid NOT NULL,
total numeric NOT NULL,
ml_price numeric,
params jsonb NOT NULL,
created_at timestamp with time zone DEFAULT now(),
CONSTRAINT piece_versions_pkey PRIMARY KEY (id),
CONSTRAINT piece_versions_piece_id_fkey FOREIGN KEY (piece_id) REFERENCES public.pieces(id)
);
CREATE TABLE public.pieces (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid NOT NULL,
title text NOT NULL,
category text,
filament_id uuid,
color_override text,
est_weight_grams numeric,
est_print_time_min integer,
est_price_ars numeric,
image_url text,
notes text,
created_at timestamp with time zone NOT NULL DEFAULT now(),
updated_at timestamp with time zone NOT NULL DEFAULT now(),
CONSTRAINT pieces_pkey PRIMARY KEY (id),
CONSTRAINT pieces_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
CONSTRAINT pieces_filament_id_fkey FOREIGN KEY (filament_id) REFERENCES public.filaments(id)
);
CREATE TABLE public.subscription_plans (
id uuid NOT NULL DEFAULT gen_random_uuid(),
name text NOT NULL,
slug text NOT NULL UNIQUE,
price_ars numeric NOT NULL DEFAULT 0,
currency text DEFAULT 'ARS'::text,
max_calculations_per_month integer DEFAULT 0,
max_pieces integer DEFAULT 0,
max_presets integer DEFAULT 0,
history_days integer DEFAULT 0,
can_export_html boolean DEFAULT false,
can_use_templates boolean DEFAULT false,
can_use_api boolean DEFAULT false,
can_use_advanced_analytics boolean DEFAULT false,
trial_days integer DEFAULT 0,
is_active boolean DEFAULT true,
created_at timestamp with time zone DEFAULT now(),
updated_at timestamp with time zone DEFAULT now(),
CONSTRAINT subscription_plans_pkey PRIMARY KEY (id)
);
CREATE TABLE public.subscriptions (
id integer NOT NULL DEFAULT nextval('subscriptions_id_seq'::regclass),
user_id uuid NOT NULL,
plan_type text NOT NULL CHECK (plan_type = ANY (ARRAY['trial'::text, 'monthly'::text])),
active boolean NOT NULL DEFAULT true,
created_at timestamp with time zone DEFAULT now(),
expires_at timestamp with time zone NOT NULL,
payment_id text,
amount numeric,
payment_status character varying,
CONSTRAINT subscriptions_pkey PRIMARY KEY (id),
CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.user_subscriptions (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid NOT NULL,
plan_id uuid NOT NULL,
status text NOT NULL DEFAULT 'trial'::text,
trial_started_at timestamp with time zone,
trial_ends_at timestamp with time zone,
current_period_start timestamp with time zone,
current_period_end timestamp with time zone,
canceled_at timestamp with time zone,
mp_subscription_id text,
mp_preapproval_id text,
created_at timestamp with time zone DEFAULT now(),
updated_at timestamp with time zone DEFAULT now(),
CONSTRAINT user_subscriptions_pkey PRIMARY KEY (id),
CONSTRAINT user_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
CONSTRAINT user_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id)
);
CREATE TABLE public.user_usage (
id uuid NOT NULL DEFAULT gen_random_uuid(),
user_id uuid NOT NULL,
subscription_id uuid NOT NULL,
month_year text NOT NULL,
calculations_used integer DEFAULT 0,
pieces_created integer DEFAULT 0,
presets_created integer DEFAULT 0,
html_exports integer DEFAULT 0,
api_calls integer DEFAULT 0,
created_at timestamp with time zone DEFAULT now(),
updated_at timestamp with time zone DEFAULT now(),
CONSTRAINT user_usage_pkey PRIMARY KEY (id),
CONSTRAINT user_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
CONSTRAINT user_usage_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.user_subscriptions(id)
);
