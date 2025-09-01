-- ZETALAB Admin Dashboard Analytics Views
-- Este archivo contiene las vistas y funciones SQL necesarias para el dashboard de analytics

-- ============================================
-- REVENUE ANALYTICS VIEWS
-- ============================================

-- Vista para calcular MRR (Monthly Recurring Revenue)
CREATE OR REPLACE VIEW revenue_mrr AS
SELECT 
  COALESCE(SUM(s.amount), 0) as mrr,
  COUNT(s.id) as active_subscriptions,
  DATE_TRUNC('month', CURRENT_DATE) as period
FROM subscriptions s
WHERE s.status = 'active'
  AND s.current_period_end > CURRENT_DATE;

-- Vista para ingresos por período
CREATE OR REPLACE VIEW revenue_by_period AS
SELECT 
  DATE_TRUNC('month', pt.created_at) as period,
  SUM(pt.amount) as total_revenue,
  COUNT(pt.id) as transaction_count,
  COUNT(DISTINCT pt.user_id) as unique_payers
FROM payment_transactions pt
WHERE pt.status = 'completed'
GROUP BY DATE_TRUNC('month', pt.created_at)
ORDER BY period DESC;

-- Vista para piezas más rentables
CREATE OR REPLACE VIEW top_revenue_pieces AS
SELECT 
  p.id,
  p.name,
  p.user_id,
  prof.email as user_email,
  COUNT(pv.id) as version_count,
  AVG(pv.final_price::numeric) as avg_price,
  (AVG(pv.final_price::numeric) * COUNT(pv.id) * 0.1) as estimated_revenue,
  MAX(pv.created_at) as last_updated
FROM pieces p
LEFT JOIN piece_versions pv ON p.id = pv.piece_id
LEFT JOIN profiles prof ON p.user_id = prof.id
WHERE pv.final_price IS NOT NULL
GROUP BY p.id, p.name, p.user_id, prof.email
ORDER BY estimated_revenue DESC
LIMIT 20;

-- ============================================
-- PERFORMANCE MONITORING VIEWS
-- ============================================

-- Vista para métricas de rendimiento (requiere tabla de logs)
-- Nota: Esta tabla tendría que crearse en producción
CREATE TABLE IF NOT EXISTS api_logs (
  id SERIAL PRIMARY KEY,
  endpoint VARCHAR(255),
  method VARCHAR(10),
  status_code INTEGER,
  response_time INTEGER, -- en milliseconds
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  error_message TEXT
);

-- Vista para métricas de rendimiento de API
CREATE OR REPLACE VIEW api_performance_metrics AS
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  AVG(response_time) as avg_response_time,
  MAX(response_time) as max_response_time,
  COUNT(*) as request_count,
  COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count,
  (COUNT(CASE WHEN status_code >= 400 THEN 1 END)::float / COUNT(*)::float * 100) as error_rate
FROM api_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

-- Vista para logs de errores recientes
CREATE OR REPLACE VIEW recent_error_logs AS
SELECT 
  created_at,
  endpoint,
  error_message,
  status_code,
  COALESCE(prof.email, 'Anonymous') as user_email
FROM api_logs al
LEFT JOIN profiles prof ON al.user_id = prof.id
WHERE status_code >= 400
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC
LIMIT 100;

-- ============================================
-- SUBSCRIPTION MANAGEMENT VIEWS
-- ============================================

-- Vista para renovaciones próximas
CREATE OR REPLACE VIEW upcoming_renewals AS
SELECT 
  s.id,
  s.user_id,
  prof.email,
  s.current_period_end,
  s.amount,
  s.status,
  EXTRACT(days FROM (s.current_period_end - CURRENT_DATE)) as days_until_renewal
FROM subscriptions s
LEFT JOIN profiles prof ON s.user_id = prof.id
WHERE s.status = 'active'
  AND s.current_period_end BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
ORDER BY s.current_period_end ASC;

-- Vista para pagos fallidos recientes
CREATE OR REPLACE VIEW failed_payments_recent AS
SELECT 
  pt.id,
  pt.user_id,
  prof.email,
  pt.amount,
  pt.created_at,
  pt.error_message
