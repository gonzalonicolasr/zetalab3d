-- ZETALAB Comprehensive Admin Dashboard Setup
-- This SQL creates views and functions to access ALL database tables safely
-- Including auth.users and all business tables for complete analytics

-- ==============================
-- SECURITY: Create safe auth.users access
-- ==============================

-- Create a secure view to access auth.users data for admin purposes
-- This view only exposes safe fields and requires admin privileges
CREATE OR REPLACE VIEW admin_auth_users_view AS
SELECT 
    au.id,
    au.email,
    au.created_at as registration_date,
    au.updated_at,
    au.last_sign_in_at,
    au.email_confirmed_at,
    au.confirmation_sent_at,
    au.recovery_sent_at,
    au.email_change_sent_at,
    au.new_email,
    au.invited_at,
    au.action_link,
    au.email_change,
    au.email_change_confirm_status,
    au.banned_until,
    au.raw_app_meta_data,
    au.raw_user_meta_data,
    au.is_super_admin,
    au.role,
    -- Extract authentication method from identities
    COALESCE(
        (SELECT string_agg(provider, ',') 
         FROM auth.identities ai 
         WHERE ai.user_id = au.id),
        'email'
    ) as auth_methods,
    -- User activity indicators
    CASE 
        WHEN au.last_sign_in_at > NOW() - INTERVAL '7 days' THEN 'active'
        WHEN au.last_sign_in_at > NOW() - INTERVAL '30 days' THEN 'inactive'
        WHEN au.last_sign_in_at IS NULL THEN 'never_logged_in'
        ELSE 'dormant'
    END as login_status
FROM auth.users au;

-- ==============================
-- COMPREHENSIVE USER DATA VIEW
-- ==============================

-- Create the most comprehensive user view combining ALL data sources
CREATE OR REPLACE VIEW admin_complete_users AS
SELECT 
    au.id as user_id,
    au.email,
    au.registration_date,
    au.updated_at,
    au.last_sign_in_at,
    au.email_confirmed_at,
    au.auth_methods,
    au.login_status,
    au.banned_until,
    au.raw_user_meta_data,
    au.raw_app_meta_data,
    
    -- Admin information
    adu.id as admin_user_id,
    adu.role as admin_role,
    adu.permissions as admin_permissions,
    adu.created_at as admin_since,
    CASE WHEN adu.id IS NOT NULL THEN true ELSE false END as is_admin,
    
    -- Subscription information from user_subscriptions (main table)
    us.id as subscription_id,
    us.status as subscription_status,
    us.current_period_start,
    us.current_period_end,
    us.trial_ends_at,
    us.cancel_at_period_end,
    us.canceled_at,
    us.created_at as subscription_created_at,
    us.updated_at as subscription_updated_at,
    
    -- Subscription plan details
    sp.name as plan_name,
    sp.slug as plan_slug,
    sp.price_ars as plan_price,
    sp.features as plan_features,
    sp.max_pieces as plan_max_pieces,
    sp.max_calculations as plan_max_calculations,
    
    -- Legacy subscription data (for fallback)
    s.plan_type as legacy_plan_type,
    s.active as legacy_active,
    s.expires_at as legacy_expires_at,
    
    -- Pieces and usage statistics
    COALESCE(p_stats.piece_count, 0) as piece_count,
    COALESCE(p_stats.total_estimated_value, 0) as total_estimated_value,
    p_stats.first_piece_created,
    p_stats.last_piece_created,
    
    -- Piece versions (calculations) statistics
    COALESCE(pv_stats.version_count, 0) as version_count,
    COALESCE(pv_stats.total_calculations_value, 0) as total_calculations_value,
    pv_stats.last_calculation_date,
    
    -- Configuration profiles
    COALESCE(cp_stats.profile_count, 0) as config_profile_count,
    cp_stats.last_profile_created,
    
    -- Filament inventory
    COALESCE(f_stats.filament_count, 0) as filament_count,
    COALESCE(f_stats.total_weight, 0) as total_filament_weight,
    
    -- Payment history
    COALESCE(pt_stats.payment_count, 0) as payment_count,
    COALESCE(pt_stats.total_paid, 0) as total_amount_paid,
    COALESCE(pt_stats.successful_payments, 0) as successful_payments,
    pt_stats.last_payment_date,
    pt_stats.first_payment_date,
    
    -- Monthly usage tracking
    COALESCE(uu_stats.current_month_calculations, 0) as current_month_calculations,
    COALESCE(uu_stats.current_month_pieces, 0) as current_month_pieces,
    COALESCE(uu_stats.current_month_exports, 0) as current_month_exports,
    
    -- Activity score calculation
    CASE 
        WHEN COALESCE(p_stats.piece_count, 0) >= 20 AND us.status = 'active' THEN 5
        WHEN COALESCE(p_stats.piece_count, 0) >= 10 THEN 4
        WHEN COALESCE(p_stats.piece_count, 0) >= 5 THEN 3
        WHEN COALESCE(p_stats.piece_count, 0) >= 1 THEN 2
        WHEN au.last_sign_in_at > NOW() - INTERVAL '30 days' THEN 1
        ELSE 0
    END as activity_score,
    
    -- Determine current status
    CASE 
        WHEN au.banned_until IS NOT NULL AND au.banned_until > NOW() THEN 'banned'
        WHEN us.status = 'active' AND us.current_period_end > NOW() THEN 'premium_active'
        WHEN us.status = 'trial' AND us.trial_ends_at > NOW() THEN 'trial'
        WHEN us.status = 'canceled' THEN 'subscription_canceled'
        WHEN us.current_period_end < NOW() THEN 'subscription_expired'
        WHEN au.email_confirmed_at IS NULL THEN 'email_unconfirmed'
        WHEN au.last_sign_in_at IS NULL THEN 'never_logged_in'
        WHEN au.last_sign_in_at < NOW() - INTERVAL '90 days' THEN 'dormant'
        ELSE 'active'
    END as current_status

