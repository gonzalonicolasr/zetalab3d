-- Enhanced Admin Views and Functions for ZETALAB
-- Creates additional database views and functions for comprehensive admin analytics

-- Create admin user analytics view
CREATE OR REPLACE VIEW admin_user_analytics AS
SELECT 
    p.user_id,
    COUNT(p.id) as total_pieces,
    COUNT(pv.id) as total_calculations,
    AVG(pv.total) as avg_calculation_value,
    SUM(pv.total) as total_calculated_value,
    COUNT(CASE WHEN p.created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as pieces_last_30_days,
    COUNT(CASE WHEN pv.created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as calculations_last_30_days,
    MIN(p.created_at) as first_piece_date,
    MAX(p.created_at) as last_piece_date,
    COUNT(cp.id) as config_profiles_count,
    COUNT(f.id) as filaments_count
FROM pieces p
LEFT JOIN piece_versions pv ON p.id = pv.piece_id  
LEFT JOIN config_profiles cp ON p.user_id = cp.user_id
LEFT JOIN filaments f ON p.user_id = f.user_id
GROUP BY p.user_id;

-- Create subscription analytics view
CREATE OR REPLACE VIEW admin_subscription_analytics AS
SELECT 
    sp.name as plan_name,
    sp.slug as plan_slug,
    sp.price_ars,
    COUNT(us.id) as total_subscriptions,
    COUNT(CASE WHEN us.status = 'active' THEN 1 END) as active_subscriptions,
    COUNT(CASE WHEN us.status = 'trial' THEN 1 END) as trial_subscriptions,
    COUNT(CASE WHEN us.status = 'canceled' THEN 1 END) as canceled_subscriptions,
    COUNT(CASE WHEN us.created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as subscriptions_last_30_days,
    AVG(CASE WHEN pt.status IN ('approved', 'completed') THEN pt.amount END) as avg_payment_amount,
    SUM(CASE WHEN pt.status IN ('approved', 'completed') THEN pt.amount ELSE 0 END) as total_revenue,
    SUM(CASE WHEN pt.status IN ('approved', 'completed') AND pt.created_at >= DATE_TRUNC('month', NOW()) THEN pt.amount ELSE 0 END) as monthly_revenue
FROM subscription_plans sp
LEFT JOIN user_subscriptions us ON sp.id = us.plan_id
LEFT JOIN payment_transactions pt ON us.id = pt.subscription_id
GROUP BY sp.id, sp.name, sp.slug, sp.price_ars;

-- Create payment analytics view  
CREATE OR REPLACE VIEW admin_payment_analytics AS
SELECT 
    DATE_TRUNC('day', COALESCE(processed_at, created_at)) as payment_date,
    COUNT(*) as total_transactions,
    COUNT(CASE WHEN status IN ('approved', 'completed') THEN 1 END) as successful_transactions,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_transactions,
    COUNT(CASE WHEN status IN ('rejected', 'cancelled') THEN 1 END) as failed_transactions,
    SUM(CASE WHEN status IN ('approved', 'completed') THEN amount ELSE 0 END) as daily_revenue,
    AVG(CASE WHEN status IN ('approved', 'completed') THEN amount END) as avg_transaction_amount
FROM payment_transactions
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY DATE_TRUNC('day', COALESCE(processed_at, created_at))
ORDER BY payment_date DESC;

-- Create usage analytics view
CREATE OR REPLACE VIEW admin_usage_analytics AS
SELECT 
    uu.month_year,
    COUNT(DISTINCT uu.user_id) as active_users,
    SUM(uu.calculations_used) as total_calculations,
    SUM(uu.pieces_created) as total_pieces_created,
    SUM(uu.html_exports) as total_exports,
    SUM(uu.api_calls) as total_api_calls,
    AVG(uu.calculations_used) as avg_calculations_per_user,
    AVG(uu.pieces_created) as avg_pieces_per_user
FROM user_usage uu
GROUP BY uu.month_year
ORDER BY uu.month_year DESC;

-- Create comprehensive user summary view
CREATE OR REPLACE VIEW admin_user_summary AS
SELECT 
    ua.user_id,
    ua.total_pieces,
    ua.total_calculations,
    ua.avg_calculation_value,
    ua.pieces_last_30_days,
    ua.first_piece_date,
    ua.last_piece_date,
    ua.config_profiles_count,
    ua.filaments_count,
    COALESCE(us.status, 'free') as subscription_status,
    sp.name as plan_name,
    sp.price_ars as plan_price,
    us.trial_ends_at,
    us.current_period_end,
    CASE 
        WHEN ua.pieces_last_30_days >= 10 THEN 'high'
        WHEN ua.pieces_last_30_days >= 3 THEN 'medium'
        ELSE 'low'
    END as activity_level,
    CASE 
        WHEN ua.total_pieces >= 20 THEN 'power_user'
        WHEN ua.total_pieces >= 5 THEN 'regular_user'
        ELSE 'new_user'
    END as user_segment
FROM admin_user_analytics ua
LEFT JOIN user_subscriptions us ON ua.user_id = us.user_id
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id;

-- Function to get admin dashboard stats
CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS JSON AS $$
DECLARE
    stats JSON;
BEGIN
    SELECT json_build_object(
        'total_users', (
            SELECT COUNT(DISTINCT user_id) 
            FROM pieces
        ),
        'active_users_30d', (
            SELECT COUNT(DISTINCT user_id) 
            FROM pieces 
            WHERE created_at >= NOW() - INTERVAL '30 days'
        ),
        'total_pieces', (
            SELECT COUNT(*) 
            FROM pieces
        ),
        'pieces_today', (
            SELECT COUNT(*) 
            FROM pieces 
            WHERE DATE(created_at) = CURRENT_DATE
        ),
        'total_calculations', (
            SELECT COUNT(*) 
            FROM piece_versions
        ),
        'active_subscriptions', (
            SELECT COUNT(*) 
            FROM user_subscriptions 
            WHERE status = 'active' 
            AND (current_period_end IS NULL OR current_period_end > NOW())
        ),
        'trial_subscriptions', (
            SELECT COUNT(*) 
            FROM user_subscriptions 
            WHERE status = 'trial' 
            AND (trial_ends_at IS NULL OR trial_ends_at > NOW())
        ),
        'monthly_revenue', (
            SELECT COALESCE(SUM(amount), 0)
            FROM payment_transactions 
            WHERE status IN ('approved', 'completed')
            AND DATE_TRUNC('month', COALESCE(processed_at, created_at)) = DATE_TRUNC('month', NOW())
        ),
        'total_revenue', (
            SELECT COALESCE(SUM(amount), 0)
            FROM payment_transactions 
            WHERE status IN ('approved', 'completed')
        ),
        'avg_pieces_per_user', (
            SELECT ROUND(AVG(total_pieces), 2)
            FROM admin_user_analytics
        ),
        'retention_rate', (
            WITH old_users AS (
                SELECT DISTINCT user_id 
                FROM pieces 
                WHERE created_at < NOW() - INTERVAL '90 days'
            ),
            recent_users AS (
                SELECT DISTINCT user_id 
                FROM pieces 
                WHERE created_at >= NOW() - INTERVAL '30 days'
            )
            SELECT CASE 
                WHEN (SELECT COUNT(*) FROM old_users) > 0 
                THEN ROUND(
                    (SELECT COUNT(*) FROM recent_users r JOIN old_users o ON r.user_id = o.user_id)::DECIMAL 
                    / (SELECT COUNT(*) FROM old_users) * 100, 1
                )
                ELSE 0 
            END
        )
    ) INTO stats;
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log admin activity
CREATE OR REPLACE FUNCTION log_admin_activity(
    action_name TEXT,
    resource_type_name TEXT,
    resource_uuid UUID DEFAULT NULL,
    details_json JSONB DEFAULT NULL,
    user_ip INET DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    activity_id UUID;
    current_admin_id UUID;
BEGIN
    -- Get current admin user ID from session/context
    current_admin_id := auth.uid();
    
    -- Insert activity log
    INSERT INTO admin_activity_log (
        admin_id,
        action,
        resource_type,
        resource_id,
        details,
        ip_address
    ) VALUES (
        current_admin_id,
        action_name,
        resource_type_name,
        resource_uuid,
        details_json,
        user_ip
    ) RETURNING id INTO activity_id;
    
    RETURN activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pieces_user_created ON pieces(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_piece_versions_created ON piece_versions(created_at);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_date_status ON payment_transactions(created_at, status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status, current_period_end);
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_admin_created ON admin_activity_log(admin_id, created_at);

-- Grant permissions to authenticated users to call the stats function
GRANT EXECUTE ON FUNCTION get_admin_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION log_admin_activity(TEXT, TEXT, UUID, JSONB, INET) TO authenticated;

-- Grant select permissions on views to authenticated users (with RLS)
GRANT SELECT ON admin_user_analytics TO authenticated;
GRANT SELECT ON admin_subscription_analytics TO authenticated; 
GRANT SELECT ON admin_payment_analytics TO authenticated;
GRANT SELECT ON admin_usage_analytics TO authenticated;
GRANT SELECT ON admin_user_summary TO authenticated;

COMMENT ON FUNCTION get_admin_dashboard_stats() IS 'Returns comprehensive admin dashboard statistics as JSON';
COMMENT ON FUNCTION log_admin_activity(TEXT, TEXT, UUID, JSONB, INET) IS 'Logs admin actions for audit trail';
COMMENT ON VIEW admin_user_analytics IS 'Comprehensive user analytics for admin dashboard';
COMMENT ON VIEW admin_subscription_analytics IS 'Subscription and revenue analytics by plan';
COMMENT ON VIEW admin_payment_analytics IS 'Daily payment transaction analytics';
COMMENT ON VIEW admin_usage_analytics IS 'Monthly usage analytics across all users';
COMMENT ON VIEW admin_user_summary IS 'Complete user summary with subscription and activity data';