FROM payment_transactions pt
LEFT JOIN profiles prof ON pt.user_id = prof.id
WHERE pt.status = 'failed'
  AND pt.created_at > CURRENT_DATE - INTERVAL '7 days'
ORDER BY pt.created_at DESC;

-- Vista para métricas de suscripciones
CREATE OR REPLACE VIEW subscription_lifecycle_metrics AS
SELECT 
  'new' as status,
  COUNT(*) as count
FROM subscriptions 
WHERE created_at > DATE_TRUNC('month', CURRENT_DATE)

UNION ALL

SELECT 
  'active' as status,
  COUNT(*) as count
FROM subscriptions 
WHERE status = 'active'

UNION ALL

SELECT 
  'renewed' as status,
  COUNT(*) as count
FROM payment_transactions pt
JOIN subscriptions s ON pt.user_id = s.user_id
WHERE pt.status = 'completed'
  AND pt.created_at > DATE_TRUNC('month', CURRENT_DATE)
  AND s.created_at < DATE_TRUNC('month', CURRENT_DATE)

UNION ALL

SELECT 
  'cancelled' as status,
  COUNT(*) as count
FROM subscriptions 
WHERE status = 'cancelled'
  AND updated_at > DATE_TRUNC('month', CURRENT_DATE);

-- ============================================
-- USER BEHAVIOR ANALYTICS VIEWS
-- ============================================

-- Tabla para tracking de eventos de usuario (requiere implementación)
CREATE TABLE IF NOT EXISTS user_events (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  event_type VARCHAR(50), -- 'page_view', 'calculation', 'piece_saved', etc.
  event_data JSONB,
  session_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vista para métricas de comportamiento
CREATE OR REPLACE VIEW user_behavior_metrics AS
SELECT 
  DATE_TRUNC('day', created_at) as day,
  COUNT(DISTINCT user_id) as daily_active_users,
  COUNT(DISTINCT session_id) as sessions,
  AVG(
    CASE 
      WHEN event_type = 'session_end' AND event_data->>'duration' IS NOT NULL
      THEN (event_data->>'duration')::integer
    END
  ) / 60 as avg_session_minutes
FROM user_events
WHERE created_at > CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;

-- Vista para análisis de cohortes (simplificado)
CREATE OR REPLACE VIEW user_cohorts AS
WITH user_first_activity AS (
  SELECT 
    user_id,
    DATE_TRUNC('month', MIN(created_at)) as cohort_month
  FROM user_events
  GROUP BY user_id
),
monthly_activity AS (
  SELECT 
    ue.user_id,
    ufa.cohort_month,
    DATE_TRUNC('month', ue.created_at) as activity_month,
    EXTRACT(month FROM age(DATE_TRUNC('month', ue.created_at), ufa.cohort_month)) as months_since_first
  FROM user_events ue
  JOIN user_first_activity ufa ON ue.user_id = ufa.user_id
  GROUP BY ue.user_id, ufa.cohort_month, DATE_TRUNC('month', ue.created_at)
)
SELECT 
  cohort_month,
  COUNT(DISTINCT user_id) as cohort_size,
  COUNT(DISTINCT CASE WHEN months_since_first = 0 THEN user_id END) as month_0,
  COUNT(DISTINCT CASE WHEN months_since_first = 1 THEN user_id END) as month_1,
  COUNT(DISTINCT CASE WHEN months_since_first = 2 THEN user_id END) as month_2,
  COUNT(DISTINCT CASE WHEN months_since_first = 3 THEN user_id END) as month_3
FROM monthly_activity
GROUP BY cohort_month
ORDER BY cohort_month DESC;

-- ============================================
-- CALCULATOR ANALYTICS VIEWS
-- ============================================

-- Vista para métricas de calculadora
CREATE OR REPLACE VIEW calculator_usage_metrics AS
SELECT 
  COUNT(*) as total_calculations,
  AVG(final_price::numeric) as avg_price,
  COUNT(DISTINCT piece_id) as unique_pieces,
  COUNT(*) - COUNT(DISTINCT piece_id) as repeat_calculations,
  MODE() WITHIN GROUP (ORDER BY material) as most_popular_material
FROM piece_versions
WHERE created_at > CURRENT_DATE - INTERVAL '30 days';

-- Vista para distribución de materiales
CREATE OR REPLACE VIEW material_distribution AS
SELECT 
  COALESCE(material, 'PLA') as material,
  COUNT(*) as usage_count,
  ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100, 1) as percentage