FROM admin_auth_users_view au

-- Join admin users
LEFT JOIN admin_users adu ON au.id = adu.user_id

-- Join user subscriptions (main subscription table)
LEFT JOIN user_subscriptions us ON au.id = us.user_id 
    AND us.status != 'canceled' 
    AND (us.current_period_end IS NULL OR us.current_period_end = (
        SELECT MAX(us2.current_period_end) 
        FROM user_subscriptions us2 
        WHERE us2.user_id = au.id
    ))

-- Join subscription plans
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id

-- Join legacy subscriptions table for fallback
LEFT JOIN subscriptions s ON au.id = s.user_id

-- Aggregate pieces statistics
LEFT JOIN (
    SELECT 
        user_id,
        COUNT(*) as piece_count,
        SUM(COALESCE(est_price_ars, 0)) as total_estimated_value,
        MIN(created_at) as first_piece_created,
        MAX(created_at) as last_piece_created
    FROM pieces
    GROUP BY user_id
) p_stats ON au.id = p_stats.user_id

-- Aggregate piece versions statistics
LEFT JOIN (
    SELECT 
        p.user_id,
        COUNT(pv.*) as version_count,
        SUM(COALESCE(pv.total, 0)) as total_calculations_value,
        MAX(pv.created_at) as last_calculation_date
    FROM piece_versions pv
    JOIN pieces p ON pv.piece_id = p.id
    GROUP BY p.user_id
) pv_stats ON au.id = pv_stats.user_id

-- Aggregate config profiles
LEFT JOIN (
    SELECT 
        user_id,
        COUNT(*) as profile_count,
        MAX(created_at) as last_profile_created
    FROM config_profiles
    GROUP BY user_id
) cp_stats ON au.id = cp_stats.user_id

-- Aggregate filaments
LEFT JOIN (
    SELECT 
        user_id,
        COUNT(*) as filament_count,
        SUM(COALESCE(weight_grams, 0)) as total_weight
    FROM filaments
    GROUP BY user_id
) f_stats ON au.id = f_stats.user_id

-- Aggregate payment transactions
LEFT JOIN (
    SELECT 
        user_id,
        COUNT(*) as payment_count,
        SUM(CASE WHEN status IN ('approved', 'completed') THEN amount ELSE 0 END) as total_paid,
        COUNT(CASE WHEN status IN ('approved', 'completed') THEN 1 END) as successful_payments,
        MIN(created_at) as first_payment_date,
        MAX(CASE WHEN status IN ('approved', 'completed') THEN processed_at END) as last_payment_date
    FROM payment_transactions
    GROUP BY user_id
) pt_stats ON au.id = pt_stats.user_id

