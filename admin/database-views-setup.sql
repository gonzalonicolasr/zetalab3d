-- ZETALAB Admin Panel Database Views Setup
-- Run this SQL in Supabase SQL Editor to create required views

-- ==============================
-- 1. Safe Auth Users View
-- ==============================
CREATE OR REPLACE VIEW admin_auth_users_view AS
SELECT 
    au.id,
    au.email,
    au.created_at as registration_date,
    au.updated_at,
    au.last_sign_in_at,
    au.email_confirmed_at,
    au.confirmation_sent_at,
    au.banned_until,
    au.raw_app_meta_data,
    au.raw_user_meta_data,
    -- Extract authentication methods from identities
    COALESCE(
        (SELECT string_agg(provider, ',') 
         FROM auth.identities ai 
         WHERE ai.user_id = au.id),
        'email'
    ) as auth_methods,
    -- Determine login status
    CASE 
        WHEN au.last_sign_in_at IS NULL THEN 'never_logged_in'
        WHEN au.last_sign_in_at > NOW() - INTERVAL '7 days' THEN 'active'
        WHEN au.last_sign_in_at > NOW() - INTERVAL '30 days' THEN 'inactive'
        ELSE 'dormant'
    END as login_status
FROM auth.users au
ORDER BY au.created_at DESC;

-- ==============================
-- 2. Comprehensive Admin Stats Function
-- ==============================
CREATE OR REPLACE FUNCTION get_comprehensive_admin_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
    user_stats json;
    subscription_stats json;
    piece_stats json;
    payment_stats json;
BEGIN
    -- User statistics from auth.users
    SELECT json_build_object(
        'total_registered', (SELECT COUNT(*) FROM auth.users),
        'active_7d', (SELECT COUNT(*) FROM auth.users WHERE last_sign_in_at > NOW() - INTERVAL '7 days'),
        'active_30d', (SELECT COUNT(*) FROM auth.users WHERE last_sign_in_at > NOW() - INTERVAL '30 days'),
        'never_logged_in', (SELECT COUNT(*) FROM auth.users WHERE last_sign_in_at IS NULL),
        'email_confirmed', (SELECT COUNT(*) FROM auth.users WHERE email_confirmed_at IS NOT NULL),
        'dormant_90d', (SELECT COUNT(*) FROM auth.users WHERE last_sign_in_at < NOW() - INTERVAL '90 days'),
        'with_pieces', (SELECT COUNT(DISTINCT user_id) FROM pieces WHERE user_id IS NOT NULL),
        'admins', (SELECT COUNT(*) FROM admin_users WHERE active = true)
    ) INTO user_stats;
    
    -- Subscription statistics
    SELECT json_build_object(
        'total_subscriptions', (SELECT COUNT(*) FROM subscriptions),
        'active_subscriptions', (SELECT COUNT(*) FROM subscriptions WHERE active = true),
        'trial_subscriptions', (SELECT COUNT(*) FROM subscriptions WHERE plan_type = 'trial' AND active = true),
        'expired_subscriptions', (SELECT COUNT(*) FROM subscriptions WHERE expires_at < NOW()),
        'modern_subscriptions', (SELECT COUNT(*) FROM user_subscriptions),
        'monthly_revenue', (
            SELECT COALESCE(SUM(amount), 0) 
            FROM payment_transactions 
            WHERE status = 'approved' 
            AND created_at >= date_trunc('month', NOW())
        )
    ) INTO subscription_stats;
    
    -- Piece statistics
    SELECT json_build_object(
        'total_pieces', (SELECT COUNT(*) FROM pieces),
        'total_versions', (SELECT COUNT(*) FROM piece_versions),
        'pieces_this_month', (
            SELECT COUNT(*) FROM pieces 
            WHERE created_at >= date_trunc('month', NOW())
        ),
        'active_users_with_pieces', (
            SELECT COUNT(DISTINCT user_id) FROM pieces 
            WHERE created_at > NOW() - INTERVAL '30 days'
        )
    ) INTO piece_stats;
    
    -- Payment statistics
    SELECT json_build_object(
        'total_transactions', (SELECT COUNT(*) FROM payment_transactions),
        'successful_payments', (SELECT COUNT(*) FROM payment_transactions WHERE status = 'approved'),
        'total_revenue', (SELECT COALESCE(SUM(amount), 0) FROM payment_transactions WHERE status = 'approved'),
        'pending_payments', (SELECT COUNT(*) FROM payment_transactions WHERE status = 'pending')
    ) INTO payment_stats;
    
    -- Combine all statistics
    SELECT json_build_object(
        'users', user_stats,
        'subscriptions', subscription_stats,
        'pieces', piece_stats,
        'payments', payment_stats,
        'generated_at', NOW()
    ) INTO result;
    
    RETURN result;
