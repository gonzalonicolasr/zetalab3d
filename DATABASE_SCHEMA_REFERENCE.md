# ZETALAB Database Schema Reference

Esta es la documentación completa del esquema de base de datos de ZETALAB para referencia en desarrollo. **IMPORTANTE**: Solo usar tablas y columnas que existen realmente según esta documentación.

## Información General

- **Base de datos**: Supabase PostgreSQL
- **URL**: https://fwmyiovamcxvinoxnput.supabase.co
- **Esquemas**: `auth`, `public`
- **RLS**: Activo por usuario
- **Última actualización**: 2025-09-01

---

## AUTH SCHEMA TABLES

### auth.users
Tabla principal de usuarios de Supabase Auth.
```sql
CREATE TABLE auth.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID,
  aud VARCHAR(255),
  role VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  encrypted_password VARCHAR(255),
  email_confirmed_at TIMESTAMP WITH TIME ZONE,
  invited_at TIMESTAMP WITH TIME ZONE,
  confirmation_token VARCHAR(255),
  confirmation_sent_at TIMESTAMP WITH TIME ZONE,
  recovery_token VARCHAR(255),
  recovery_sent_at TIMESTAMP WITH TIME ZONE,
  email_change_token_new VARCHAR(255),
  email_change VARCHAR(255),
  email_change_sent_at TIMESTAMP WITH TIME ZONE,
  last_sign_in_at TIMESTAMP WITH TIME ZONE,
  raw_app_meta_data JSONB,
  raw_user_meta_data JSONB,
  is_super_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  phone VARCHAR(15),
  phone_confirmed_at TIMESTAMP WITH TIME ZONE,
  phone_change VARCHAR(15),
  phone_change_token VARCHAR(255),
  phone_change_sent_at TIMESTAMP WITH TIME ZONE,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  email_change_token_current VARCHAR(255),
  email_change_confirm_status SMALLINT DEFAULT 0,
  banned_until TIMESTAMP WITH TIME ZONE,
  reauthentication_token VARCHAR(255),
  reauthentication_sent_at TIMESTAMP WITH TIME ZONE,
  is_sso_user BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE
);
```

### auth.sessions
Sesiones activas de usuarios.
```sql
CREATE TABLE auth.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  factor_id UUID,
  aal TEXT,
  not_after TIMESTAMP WITH TIME ZONE
);
```

### auth.refresh_tokens
Tokens de renovación de sesión.
```sql
CREATE TABLE auth.refresh_tokens (
  instance_id UUID,
  id BIGSERIAL PRIMARY KEY,
  token VARCHAR(255) UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  parent VARCHAR(255),
  session_id UUID REFERENCES auth.sessions(id) ON DELETE CASCADE
);
```

### auth.identities
Identidades vinculadas (OAuth, email, etc.).
```sql
CREATE TABLE auth.identities (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  identity_data JSONB NOT NULL,
  provider TEXT NOT NULL,
  last_sign_in_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Otras tablas auth.*
- `auth.audit_log_entries`: Log de auditoría de Supabase
- `auth.flow_state`: Estado de flujos OAuth
- `auth.instances`: Instancias de la aplicación
- `auth.mfa_*`: Tablas de autenticación multifactor
- `auth.one_time_tokens`: Tokens de un solo uso
- `auth.saml_*`: Configuración SAML
- `auth.sso_*`: Configuración SSO
- `auth.schema_migrations`: Migraciones del esquema auth

---

## PUBLIC SCHEMA TABLES

### pieces
Tabla principal de piezas 3D guardadas por usuarios.
```sql
CREATE TABLE pieces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT,
  source_url TEXT,
  tags TEXT[] DEFAULT '{}',
  is_favorite BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_pieces_user_id ON pieces(user_id);
CREATE INDEX idx_pieces_user_created ON pieces(user_id, created_at DESC);
CREATE INDEX idx_pieces_user_favorite ON pieces(user_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX idx_pieces_tags ON pieces USING GIN(tags);

-- RLS Policies
ALTER TABLE pieces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own pieces" ON pieces
  FOR ALL USING (auth.uid() = user_id);
```

### piece_versions
Historial de cálculos/versiones de cada pieza.
```sql
CREATE TABLE piece_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  piece_id UUID NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL DEFAULT 1,
  calculation_data JSONB NOT NULL, -- Todos los parámetros del cálculo
  result_data JSONB NOT NULL,      -- Resultados: costos, tiempos, etc.
  notes TEXT,
  is_current BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_piece_versions_piece_id ON piece_versions(piece_id);
CREATE INDEX idx_piece_versions_piece_current ON piece_versions(piece_id, is_current) WHERE is_current = true;
CREATE INDEX idx_piece_versions_created ON piece_versions(created_at DESC);

-- RLS Policies
ALTER TABLE piece_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage versions of their pieces" ON piece_versions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM pieces 
      WHERE pieces.id = piece_versions.piece_id 
        AND pieces.user_id = auth.uid()
    )
  );