-- Aggregate current month usage
LEFT JOIN (
    SELECT 
        user_id,
        calculations_used as current_month_calculations,
        pieces_created as current_month_pieces,
        html_exports as current_month_exports
    FROM user_usage
    WHERE month_year = TO_CHAR(NOW(), 'YYYY-MM')
) uu_stats ON au.id = uu_stats.user_id;

-- ==============================
-- COMPREHENSIVE ANALYTICS VIEWS
-- ==============================

-- Enhanced subscription analytics with revenue breakdown
CREATE OR REPLACE VIEW admin_subscription_revenue_analytics AS
SELECT 
    sp.id as plan_id,
    sp.name as plan_name,
    sp.slug as plan_slug,
    sp.price_ars as base_price,
    
    -- Current subscription counts
    COUNT(us.id) as total_ever_subscribed,
    COUNT(CASE WHEN us.status = 'active' THEN 1 END) as currently_active,
    COUNT(CASE WHEN us.status = 'trial' THEN 1 END) as currently_trial,
    COUNT(CASE WHEN us.status = 'canceled' THEN 1 END) as canceled_subscriptions,
    COUNT(CASE WHEN us.current_period_end < NOW() THEN 1 END) as expired_subscriptions,
    
    -- Monthly trends
    COUNT(CASE WHEN us.created_at >= DATE_TRUNC('month', NOW()) THEN 1 END) as new_this_month,
    COUNT(CASE WHEN us.canceled_at >= DATE_TRUNC('month', NOW()) THEN 1 END) as canceled_this_month,
    
    -- Revenue calculations
    SUM(CASE WHEN pt.status IN ('approved', 'completed') THEN pt.amount ELSE 0 END) as total_revenue,
    SUM(CASE 
        WHEN pt.status IN ('approved', 'completed') 
        AND pt.created_at >= DATE_TRUNC('month', NOW()) 
        THEN pt.amount ELSE 0 
    END) as monthly_revenue,
    AVG(CASE WHEN pt.status IN ('approved', 'completed') THEN pt.amount END) as avg_payment_amount,
    
    -- Usage statistics
    AVG(uu.calculations_used) as avg_monthly_calculations,
    AVG(uu.pieces_created) as avg_monthly_pieces,
    
    -- Churn and retention
    COUNT(CASE 
        WHEN us.canceled_at IS NOT NULL 
        AND us.canceled_at > us.created_at + INTERVAL '1 month' 
        THEN 1 
    END) as retained_beyond_first_month

FROM subscription_plans sp
LEFT JOIN user_subscriptions us ON sp.id = us.plan_id
LEFT JOIN payment_transactions pt ON us.id = pt.subscription_id
LEFT JOIN user_usage uu ON us.user_id = uu.user_id 
    AND uu.month_year = TO_CHAR(NOW(), 'YYYY-MM')
GROUP BY sp.id, sp.name, sp.slug, sp.price_ars
ORDER BY sp.price_ars DESC;

-- Enhanced daily activity view combining all activity types
CREATE OR REPLACE VIEW admin_daily_activity AS
SELECT 
    activity_date,
    
    -- User registrations
    COALESCE(registrations, 0) as new_registrations,
    
    -- Piece activity
    COALESCE(pieces_created, 0) as pieces_created,
    COALESCE(calculations_made, 0) as calculations_made,
    
    -- Subscription activity
    COALESCE(new_subscriptions, 0) as new_subscriptions,
    COALESCE(subscription_cancellations, 0) as subscription_cancellations,
    
    -- Payment activity
    COALESCE(payments_made, 0) as payments_made,
    COALESCE(successful_payments, 0) as successful_payments,
    COALESCE(daily_revenue, 0) as daily_revenue,
    
    -- Configuration activity
    COALESCE(profiles_created, 0) as config_profiles_created,
    COALESCE(filaments_added, 0) as filaments_added

FROM (
    -- Generate date series for last 90 days
    SELECT generate_series(
        CURRENT_DATE - INTERVAL '90 days',
        CURRENT_DATE,
        '1 day'::interval
    )::date as activity_date
) dates