END;
$$;

-- ==============================
-- 3. Admin Complete Users View (if needed)
-- ==============================
CREATE OR REPLACE VIEW admin_complete_users AS
SELECT 
    au.id as user_id,
    au.email,
    au.created_at as registration_date,
    au.updated_at,
    au.last_sign_in_at,
    au.email_confirmed_at,
    au.banned_until,
    au.raw_app_meta_data,
    au.raw_user_meta_data,
    
    -- Authentication methods
    COALESCE(
        (SELECT string_agg(provider, ',') 
         FROM auth.identities ai 
         WHERE ai.user_id = au.id),
        'email'
    ) as auth_methods,
    
    -- Admin information
    adm.role as admin_role,
    adm.permissions as admin_permissions,
    adm.created_at as admin_since,
    (adm.id IS NOT NULL) as is_admin,
    
    -- Legacy subscription information
    sub.id as subscription_id,
    sub.plan_type,
    sub.active as subscription_active,
    sub.expires_at as legacy_expires_at,
    sub.amount as legacy_amount,
    sub.created_at as subscription_created_at,
    CASE 
        WHEN sub.active = true AND (sub.expires_at IS NULL OR sub.expires_at > NOW()) THEN 'active'
        WHEN sub.active = true AND sub.expires_at < NOW() THEN 'expired'
        WHEN sub.active = false THEN 'inactive'
        ELSE 'none'
    END as subscription_status,
    
    -- Modern subscription information
    usub.id as modern_subscription_id,
    usub.status as modern_subscription_status,
    usub.current_period_start,
    usub.current_period_end,
    usub.trial_ends_at,
    sp.name as plan_name,
    sp.slug as plan_slug,
    sp.price as plan_price,
    
    -- Usage statistics
    COALESCE(piece_stats.piece_count, 0) as piece_count,
    COALESCE(piece_stats.version_count, 0) as version_count,
    COALESCE(piece_stats.total_estimated_value, 0) as total_estimated_value,
    piece_stats.first_piece_created,
    piece_stats.last_piece_created,
    piece_stats.last_calculation_date,
    
    -- Payment statistics
    COALESCE(payment_stats.payment_count, 0) as payment_count,
    COALESCE(payment_stats.total_amount_paid, 0) as total_amount_paid,
    COALESCE(payment_stats.successful_payments, 0) as successful_payments,
    payment_stats.last_payment_date,
    
    -- Usage tracking
    COALESCE(usage_stats.current_month_calculations, 0) as current_month_calculations,
    COALESCE(usage_stats.current_month_pieces, 0) as current_month_pieces,
    COALESCE(usage_stats.current_month_exports, 0) as current_month_exports,
    
    -- Inventory statistics
    COALESCE(inventory_stats.config_profile_count, 0) as config_profile_count,
    COALESCE(inventory_stats.filament_count, 0) as filament_count,
    COALESCE(inventory_stats.total_filament_weight, 0) as total_filament_weight,
    
    -- Activity score calculation
    LEAST(5, GREATEST(0, 
        COALESCE(piece_stats.piece_count, 0) * 0.5 +
        COALESCE(piece_stats.version_count, 0) * 0.2 +
        CASE 
            WHEN piece_stats.last_piece_created > NOW() - INTERVAL '7 days' THEN 1
            WHEN piece_stats.last_piece_created > NOW() - INTERVAL '30 days' THEN 0.5
            ELSE 0
        END +
        CASE 
            WHEN (sub.active = true AND sub.expires_at > NOW()) OR usub.status = 'active' THEN 1
            ELSE 0
        END
    )) as activity_score,
    
    -- Current status
    CASE 
        WHEN au.banned_until IS NOT NULL AND au.banned_until > NOW() THEN 'disabled'
        WHEN au.last_sign_in_at IS NULL THEN 'inactive'
        WHEN au.last_sign_in_at > NOW() - INTERVAL '30 days' THEN 'active'
        ELSE 'dormant'
    END as current_status