FROM piece_versions
WHERE created_at > CURRENT_DATE - INTERVAL '30 days'
GROUP BY material
ORDER BY usage_count DESC;

-- Vista para rangos de precios
CREATE OR REPLACE VIEW price_range_distribution AS
SELECT 
  CASE 
    WHEN final_price::numeric <= 10 THEN '$0-10'
    WHEN final_price::numeric <= 25 THEN '$10-25'
    WHEN final_price::numeric <= 50 THEN '$25-50'
    WHEN final_price::numeric <= 100 THEN '$50-100'
    ELSE '$100+'
  END as price_range,
  COUNT(*) as count
FROM piece_versions
WHERE final_price IS NOT NULL
  AND created_at > CURRENT_DATE - INTERVAL '30 days'
GROUP BY 
  CASE 
    WHEN final_price::numeric <= 10 THEN '$0-10'
    WHEN final_price::numeric <= 25 THEN '$10-25'
    WHEN final_price::numeric <= 50 THEN '$25-50'
    WHEN final_price::numeric <= 100 THEN '$50-100'
    ELSE '$100+'
  END
ORDER BY 
  CASE 
    WHEN price_range = '$0-10' THEN 1
    WHEN price_range = '$10-25' THEN 2
    WHEN price_range = '$25-50' THEN 3
    WHEN price_range = '$50-100' THEN 4
    ELSE 5
  END;

-- Vista para configuraciones exitosas
CREATE OR REPLACE VIEW successful_configurations AS
WITH piece_save_rate AS (
  SELECT 
    p.id,
    COUNT(pv.id) as version_count,
    CASE WHEN COUNT(pv.id) > 1 THEN 1 ELSE 0 END as is_saved
  FROM pieces p
  LEFT JOIN piece_versions pv ON p.id = pv.piece_id
  GROUP BY p.id
),
config_analysis AS (
  SELECT 
    COALESCE(pv.material, 'PLA') || ' + ' || 
    COALESCE(pv.layer_height::text, '0.2') || 'mm + ' || 
    COALESCE(pv.infill::text, '20') || '% infill' as configuration,
    COUNT(*) as frequency,
    AVG(psr.is_saved::numeric) * 100 as save_rate,
    AVG(pv.final_price::numeric) as avg_price
  FROM piece_versions pv
  JOIN piece_save_rate psr ON pv.piece_id = psr.id
  WHERE pv.created_at > CURRENT_DATE - INTERVAL '30 days'
  GROUP BY configuration
  HAVING COUNT(*) >= 5  -- Solo configuraciones con al menos 5 usos
)
SELECT 
  configuration,
  ROUND(frequency::numeric / SUM(frequency) OVER () * 100, 1)::text || '%' as frequency_percentage,
  ROUND(save_rate, 1)::text || '%' as save_rate_percentage,
  '$' || ROUND(avg_price, 2)::text as avg_price_formatted,
  CASE 
    WHEN save_rate > 70 THEN 'Configuración óptima'
    WHEN save_rate > 50 THEN 'Buena configuración'
    ELSE 'Configuración experimental'
  END as recommendation
FROM config_analysis
ORDER BY frequency DESC
LIMIT 10;

-- ============================================
-- FUNCIONES UTILITARIAS
-- ============================================