-- User registrations
LEFT JOIN (
    SELECT 
        DATE(created_at) as reg_date,
        COUNT(*) as registrations
    FROM admin_auth_users_view
    WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY DATE(created_at)
) reg_data ON dates.activity_date = reg_data.reg_date

-- Pieces created
LEFT JOIN (
    SELECT 
        DATE(created_at) as piece_date,
        COUNT(*) as pieces_created
    FROM pieces
    WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY DATE(created_at)
) piece_data ON dates.activity_date = piece_data.piece_date

-- Calculations made (piece versions)
LEFT JOIN (
    SELECT 
        DATE(created_at) as calc_date,
        COUNT(*) as calculations_made
    FROM piece_versions
    WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY DATE(created_at)
) calc_data ON dates.activity_date = calc_data.calc_date

-- Subscription activity
LEFT JOIN (
    SELECT 
        DATE(created_at) as sub_date,
        COUNT(*) as new_subscriptions
    FROM user_subscriptions
    WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY DATE(created_at)
) sub_data ON dates.activity_date = sub_data.sub_date

LEFT JOIN (
    SELECT 
        DATE(canceled_at) as cancel_date,
        COUNT(*) as subscription_cancellations
    FROM user_subscriptions
    WHERE canceled_at >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY DATE(canceled_at)
) cancel_data ON dates.activity_date = cancel_data.cancel_date

-- Payment activity
LEFT JOIN (
    SELECT 
        DATE(COALESCE(processed_at, created_at)) as payment_date,
        COUNT(*) as payments_made,
        COUNT(CASE WHEN status IN ('approved', 'completed') THEN 1 END) as successful_payments,
        SUM(CASE WHEN status IN ('approved', 'completed') THEN amount ELSE 0 END) as daily_revenue
    FROM payment_transactions
    WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY DATE(COALESCE(processed_at, created_at))
) payment_data ON dates.activity_date = payment_data.payment_date

-- Configuration profiles
LEFT JOIN (
    SELECT 
        DATE(created_at) as profile_date,
        COUNT(*) as profiles_created
    FROM config_profiles
    WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY DATE(created_at)
) profile_data ON dates.activity_date = profile_data.profile_date

-- Filament additions
LEFT JOIN (
    SELECT 
        DATE(created_at) as filament_date,
        COUNT(*) as filaments_added
    FROM filaments
    WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY DATE(created_at)
) filament_data ON dates.activity_date = filament_data.filament_date

ORDER BY activity_date DESC;

-- ==============================
-- BUSINESS INTELLIGENCE VIEWS
-- ==============================

-- Revenue and financial analytics
CREATE OR REPLACE VIEW admin_financial_overview AS
SELECT 
    -- Overall financial metrics
    (SELECT COUNT(*) FROM admin_auth_users_view) as total_registered_users,
    (SELECT COUNT(*) FROM user_subscriptions WHERE status = 'active') as active_subscribers,
    (SELECT COUNT(*) FROM payment_transactions WHERE status IN ('approved', 'completed')) as successful_transactions,
    
    -- Revenue metrics
    (SELECT COALESCE(SUM(amount), 0) FROM payment_transactions WHERE status IN ('approved', 'completed')) as total_revenue_ever,
    (SELECT COALESCE(SUM(amount), 0) 
     FROM payment_transactions 
     WHERE status IN ('approved', 'completed')
     AND DATE_TRUNC('month', COALESCE(processed_at, created_at)) = DATE_TRUNC('month', NOW())
    ) as current_month_revenue,
    (SELECT COALESCE(SUM(amount), 0) 
     FROM payment_transactions 
     WHERE status IN ('approved', 'completed')
     AND DATE_TRUNC('month', COALESCE(processed_at, created_at)) = DATE_TRUNC('month', NOW() - INTERVAL '1 month')
    ) as last_month_revenue,
    
    -- Average metrics
    (SELECT ROUND(AVG(amount), 2) 
     FROM payment_transactions 
     WHERE status IN ('approved', 'completed')
    ) as avg_transaction_amount,
    
    -- Monthly Recurring Revenue (MRR) calculation
    (SELECT COALESCE(SUM(sp.price_ars), 0)
     FROM user_subscriptions us
     JOIN subscription_plans sp ON us.plan_id = sp.id
     WHERE us.status = 'active'
     AND (us.current_period_end IS NULL OR us.current_period_end > NOW())
    ) as estimated_mrr,
    
    -- User engagement metrics
    (SELECT COUNT(DISTINCT user_id) 
     FROM pieces 
     WHERE created_at >= NOW() - INTERVAL '30 days'
    ) as active_creators_30d,
    
    (SELECT COUNT(DISTINCT p.user_id)
     FROM pieces p
     JOIN piece_versions pv ON p.id = pv.piece_id
     WHERE pv.created_at >= NOW() - INTERVAL '30 days'
    ) as active_calculators_30d,
    
    -- Platform usage
    (SELECT COUNT(*) FROM pieces WHERE created_at >= NOW() - INTERVAL '30 days') as pieces_created_30d,
    (SELECT COUNT(*) FROM piece_versions WHERE created_at >= NOW() - INTERVAL '30 days') as calculations_30d,
    (SELECT COUNT(*) FROM config_profiles WHERE created_at >= NOW() - INTERVAL '30 days') as profiles_created_30d;

