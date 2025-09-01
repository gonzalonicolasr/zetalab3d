-- ============================================
-- COMPLETE ADMIN SETUP SQL FOR ZETALAB
-- Uses actual existing database schema
-- Based on real table structure from supabase-schema
-- ============================================

-- Create admin users table for dashboard access
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'admin',
    active BOOLEAN DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on admin_users
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Create comprehensive admin views using real schema columns
-- ============================================
-- DASHBOARD STATISTICS VIEW
-- ============================================
CREATE OR REPLACE VIEW admin_dashboard_metrics AS
WITH user_stats AS (
    SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_users_30d,
        COUNT(*) FILTER (WHERE last_sign_in_at >= NOW() - INTERVAL '7 days') as active_users_7d
    FROM auth.users 
    WHERE deleted_at IS NULL
),
piece_stats AS (
    SELECT 
        COUNT(*) as total_pieces,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_pieces_30d,
        COUNT(DISTINCT user_id) as users_with_pieces,
        ROUND(AVG(est_price_ars::numeric), 2) as avg_price_ars,
        SUM(est_weight_grams::numeric) as total_weight_grams
    FROM pieces
),
calculation_stats AS (
    SELECT 
        COUNT(*) as total_calculations,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_calculations_30d,
        COUNT(DISTINCT user_id) as users_with_calculations,
        ROUND(AVG((params->>'total')::numeric), 2) as avg_calculation_price
    FROM piece_versions
),
subscription_stats AS (
    SELECT 
        COUNT(*) as total_subscriptions,
        COUNT(*) FILTER (WHERE active = true) as active_subscriptions,
        COUNT(*) FILTER (WHERE plan_type = 'premium') as premium_subscriptions,
        COUNT(*) FILTER (WHERE plan_type = 'premium_yearly') as yearly_subscriptions,
        SUM(amount::numeric) FILTER (WHERE payment_status = 'completed') as total_revenue
    FROM subscriptions
),
payment_stats AS (
    SELECT 
        COUNT(*) as total_transactions,
        COUNT(*) FILTER (WHERE status = 'completed') as successful_payments,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_payments,
        SUM(amount::numeric) FILTER (WHERE status = 'completed') as revenue_from_payments,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as payments_30d
    FROM payment_transactions
)
SELECT 
    -- User Metrics
    us.total_users,
    us.new_users_30d,
    us.active_users_7d,
    
    -- Piece Metrics
    ps.total_pieces,
    ps.new_pieces_30d,
    ps.users_with_pieces,
    ps.avg_price_ars,
    ps.total_weight_grams,
    
    -- Calculation Metrics
    cs.total_calculations,
    cs.new_calculations_30d,
    cs.users_with_calculations,
    cs.avg_calculation_price,
    
    -- Subscription Metrics
    ss.total_subscriptions,
    ss.active_subscriptions,
    ss.premium_subscriptions,
    ss.yearly_subscriptions,
    COALESCE(ss.total_revenue, 0) as subscription_revenue,
    
    -- Payment Metrics
    pms.total_transactions,
    pms.successful_payments,
    pms.failed_payments,
    COALESCE(pms.revenue_from_payments, 0) as payment_revenue,
    pms.payments_30d,
    
    -- Combined Revenue
    COALESCE(ss.total_revenue, 0) + COALESCE(pms.revenue_from_payments, 0) as total_revenue
FROM user_stats us
CROSS JOIN piece_stats ps
CROSS JOIN calculation_stats cs
CROSS JOIN subscription_stats ss
CROSS JOIN payment_stats pms;

-- ============================================
-- USER MANAGEMENT VIEW
-- ============================================
CREATE OR REPLACE VIEW admin_users_detailed AS
SELECT 
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    COALESCE(u.raw_user_meta_data->>'full_name', 'Sin nombre') as display_name,
    
    -- Subscription info
    s.plan_type,
    s.active as subscription_active,
    s.expires_at as subscription_expires,
    s.amount as subscription_amount,
    s.payment_status,
    
    -- Usage stats
    COALESCE(uu.calculations_used, 0) as calculations_used,
    COALESCE(uu.calculations_limit, 10) as calculations_limit,
    COALESCE(uu.pieces_created, 0) as pieces_created,
    COALESCE(uu.pieces_limit, 5) as pieces_limit,
    
    -- Activity stats
    COUNT(p.id) as total_pieces,
    COUNT(pv.id) as total_calculations,
    MAX(pv.created_at) as last_calculation,
    MAX(p.created_at) as last_piece_created,
    
    -- Determine user status
    CASE 
        WHEN u.last_sign_in_at >= NOW() - INTERVAL '7 days' THEN 'active'
        WHEN u.last_sign_in_at >= NOW() - INTERVAL '30 days' THEN 'inactive'
        WHEN u.last_sign_in_at IS NULL THEN 'never_logged_in'
        ELSE 'dormant'
    END as activity_status
    