FROM auth.users au
-- Left join admin users
LEFT JOIN admin_users adm ON adm.user_id = au.id AND adm.active = true
-- Left join legacy subscriptions
LEFT JOIN subscriptions sub ON sub.user_id = au.id
-- Left join modern subscriptions
LEFT JOIN user_subscriptions usub ON usub.user_id = au.id
-- Left join subscription plans
LEFT JOIN subscription_plans sp ON sp.id = usub.plan_id
-- Left join piece statistics
LEFT JOIN (
    SELECT 
        user_id,
        COUNT(*) as piece_count,
        SUM(COALESCE(est_price_ars, 0)) as total_estimated_value,
        MIN(created_at) as first_piece_created,
        MAX(created_at) as last_piece_created,
        MAX(updated_at) as last_calculation_date,
        (SELECT COUNT(*) 
         FROM piece_versions pv 
         WHERE pv.piece_id IN (SELECT id FROM pieces p2 WHERE p2.user_id = pieces.user_id)
        ) as version_count
    FROM pieces 
    WHERE user_id IS NOT NULL
    GROUP BY user_id
) piece_stats ON piece_stats.user_id = au.id
-- Left join payment statistics
LEFT JOIN (
    SELECT 
        sub.user_id,
        COUNT(pt.id) as payment_count,
        SUM(CASE WHEN pt.status = 'approved' THEN pt.amount ELSE 0 END) as total_amount_paid,
        COUNT(CASE WHEN pt.status = 'approved' THEN 1 END) as successful_payments,
        MAX(pt.created_at) as last_payment_date
    FROM payment_transactions pt
    JOIN subscriptions sub ON sub.id = pt.subscription_id
    GROUP BY sub.user_id
) payment_stats ON payment_stats.user_id = au.id
-- Left join usage statistics (if table exists)
LEFT JOIN (
    SELECT 
        user_id,
        SUM(CASE WHEN EXTRACT(month FROM created_at) = EXTRACT(month FROM NOW()) 
                 AND EXTRACT(year FROM created_at) = EXTRACT(year FROM NOW()) 
                 THEN calculations_used ELSE 0 END) as current_month_calculations,
        SUM(CASE WHEN EXTRACT(month FROM created_at) = EXTRACT(month FROM NOW()) 
                 AND EXTRACT(year FROM created_at) = EXTRACT(year FROM NOW()) 
                 THEN pieces_created ELSE 0 END) as current_month_pieces,
        SUM(CASE WHEN EXTRACT(month FROM created_at) = EXTRACT(month FROM NOW()) 
                 AND EXTRACT(year FROM created_at) = EXTRACT(year FROM NOW()) 
                 THEN html_exports ELSE 0 END) as current_month_exports
    FROM user_usage
    GROUP BY user_id
) usage_stats ON usage_stats.user_id = au.id
-- Left join inventory statistics
LEFT JOIN (
    SELECT 
        user_id,
        COUNT(DISTINCT profile_name) as config_profile_count,
        -- These would need to be calculated from localStorage or separate tables
        0 as filament_count,
        0 as total_filament_weight
    FROM pieces
    WHERE profile_data IS NOT NULL
    GROUP BY user_id
) inventory_stats ON inventory_stats.user_id = au.id

ORDER BY au.created_at DESC;

-- ==============================
-- 4. Grant permissions for views
-- ==============================

-- Grant SELECT permissions on the views to the anon role (for admin panel access)
GRANT SELECT ON admin_auth_users_view TO anon;
GRANT SELECT ON admin_complete_users TO anon;
GRANT EXECUTE ON FUNCTION get_comprehensive_admin_stats() TO anon;

-- Note: In production, you should create a dedicated admin role instead of using anon
-- CREATE ROLE admin_panel;
-- GRANT SELECT ON admin_auth_users_view TO admin_panel;
-- GRANT SELECT ON admin_complete_users TO admin_panel;
-- GRANT EXECUTE ON FUNCTION get_comprehensive_admin_stats() TO admin_panel;

-- ==============================
-- 5. Admin Activity Logging (if not exists)
-- ==============================
CREATE OR REPLACE FUNCTION log_admin_activity(
    action_name text,
    resource_type_name text,
    resource_uuid uuid DEFAULT NULL,
    details_json json DEFAULT NULL,
    user_ip text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Insert admin activity (table should exist from previous setup)
    INSERT INTO admin_activities (
        admin_user_id,
        action,
        resource_type,
        resource_id,
        details,
        ip_address,
        created_at
    ) VALUES (
        auth.uid(),
        action_name,
        resource_type_name,
        resource_uuid,
        details_json,
        user_ip,
        NOW()
    );
EXCEPTION
    WHEN OTHERS THEN
        -- Fail silently if admin_activities table doesn't exist
        NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION log_admin_activity TO anon;

-- ==============================
-- 6. Test the views
-- ==============================

-- Test queries to verify the views work:
-- SELECT COUNT(*) as total_users FROM admin_auth_users_view;
-- SELECT * FROM admin_complete_users LIMIT 5;
-- SELECT get_comprehensive_admin_stats();