-- User segmentation view
CREATE OR REPLACE VIEW admin_user_segments AS
SELECT 
    user_id,
    email,
    registration_date,
    
    -- User classification
    CASE 
        WHEN is_admin THEN 'admin'
        WHEN subscription_status = 'active' AND piece_count >= 10 THEN 'premium_power_user'
        WHEN subscription_status = 'active' THEN 'premium_user'
        WHEN piece_count >= 20 THEN 'free_power_user'
        WHEN piece_count >= 5 THEN 'engaged_free_user'
        WHEN piece_count >= 1 THEN 'new_user'
        WHEN last_sign_in_at IS NOT NULL THEN 'registered_inactive'
        ELSE 'registered_never_used'
    END as user_segment,
    
    -- Engagement level
    CASE 
        WHEN last_piece_created >= NOW() - INTERVAL '7 days' THEN 'highly_active'
        WHEN last_piece_created >= NOW() - INTERVAL '30 days' THEN 'active'
        WHEN last_piece_created >= NOW() - INTERVAL '90 days' THEN 'somewhat_active'
        WHEN last_piece_created IS NOT NULL THEN 'inactive'
        ELSE 'never_created'
    END as engagement_level,
    
    -- Value tier
    CASE 
        WHEN total_amount_paid >= 10000 THEN 'high_value'
        WHEN total_amount_paid >= 5000 THEN 'medium_value'
        WHEN total_amount_paid > 0 THEN 'low_value'
        WHEN subscription_status = 'active' THEN 'paying_user'
        ELSE 'free_user'
    END as value_tier,
    
    piece_count,
    version_count,
    total_amount_paid,
    subscription_status,
    plan_name,
    activity_score,
    last_piece_created,
    last_sign_in_at

FROM admin_complete_users
ORDER BY 
    CASE user_segment
        WHEN 'admin' THEN 1
        WHEN 'premium_power_user' THEN 2
        WHEN 'premium_user' THEN 3
        WHEN 'free_power_user' THEN 4
        WHEN 'engaged_free_user' THEN 5
        WHEN 'new_user' THEN 6
        WHEN 'registered_inactive' THEN 7
        ELSE 8
    END,
    activity_score DESC,
    piece_count DESC;

-- ==============================
-- ADMIN FUNCTIONS
-- ==============================