```

### subscription_plans
Planes de suscripción disponibles.
```sql
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  billing_period VARCHAR(20) NOT NULL, -- 'monthly', 'yearly', 'lifetime'
  features JSONB DEFAULT '[]'::jsonb,
  max_pieces INTEGER, -- NULL = ilimitado
  max_calculations_per_day INTEGER, -- NULL = ilimitado
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subscription_plans_active ON subscription_plans(is_active, sort_order);

-- Default data
INSERT INTO subscription_plans (name, description, price, billing_period, max_pieces, max_calculations_per_day)
VALUES 
  ('Free Trial', 'Trial gratuito por 7 días', 0.00, 'trial', 5, 10),
  ('Basic', 'Plan básico mensual', 9.99, 'monthly', 50, 100),
  ('Premium', 'Plan premium mensual', 19.99, 'monthly', NULL, NULL),
  ('Premium Annual', 'Plan premium anual con descuento', 199.99, 'yearly', NULL, NULL)
ON CONFLICT DO NOTHING;
```

### subscriptions
Suscripciones activas de usuarios.
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES subscription_plans(id),
  status VARCHAR(50) NOT NULL, -- 'active', 'cancelled', 'expired', 'pending'
  type VARCHAR(50) NOT NULL,   -- 'monthly', 'yearly', 'trial', 'lifetime'
  amount DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'USD',
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  trial_start TIMESTAMP WITH TIME ZONE,
  trial_end TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,
  payment_method VARCHAR(50),
  payment_provider VARCHAR(50),
  auto_renewal BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_user_status ON subscriptions(user_id, status);
CREATE INDEX idx_subscriptions_expires_at ON subscriptions(expires_at) WHERE status = 'active';
CREATE INDEX idx_subscriptions_plan_id ON subscriptions(plan_id);

-- RLS Policies
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);
```

### user_subscriptions
Tabla de relación usuario-suscripción (si existe como separada).
```sql
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT true,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### payment_transactions
Transacciones de pago detalladas.
```sql
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  subscription_id UUID REFERENCES subscriptions(id),
  transaction_id VARCHAR(255), -- ID del proveedor externo
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50) NOT NULL, -- 'pending', 'completed', 'failed', 'refunded', 'cancelled'
  payment_method VARCHAR(50),  -- 'credit_card', 'paypal', 'stripe', etc.
  payment_provider VARCHAR(50), -- 'stripe', 'paypal', 'mercadopago'
  provider_fee DECIMAL(10,2) DEFAULT 0,
  net_amount DECIMAL(10,2),
  failure_reason TEXT,
  refund_reason TEXT,
  refunded_at TIMESTAMP WITH TIME ZONE,
  processed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX idx_payment_transactions_user_status ON payment_transactions(user_id, status);
CREATE INDEX idx_payment_transactions_subscription ON payment_transactions(subscription_id);
CREATE INDEX idx_payment_transactions_created_status ON payment_transactions(created_at DESC, status);
CREATE INDEX idx_payment_transactions_provider ON payment_transactions(payment_provider, transaction_id);
```

### user_usage
Seguimiento del uso por usuario.
```sql
CREATE TABLE user_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  calculations_count INTEGER DEFAULT 0,
  pieces_created_count INTEGER DEFAULT 0,
  pieces_updated_count INTEGER DEFAULT 0,
  api_calls_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id, date)
);

-- Indexes
CREATE INDEX idx_user_usage_user_date ON user_usage(user_id, date DESC);
CREATE INDEX idx_user_usage_date ON user_usage(date);
```

### filaments
Biblioteca de filamentos disponibles (si existe).
```sql
CREATE TABLE filaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(100),
  material_type VARCHAR(50), -- 'PLA', 'ABS', 'PETG', etc.
  density DECIMAL(5,3), -- g/cm³
  cost_per_kg DECIMAL(10,2),
  color VARCHAR(50),
  properties JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_filaments_material_type ON filaments(material_type);
CREATE INDEX idx_filaments_active ON filaments(is_active) WHERE is_active = true;
```

### config_profiles
Perfiles de configuración para cálculos.
```sql
CREATE TABLE config_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  config_data JSONB NOT NULL, -- Configuración completa
  is_default BOOLEAN DEFAULT false,
  is_global BOOLEAN DEFAULT false, -- Disponible para todos los usuarios
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_config_profiles_user ON config_profiles(user_id);
CREATE INDEX idx_config_profiles_global ON config_profiles(is_global) WHERE is_global = true;
```

### items
Elementos o productos (si existe tabla separada).
```sql
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  price DECIMAL(10,2),
  sku VARCHAR(100) UNIQUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## ADMIN TABLES