FROM auth.users u
LEFT JOIN subscriptions s ON s.user_id = u.id
LEFT JOIN user_usage uu ON uu.user_id = u.id
LEFT JOIN pieces p ON p.user_id = u.id
LEFT JOIN piece_versions pv ON pv.user_id = u.id
WHERE u.deleted_at IS NULL
GROUP BY 
    u.id, u.email, u.created_at, u.last_sign_in_at, u.email_confirmed_at, 
    u.raw_user_meta_data, s.plan_type, s.active, s.expires_at, s.amount, 
    s.payment_status, uu.calculations_used, uu.calculations_limit, 
    uu.pieces_created, uu.pieces_limit;

-- ============================================
-- SUBSCRIPTION MANAGEMENT VIEW
-- ============================================
CREATE OR REPLACE VIEW admin_subscriptions_full AS
SELECT 
    s.id as subscription_id,
    s.user_id,
    u.email as user_email,
    COALESCE(u.raw_user_meta_data->>'full_name', 'Sin nombre') as user_name,
    
    -- Subscription details
    s.plan_type,
    s.active,
    s.created_at as subscription_created,
    s.expires_at,
    s.amount,
    s.payment_status,
    
    -- User subscription details (if exists)
    us.id as user_subscription_id,
    us.plan_id,
    sp.name as plan_name,
    sp.price_ars as plan_price_ars,
    sp.max_calculations_per_month,
    sp.max_pieces,
    us.status as detailed_status,
    us.trial_ends_at,
    us.current_period_start,
    us.current_period_end,
    
    -- Calculate days until expiration
    CASE 
        WHEN s.expires_at IS NULL THEN NULL
        ELSE EXTRACT(days FROM s.expires_at - NOW())::integer
    END as days_until_expiration,
    
    -- Status classification
    CASE 
        WHEN s.active = true AND (s.expires_at IS NULL OR s.expires_at > NOW()) THEN 'active'
        WHEN s.active = true AND s.expires_at <= NOW() THEN 'expired'
        WHEN s.active = false THEN 'inactive'
        ELSE 'unknown'
    END as computed_status

FROM subscriptions s
JOIN auth.users u ON u.id = s.user_id
LEFT JOIN user_subscriptions us ON us.user_id = s.user_id
LEFT JOIN subscription_plans sp ON sp.id = us.plan_id
WHERE u.deleted_at IS NULL;

-- ============================================
-- PAYMENT MANAGEMENT VIEW
-- ============================================
CREATE OR REPLACE VIEW admin_payments_full AS
SELECT 
    pt.id as payment_id,
    pt.user_id,
    u.email as user_email,
    COALESCE(u.raw_user_meta_data->>'full_name', 'Sin nombre') as user_name,
    
    -- Payment details
    pt.amount,
    pt.status,
    pt.mp_payment_id,
    pt.description,
    pt.created_at as payment_date,
    pt.updated_at,
    
    -- Subscription context (if payment is for subscription)
    s.plan_type as related_plan_type,
    s.active as subscription_active,
    
    -- Payment classification
    CASE 
        WHEN pt.status = 'approved' THEN 'completed'
        WHEN pt.status = 'pending' THEN 'pending'
        WHEN pt.status = 'cancelled' OR pt.status = 'rejected' THEN 'failed'
        ELSE pt.status
    END as normalized_status,
    
    -- Revenue calculation (only count completed payments)
    CASE 
        WHEN pt.status = 'approved' THEN pt.amount::numeric
        ELSE 0
    END as revenue_amount

FROM payment_transactions pt
JOIN auth.users u ON u.id = pt.user_id
LEFT JOIN subscriptions s ON s.user_id = pt.user_id
WHERE u.deleted_at IS NULL;

-- ============================================
-- PIECES ANALYSIS VIEW
-- ============================================
CREATE OR REPLACE VIEW admin_pieces_analysis AS
SELECT 
    p.id as piece_id,
    p.user_id,
    u.email as user_email,
    COALESCE(u.raw_user_meta_data->>'full_name', 'Sin nombre') as user_name,
    
    -- Piece details
    p.title,
    p.created_at,
    p.updated_at,
    p.est_price_ars,
    p.est_weight_grams,
    
    -- Version count and analysis
    COUNT(pv.id) as version_count,
    MAX(pv.created_at) as last_version_date,
    AVG((pv.params->>'total')::numeric) as avg_price_per_version,
    MIN((pv.params->>'total')::numeric) as min_price_version,
    MAX((pv.params->>'total')::numeric) as max_price_version,
    
    -- User context
    s.plan_type as user_plan,
    s.active as user_subscription_active

