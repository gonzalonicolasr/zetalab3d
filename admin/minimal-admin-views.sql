-- VISTAS ADMIN MÍNIMAS PARA ZETALAB
-- Solo usa columnas básicas que típicamente existen

-- PRIMERO: Eliminar vistas existentes si hay errores
DROP VIEW IF EXISTS admin_user_activity CASCADE;
DROP VIEW IF EXISTS admin_pieces_overview CASCADE;
DROP VIEW IF EXISTS admin_subscriptions_overview CASCADE;
DROP VIEW IF EXISTS admin_daily_stats CASCADE;

-- Vista 1: Información básica de usuarios y su actividad
CREATE OR REPLACE VIEW admin_user_activity AS
SELECT 
  au.id,
  au.email,
  au.created_at as user_created_at,
  au.last_sign_in_at,
  COUNT(DISTINCT p.id) as total_pieces,
  COUNT(DISTINCT pv.id) as total_calculations,
  MAX(p.created_at) as last_piece_created,
  MAX(pv.created_at) as last_calculation_date
FROM auth.users au
LEFT JOIN pieces p ON au.id = p.user_id
LEFT JOIN piece_versions pv ON p.id = pv.piece_id
GROUP BY au.id, au.email, au.created_at, au.last_sign_in_at
ORDER BY au.created_at DESC;

-- Vista 2: Resumen básico de piezas
CREATE OR REPLACE VIEW admin_pieces_overview AS
SELECT 
  p.id,
  p.name,
  p.user_id,
  p.created_at,
  p.updated_at,
  au.email as user_email,
  COUNT(pv.id) as version_count,
  MAX(pv.created_at) as last_version_date
FROM pieces p
JOIN auth.users au ON p.user_id = au.id
LEFT JOIN piece_versions pv ON p.id = pv.piece_id
GROUP BY p.id, p.name, p.user_id, p.created_at, p.updated_at, au.email
ORDER BY p.created_at DESC;

-- Vista 3: Estadísticas diarias básicas
CREATE OR REPLACE VIEW admin_daily_stats AS
SELECT 
  DATE(created_at) as date,
  COUNT(*) as new_pieces,
  COUNT(DISTINCT user_id) as active_users
FROM pieces 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Vista 4: Solo si existe tabla subscriptions
CREATE OR REPLACE VIEW admin_subscriptions_overview AS
SELECT 
  s.id,
  s.user_id,
  au.email as user_email,
  s.created_at,
  s.updated_at
FROM subscriptions s
JOIN auth.users au ON s.user_id = au.id
ORDER BY s.created_at DESC;

-- GRANT permisos para admin dashboard
GRANT SELECT ON admin_user_activity TO authenticated;
GRANT SELECT ON admin_pieces_overview TO authenticated;
GRANT SELECT ON admin_daily_stats TO authenticated;
GRANT SELECT ON admin_subscriptions_overview TO authenticated;