### admin_users
Usuarios administradores del sistema.
```sql
CREATE TABLE admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  role VARCHAR(50) NOT NULL DEFAULT 'admin', -- 'admin', 'super_admin', 'support'
  permissions JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX idx_admin_users_role ON admin_users(role);
```

### admin_sessions
Sesiones específicas del panel de admin.
```sql
CREATE TABLE admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### admin_activity_log
Log de actividad administrativa.
```sql
CREATE TABLE admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES admin_users(id),
  action_type VARCHAR(100) NOT NULL,
  target_table VARCHAR(100),
  target_id UUID,
  old_values JSONB,
  new_values JSONB,
  description TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_admin_activity_log_admin_user ON admin_activity_log(admin_user_id, created_at DESC);
CREATE INDEX idx_admin_activity_log_action ON admin_activity_log(action_type, created_at DESC);
CREATE INDEX idx_admin_activity_log_target ON admin_activity_log(target_table, target_id);
```

---

## ADMIN VIEWS

### admin_subscriptions_view
Vista completa de suscripciones para administración.
```sql
CREATE OR REPLACE VIEW admin_subscriptions_view AS
SELECT 
  s.id as subscription_id,
  s.user_id,
  u.email as user_email,
  COALESCE(u.raw_user_meta_data->>'name', 'N/A') as user_name,
  sp.name as plan_name,
  sp.price as plan_price,
  sp.billing_period,
  s.status,
  s.type,
  s.amount,
  s.current_period_start,
  s.current_period_end,
  s.expires_at,
  s.trial_end,
  s.auto_renewal,
  s.payment_method,
  s.payment_provider,
  s.cancellation_reason,
  s.cancelled_at,
  s.created_at as subscription_created,
  s.updated_at as subscription_updated,
  -- Campos calculados
  CASE 
    WHEN s.trial_end IS NOT NULL AND s.trial_end > NOW() THEN 'trial'
    WHEN s.expires_at < NOW() THEN 'expired'
    WHEN s.status = 'cancelled' THEN 'cancelled'
    WHEN s.status = 'active' AND s.current_period_end > NOW() THEN 'active'
    ELSE s.status
  END as computed_status,
  EXTRACT(days FROM (COALESCE(s.expires_at, s.current_period_end) - NOW())) as days_until_expiry
FROM subscriptions s
LEFT JOIN auth.users u ON s.user_id = u.id
LEFT JOIN subscription_plans sp ON s.plan_id = sp.id;
```

### admin_payments_view
Vista completa de pagos para administración.
```sql
CREATE OR REPLACE VIEW admin_payments_view AS
SELECT 
  pt.id as payment_id,
  pt.user_id,
  u.email as user_email,
  COALESCE(u.raw_user_meta_data->>'name', 'N/A') as user_name,
  pt.subscription_id,
  s.type as subscription_type,
  pt.transaction_id,
  pt.amount,
  pt.currency,
  pt.net_amount,
  pt.provider_fee,
  pt.status,
  pt.payment_method,
  pt.payment_provider,
  pt.failure_reason,
  pt.refund_reason,
  pt.refunded_at,
  pt.created_at as payment_date,
  pt.updated_at as last_updated,
  -- Campos calculados
  CASE 
    WHEN pt.status = 'completed' THEN 'success'
    WHEN pt.status = 'failed' THEN 'failed'
    WHEN pt.status = 'pending' THEN 'processing'
    WHEN pt.status = 'refunded' THEN 'refunded'
    ELSE pt.status
  END as display_status,
  EXTRACT(days FROM (NOW() - pt.created_at)) as days_ago
FROM payment_transactions pt
LEFT JOIN auth.users u ON pt.user_id = u.id
LEFT JOIN subscriptions s ON pt.subscription_id = s.id
ORDER BY pt.created_at DESC;
```

### admin_users_overview
Vista general de usuarios para administración.
```sql
CREATE OR REPLACE VIEW admin_users_overview AS
SELECT 
  u.id as user_id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'name', 'N/A') as name,
  u.email_confirmed_at,
  u.last_sign_in_at,
  u.created_at as user_created,
  -- Estadísticas de piezas
  COALESCE(pieces_stats.piece_count, 0) as total_pieces,
  COALESCE(pieces_stats.favorite_count, 0) as favorite_pieces,
  -- Estadísticas de cálculos
  COALESCE(calc_stats.total_calculations, 0) as total_calculations,
  COALESCE(calc_stats.calculations_30d, 0) as calculations_last_30d,
  -- Información de suscripción
  sub.subscription_id,
  sub.plan_name,
  sub.computed_status as subscription_status,
  sub.expires_at as subscription_expires,
  -- Información de pagos
  COALESCE(payment_stats.total_paid, 0) as total_revenue,
  payment_stats.last_payment_date,
  -- Estado general
  CASE 
    WHEN sub.computed_status = 'active' THEN 'premium'
    WHEN sub.computed_status = 'trial' THEN 'trial'
    ELSE 'free'
  END as user_tier