FROM pieces p
JOIN auth.users u ON u.id = p.user_id
LEFT JOIN piece_versions pv ON pv.piece_id = p.id
LEFT JOIN subscriptions s ON s.user_id = p.user_id
WHERE u.deleted_at IS NULL
GROUP BY 
    p.id, p.user_id, u.email, u.raw_user_meta_data, p.title, 
    p.created_at, p.updated_at, p.est_price_ars, p.est_weight_grams,
    s.plan_type, s.active;

-- ============================================
-- ANALYTICS VIEWS FOR CHARTS
-- ============================================

-- Daily user registrations (last 30 days)
CREATE OR REPLACE VIEW admin_daily_registrations AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as registrations
FROM auth.users 
WHERE created_at >= NOW() - INTERVAL '30 days'
    AND deleted_at IS NULL
GROUP BY DATE(created_at)
ORDER BY date;

-- Daily revenue (last 30 days)
CREATE OR REPLACE VIEW admin_daily_revenue AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as payments,
    SUM(amount::numeric) FILTER (WHERE status = 'approved') as revenue
FROM payment_transactions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date;

-- Monthly subscription trends
CREATE OR REPLACE VIEW admin_subscription_trends AS
SELECT 
    DATE_TRUNC('month', created_at) as month,
    plan_type,
    COUNT(*) as subscriptions,
    SUM(amount::numeric) FILTER (WHERE payment_status = 'completed') as revenue
FROM subscriptions
WHERE created_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', created_at), plan_type
ORDER BY month, plan_type;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON admin_dashboard_metrics TO authenticated;
GRANT SELECT ON admin_users_detailed TO authenticated;
GRANT SELECT ON admin_subscriptions_full TO authenticated;
GRANT SELECT ON admin_payments_full TO authenticated;
GRANT SELECT ON admin_pieces_analysis TO authenticated;
GRANT SELECT ON admin_daily_registrations TO authenticated;
GRANT SELECT ON admin_daily_revenue TO authenticated;
GRANT SELECT ON admin_subscription_trends TO authenticated;

-- Grant admin table permissions
GRANT ALL ON admin_users TO authenticated;

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_plan ON subscriptions(user_id, plan_type);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active_expires ON subscriptions(active, expires_at);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_date ON payment_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_pieces_user_created ON pieces(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_piece_versions_piece_created ON piece_versions(piece_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON user_usage(user_id);

-- ============================================
-- ADMIN FUNCTIONS FOR MANAGEMENT
-- ============================================

-- Function to update subscription expiration
CREATE OR REPLACE FUNCTION admin_update_subscription_expiration(
    p_subscription_id UUID,
    p_new_expiration TIMESTAMP WITH TIME ZONE
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE subscriptions 
    SET expires_at = p_new_expiration,
        updated_at = NOW()
    WHERE id = p_subscription_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to activate/deactivate subscription
CREATE OR REPLACE FUNCTION admin_toggle_subscription(
    p_subscription_id UUID,
    p_active BOOLEAN
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE subscriptions 
    SET active = p_active,
        updated_at = NOW()
    WHERE id = p_subscription_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to refund payment (mark as refunded)
CREATE OR REPLACE FUNCTION admin_process_refund(
    p_payment_id UUID,
    p_refund_reason TEXT DEFAULT 'Admin refund'
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE payment_transactions 
    SET status = 'refunded',
        description = COALESCE(description, '') || ' - REFUNDED: ' || p_refund_reason,
        updated_at = NOW()
    WHERE id = p_payment_id 
        AND status = 'approved';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on admin functions
GRANT EXECUTE ON FUNCTION admin_update_subscription_expiration TO authenticated;
GRANT EXECUTE ON FUNCTION admin_toggle_subscription TO authenticated;
GRANT EXECUTE ON FUNCTION admin_process_refund TO authenticated;

-- ============================================
-- INSERT DEFAULT ADMIN USER (Optional)
-- ============================================
-- Uncomment and modify as needed
-- INSERT INTO admin_users (email, password_hash, name) 
-- VALUES ('admin@zetalab.com', crypt('admin123', gen_salt('bf')), 'Admin User')
-- ON CONFLICT (email) DO NOTHING;

COMMENT ON VIEW admin_dashboard_metrics IS 'Comprehensive dashboard metrics for ZETALAB admin';
COMMENT ON VIEW admin_users_detailed IS 'Detailed user information with subscription and usage data';
COMMENT ON VIEW admin_subscriptions_full IS 'Complete subscription management view';
COMMENT ON VIEW admin_payments_full IS 'Complete payment transaction view with user context';
COMMENT ON VIEW admin_pieces_analysis IS 'Piece analysis with version statistics';