-- Función para obtener métricas de conversión
CREATE OR REPLACE FUNCTION get_conversion_metrics(timeframe_days INTEGER DEFAULT 30)
RETURNS TABLE (
  total_users BIGINT,
  premium_users BIGINT,
  conversion_rate NUMERIC
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH user_counts AS (
    SELECT 
      COUNT(DISTINCT au.id) as total,
      COUNT(DISTINCT s.user_id) as premium
    FROM auth.users au
    LEFT JOIN subscriptions s ON au.id = s.user_id AND s.status = 'active'
    WHERE au.created_at > CURRENT_DATE - INTERVAL '1 day' * timeframe_days
  )
  SELECT 
    uc.total,
    uc.premium,
    CASE 
      WHEN uc.total > 0 THEN ROUND(uc.premium::numeric / uc.total::numeric * 100, 2)
      ELSE 0
    END
  FROM user_counts uc;
END;
$$;

-- Función para calcular churn rate
CREATE OR REPLACE FUNCTION calculate_churn_rate(months_back INTEGER DEFAULT 3)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  churned_count INTEGER;
  total_count INTEGER;
BEGIN
  -- Contar suscripciones que se cancelaron en el período
  SELECT COUNT(*) INTO churned_count
  FROM subscriptions
  WHERE status = 'cancelled'
    AND updated_at > CURRENT_DATE - INTERVAL '1 month' * months_back;
    
  -- Contar total de suscripciones activas al inicio del período
  SELECT COUNT(*) INTO total_count
  FROM subscriptions
  WHERE created_at <= CURRENT_DATE - INTERVAL '1 month' * months_back;
    
  -- Calcular tasa de churn
  IF total_count > 0 THEN
    RETURN ROUND(churned_count::numeric / total_count::numeric * 100, 2);
  ELSE
    RETURN 0;
  END IF;
END;
$$;

-- ============================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================

-- Índices para optimizar las consultas de analytics
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_period ON subscriptions(status, current_period_end);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status_created ON payment_transactions(status, created_at);
CREATE INDEX IF NOT EXISTS idx_piece_versions_created_material ON piece_versions(created_at, material);
CREATE INDEX IF NOT EXISTS idx_pieces_user_created ON pieces(user_id, created_at);

-- Índices para user_events si la tabla existe
CREATE INDEX IF NOT EXISTS idx_user_events_user_created ON user_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_events_type_created ON user_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_user_events_session ON user_events(session_id);

-- Índices para api_logs si la tabla existe  
CREATE INDEX IF NOT EXISTS idx_api_logs_created_status ON api_logs(created_at, status_code);
CREATE INDEX IF NOT EXISTS idx_api_logs_endpoint_created ON api_logs(endpoint, created_at);

-- ============================================
-- COMENTARIOS Y NOTAS PARA PRODUCCIÓN
-- ============================================

/*
NOTAS PARA IMPLEMENTACIÓN EN PRODUCCIÓN:

1. USER TRACKING:
   - Implementar tracking de eventos en el frontend (page views, clicks, etc.)
   - Crear tabla user_events con los eventos relevantes
   - Implementar session tracking para métricas más precisas

2. API MONITORING:
   - Crear middleware para capturar métricas de API (response times, errors)
   - Implementar logging estructurado
   - Configurar alertas para errores críticos

3. REAL-TIME METRICS:
   - Considerar usar Redis para métricas en tiempo real
   - Implementar WebSocket para actualizaciones live del dashboard
   - Crear jobs para pre-calcular métricas pesadas

4. DATA RETENTION:
   - Configurar políticas de retención para logs y eventos
   - Implementar archivado de datos históricos
   - Considerar usar particionado de tablas para grandes volúmenes

5. SECURITY:
   - Implementar Row Level Security (RLS) para todas las vistas
   - Crear roles específicos para el dashboard de admin
   - Audit trail para cambios sensibles

6. PERFORMANCE:
   - Crear materialized views para métricas complejas
   - Implementar caching de resultados
   - Monitorear performance de queries

7. ALERTING:
   - Configurar alertas para métricas críticas (churn alto, errores, etc.)
   - Integrar con sistemas de notificación (email, Slack, etc.)
   - Dashboard de health check

Ejemplo de implementación de tracking de eventos:

```javascript
// Frontend event tracking
function trackEvent(eventType, eventData = {}) {
  fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_type: eventType,
      event_data: eventData,
      session_id: getSessionId(),
      timestamp: new Date().toISOString()
    })
  });
}

// Uso:
trackEvent('calculation_completed', { 
  material: 'PLA', 
  price: 15.50,
  duration: 120 // seconds
});
trackEvent('piece_saved', { piece_id: 'uuid-here' });
trackEvent('subscription_upgraded', { plan: 'premium' });
```

*/