FROM auth.users u
LEFT JOIN LATERAL (
  SELECT 
    COUNT(*) as piece_count,
    COUNT(*) FILTER (WHERE is_favorite = true) as favorite_count
  FROM pieces p WHERE p.user_id = u.id
) pieces_stats ON true
LEFT JOIN LATERAL (
  SELECT 
    COUNT(*) as total_calculations,
    COUNT(*) FILTER (WHERE pv.created_at > NOW() - INTERVAL '30 days') as calculations_30d
  FROM piece_versions pv
  JOIN pieces p ON pv.piece_id = p.id
  WHERE p.user_id = u.id
) calc_stats ON true
LEFT JOIN admin_subscriptions_view sub ON sub.user_id = u.id AND sub.computed_status IN ('active', 'trial')
LEFT JOIN LATERAL (
  SELECT 
    SUM(amount) FILTER (WHERE status = 'completed') as total_paid,
    MAX(created_at) FILTER (WHERE status = 'completed') as last_payment_date
  FROM payment_transactions pt WHERE pt.user_id = u.id
) payment_stats ON true
ORDER BY u.created_at DESC;
```

---

## ADMIN FUNCTIONS

### admin_update_subscription()
```sql
CREATE OR REPLACE FUNCTION admin_update_subscription(
  p_subscription_id UUID,
  p_admin_user_id UUID,
  p_updates JSONB,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB
```

### admin_process_refund()
```sql
CREATE OR REPLACE FUNCTION admin_process_refund(
  p_payment_id UUID,
  p_admin_user_id UUID,
  p_refund_amount DECIMAL DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB
```

### admin_assign_subscription()
```sql
CREATE OR REPLACE FUNCTION admin_assign_subscription(
  p_user_id UUID,
  p_plan_id UUID,
  p_admin_user_id UUID,
  p_duration_months INTEGER DEFAULT 1,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB
```

---

## RLS POLICIES

### Políticas principales:
- **pieces**: Solo el usuario propietario puede CRUD
- **piece_versions**: Solo versiones de piezas del usuario
- **subscriptions**: Solo visualización de suscripciones propias
- **admin_***: Solo usuarios con rol admin
- **payment_transactions**: Solo transacciones propias (lectura)

### Permisos por rol:
- **authenticated**: Acceso a sus datos + vistas admin (solo lectura)
- **service_role**: Acceso completo + funciones admin
- **anon**: Sin acceso a datos privados

---

## INDEXES IMPORTANTES

### Performance crítico:
```sql
-- Búsquedas por usuario
CREATE INDEX idx_pieces_user_created ON pieces(user_id, created_at DESC);
CREATE INDEX idx_subscriptions_user_status ON subscriptions(user_id, status);

-- Búsquedas admin
CREATE INDEX idx_payment_transactions_created_status ON payment_transactions(created_at DESC, status);
CREATE INDEX idx_admin_activity_log_admin_created ON admin_activity_log(admin_user_id, created_at DESC);

-- Búsquedas por fecha/expiración
CREATE INDEX idx_subscriptions_expires_at ON subscriptions(expires_at) WHERE status = 'active';
CREATE INDEX idx_user_usage_user_date ON user_usage(user_id, date DESC);
```

---

## NOTAS IMPORTANTES

### ⚠️ Validaciones obligatorias:
1. **Antes de usar cualquier tabla**: Verificar que existe en este esquema
2. **Columnas**: Solo usar las documentadas aquí
3. **RLS**: Siempre considerar las políticas de seguridad
4. **Joins**: Verificar las relaciones FK antes de hacer JOIN

### 📝 Convenciones:
- **IDs**: Siempre UUID con `gen_random_uuid()`
- **Timestamps**: TIMESTAMP WITH TIME ZONE + DEFAULT NOW()
- **JSONB**: Para metadatos y configuraciones flexibles
- **Nombres**: Snake_case para tablas/columnas, camelCase en frontend

### 🚨 Tablas críticas para ZETALAB:
- `pieces`: Piezas 3D del usuario
- `piece_versions`: Historial de cálculos
- `subscriptions`: Control de suscripciones premium
- `auth.users`: Usuarios base de Supabase

---

*Documento generado: 2025-09-01*  
*Uso interno: Referencia autoritativa para desarrollo*