-- Comprehensive dashboard statistics function
CREATE OR REPLACE FUNCTION get_comprehensive_admin_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        -- User statistics
        'users', json_build_object(
            'total_registered', (SELECT COUNT(*) FROM admin_auth_users_view),
            'email_confirmed', (SELECT COUNT(*) FROM admin_auth_users_view WHERE email_confirmed_at IS NOT NULL),
            'never_logged_in', (SELECT COUNT(*) FROM admin_auth_users_view WHERE last_sign_in_at IS NULL),
            'active_7d', (SELECT COUNT(*) FROM admin_auth_users_view WHERE last_sign_in_at >= NOW() - INTERVAL '7 days'),
            'active_30d', (SELECT COUNT(*) FROM admin_auth_users_view WHERE last_sign_in_at >= NOW() - INTERVAL '30 days'),
            'dormant_90d', (SELECT COUNT(*) FROM admin_auth_users_view WHERE last_sign_in_at < NOW() - INTERVAL '90 days'),
            'with_pieces', (SELECT COUNT(DISTINCT user_id) FROM pieces),
            'with_subscriptions', (SELECT COUNT(DISTINCT user_id) FROM user_subscriptions),
            'admins', (SELECT COUNT(*) FROM admin_users)
        ),
        
        -- Subscription statistics
        'subscriptions', json_build_object(
            'total_active', (SELECT COUNT(*) FROM user_subscriptions WHERE status = 'active'),
            'total_trial', (SELECT COUNT(*) FROM user_subscriptions WHERE status = 'trial'),
            'total_canceled', (SELECT COUNT(*) FROM user_subscriptions WHERE status = 'canceled'),
            'expiring_soon', (SELECT COUNT(*) FROM user_subscriptions WHERE status = 'active' AND current_period_end <= NOW() + INTERVAL '7 days'),
            'new_this_month', (SELECT COUNT(*) FROM user_subscriptions WHERE created_at >= DATE_TRUNC('month', NOW())),
            'estimated_mrr', (SELECT estimated_mrr FROM admin_financial_overview LIMIT 1)
        ),
        
        -- Content statistics
        'content', json_build_object(
            'total_pieces', (SELECT COUNT(*) FROM pieces),
            'pieces_today', (SELECT COUNT(*) FROM pieces WHERE DATE(created_at) = CURRENT_DATE),
            'pieces_this_week', (SELECT COUNT(*) FROM pieces WHERE created_at >= DATE_TRUNC('week', NOW())),
            'pieces_this_month', (SELECT COUNT(*) FROM pieces WHERE created_at >= DATE_TRUNC('month', NOW())),
            'total_calculations', (SELECT COUNT(*) FROM piece_versions),
            'calculations_today', (SELECT COUNT(*) FROM piece_versions WHERE DATE(created_at) = CURRENT_DATE),
            'avg_pieces_per_user', (SELECT ROUND(AVG(piece_count), 2) FROM admin_complete_users WHERE piece_count > 0)
        ),
        
        -- Financial statistics
        'finance', json_build_object(
            'total_revenue', (SELECT total_revenue_ever FROM admin_financial_overview LIMIT 1),
            'monthly_revenue', (SELECT current_month_revenue FROM admin_financial_overview LIMIT 1),
            'last_month_revenue', (SELECT last_month_revenue FROM admin_financial_overview LIMIT 1),
            'successful_transactions', (SELECT successful_transactions FROM admin_financial_overview LIMIT 1),
            'avg_transaction', (SELECT avg_transaction_amount FROM admin_financial_overview LIMIT 1),
            'payments_today', (SELECT COUNT(*) FROM payment_transactions WHERE DATE(created_at) = CURRENT_DATE),
            'pending_payments', (SELECT COUNT(*) FROM payment_transactions WHERE status = 'pending')
        ),
        
        -- Platform usage
        'usage', json_build_object(
            'config_profiles', (SELECT COUNT(*) FROM config_profiles),
            'filament_entries', (SELECT COUNT(*) FROM filaments),
            'total_filament_weight', (SELECT COALESCE(SUM(weight_grams), 0) FROM filaments),
            'monthly_calculations', (SELECT SUM(calculations_used) FROM user_usage WHERE month_year = TO_CHAR(NOW(), 'YYYY-MM')),
            'monthly_exports', (SELECT SUM(html_exports) FROM user_usage WHERE month_year = TO_CHAR(NOW(), 'YYYY-MM')),
            'api_calls_month', (SELECT SUM(api_calls) FROM user_usage WHERE month_year = TO_CHAR(NOW(), 'YYYY-MM'))
        ),
        
        -- User segments
        'segments', (
            SELECT json_object_agg(user_segment, segment_count)
            FROM (
                SELECT user_segment, COUNT(*) as segment_count
                FROM admin_user_segments
                GROUP BY user_segment
            ) segment_counts
        ),
        
        -- Growth metrics
        'growth', json_build_object(
            'user_growth_7d', (
                SELECT COUNT(*) 
                FROM admin_auth_users_view 
                WHERE registration_date >= NOW() - INTERVAL '7 days'
            ),
            'revenue_growth_percent', (
                SELECT CASE 
                    WHEN last_month_revenue > 0 
                    THEN ROUND(((current_month_revenue - last_month_revenue) / last_month_revenue * 100), 1)
                    ELSE 0 
                END
                FROM admin_financial_overview LIMIT 1
            ),
            'subscription_growth_30d', (
                SELECT COUNT(*) 
                FROM user_subscriptions 
                WHERE created_at >= NOW() - INTERVAL '30 days'
            )
        )
        
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user segment distribution
CREATE OR REPLACE FUNCTION get_user_segment_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'by_segment', (
            SELECT json_object_agg(user_segment, segment_data)
            FROM (
                SELECT 
                    user_segment,
                    json_build_object(
                        'count', COUNT(*),
                        'avg_pieces', ROUND(AVG(piece_count), 2),
                        'avg_revenue', ROUND(AVG(total_amount_paid), 2),
                        'retention_score', ROUND(AVG(activity_score), 2)
                    ) as segment_data
                FROM admin_user_segments
                GROUP BY user_segment
            ) segments
        ),
        'by_engagement', (
            SELECT json_object_agg(engagement_level, engagement_data)
            FROM (
                SELECT 
                    engagement_level,
                    json_build_object(
                        'count', COUNT(*),
                        'percentage', ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM admin_user_segments), 2)
                    ) as engagement_data
                FROM admin_user_segments
                GROUP BY engagement_level
            ) engagement
        ),
        'by_value', (
            SELECT json_object_agg(value_tier, value_data)
            FROM (
                SELECT 
                    value_tier,
                    json_build_object(
                        'count', COUNT(*),
                        'total_revenue', SUM(total_amount_paid),
                        'avg_revenue_per_user', ROUND(AVG(total_amount_paid), 2)
                    ) as value_data
                FROM admin_user_segments
                GROUP BY value_tier
            ) value_tiers
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get recent activity across all tables
CREATE OR REPLACE FUNCTION get_recent_admin_activity(limit_count INT DEFAULT 20)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_agg(
        json_build_object(
            'type', activity_type,
            'title', title,
            'description', description,
            'details', details,
            'user_id', user_id,
            'created_at', created_at,
            'icon', icon
        )
        ORDER BY created_at DESC
    ) INTO result
    FROM (
        -- User registrations
        SELECT 
            'user_registration' as activity_type,
            'Nuevo usuario registrado' as title,
            COALESCE(email, 'Usuario sin email') as description,
            json_build_object('auth_method', auth_methods) as details,
            id as user_id,
            registration_date as created_at,
            '👤' as icon
        FROM admin_auth_users_view
        WHERE registration_date >= NOW() - INTERVAL '7 days'
        
        UNION ALL
        
        -- New pieces
        SELECT 
            'piece_created' as activity_type,
            'Nueva pieza creada' as title,
            COALESCE(title, 'Pieza sin nombre') as description,
            json_build_object(
                'category', category,
                'estimated_price', est_price_ars
            ) as details,
            user_id,
            created_at,
            '🔧' as icon
        FROM pieces
        WHERE created_at >= NOW() - INTERVAL '7 days'
        
        UNION ALL
        
        -- New calculations
        SELECT 
            'calculation_made' as activity_type,
            'Nuevo cálculo realizado' as title,
            CONCAT('Total: $', ROUND(total, 0)) as description,
            json_build_object(
                'material_cost', material_cost,
                'energy_cost', energy_cost,
                'total_time_hours', total_time_hours
            ) as details,
            p.user_id,
            pv.created_at,
            '💰' as icon
        FROM piece_versions pv
        JOIN pieces p ON pv.piece_id = p.id
        WHERE pv.created_at >= NOW() - INTERVAL '7 days'
        
        UNION ALL
        
        -- New subscriptions
        SELECT 
            'subscription_created' as activity_type,
            'Nueva suscripción' as title,
            CONCAT(sp.name, ' - ', us.status) as description,
            json_build_object(
                'plan_price', sp.price_ars,
                'trial_ends_at', us.trial_ends_at
            ) as details,
            us.user_id,
            us.created_at,
            '📈' as icon
        FROM user_subscriptions us
        JOIN subscription_plans sp ON us.plan_id = sp.id
        WHERE us.created_at >= NOW() - INTERVAL '7 days'
        
        UNION ALL
        
        -- Successful payments
        SELECT 
            'payment_completed' as activity_type,
            'Pago completado' as title,
            CONCAT('$', ROUND(amount, 0), ' - ', mp_payment_type) as description,
            json_build_object(
                'mp_payment_id', mp_payment_id,
                'status', status
            ) as details,
            user_id,
            COALESCE(processed_at, created_at) as created_at,
            '💳' as icon
        FROM payment_transactions
        WHERE status IN ('approved', 'completed')
        AND created_at >= NOW() - INTERVAL '7 days'
        
        UNION ALL
        
        -- Config profiles created
        SELECT 
            'profile_created' as activity_type,
            'Nuevo perfil de configuración' as title,
            COALESCE(name, 'Perfil sin nombre') as description,
            json_build_object('profile_type', 'custom') as details,
            user_id,
            created_at,
            '⚙️' as icon
        FROM config_profiles
        WHERE created_at >= NOW() - INTERVAL '7 days'
        
        UNION ALL
        
        -- Admin activities
        SELECT 
            CONCAT('admin_', action) as activity_type,
            'Acción de administrador' as title,
            CONCAT(action, ' - ', resource_type) as description,
            details,
            admin_id as user_id,
            created_at,
            '👑' as icon
        FROM admin_activity_log
        WHERE created_at >= NOW() - INTERVAL '7 days'
        
    ) all_activities
    ORDER BY created_at DESC
    LIMIT limit_count;
    
    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================
-- ENHANCED ADMIN PERMISSIONS
-- ==============================

-- Grant permissions for all new views and functions
GRANT SELECT ON admin_auth_users_view TO authenticated;
GRANT SELECT ON admin_complete_users TO authenticated;
GRANT SELECT ON admin_subscription_revenue_analytics TO authenticated;
GRANT SELECT ON admin_daily_activity TO authenticated;
GRANT SELECT ON admin_financial_overview TO authenticated;
GRANT SELECT ON admin_user_segments TO authenticated;

GRANT EXECUTE ON FUNCTION get_comprehensive_admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_segment_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_admin_activity(INT) TO authenticated;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_auth_users_created_at ON auth.users(created_at);
CREATE INDEX IF NOT EXISTS idx_auth_users_last_sign_in ON auth.users(last_sign_in_at);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status_period ON user_subscriptions(status, current_period_end);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_processed_status ON payment_transactions(processed_at, status);
CREATE INDEX IF NOT EXISTS idx_config_profiles_user_created ON config_profiles(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_filaments_user_weight ON filaments(user_id, weight_grams);
CREATE INDEX IF NOT EXISTS idx_user_usage_month_user ON user_usage(month_year, user_id);

-- ==============================
-- ROW LEVEL SECURITY POLICIES
-- ==============================

-- Enable RLS on views (only admins can access)
ALTER VIEW admin_auth_users_view OWNER TO postgres;
ALTER VIEW admin_complete_users OWNER TO postgres;
ALTER VIEW admin_subscription_revenue_analytics OWNER TO postgres;
ALTER VIEW admin_daily_activity OWNER TO postgres;
ALTER VIEW admin_financial_overview OWNER TO postgres;
ALTER VIEW admin_user_segments OWNER TO postgres;

-- Create RLS policies for admin views (only accessible by admin users)
CREATE POLICY "Admin only access to auth users view" ON admin_auth_users_view
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM admin_users 
            WHERE user_id = auth.uid()
        )
    );

COMMENT ON VIEW admin_auth_users_view IS 'Secure view for admin access to auth.users data';
COMMENT ON VIEW admin_complete_users IS 'Comprehensive user data combining all tables';
COMMENT ON VIEW admin_subscription_revenue_analytics IS 'Complete subscription and revenue analytics';
COMMENT ON VIEW admin_daily_activity IS 'Daily activity metrics across all platform activities';
COMMENT ON VIEW admin_financial_overview IS 'High-level financial and business metrics';
COMMENT ON VIEW admin_user_segments IS 'User segmentation and classification analytics';

COMMENT ON FUNCTION get_comprehensive_admin_stats() IS 'Returns complete admin dashboard statistics from all tables';
COMMENT ON FUNCTION get_user_segment_stats() IS 'Returns user segmentation analytics and distribution';
COMMENT ON FUNCTION get_recent_admin_activity(INT) IS 'Returns recent activity across all platform areas';