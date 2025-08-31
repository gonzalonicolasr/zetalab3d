-- ==============================
-- ZETALAB Admin User View Setup
-- Create comprehensive user view for admin panel
-- ==============================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create admin user view with complete information
CREATE OR REPLACE VIEW admin_users_view AS
SELECT 
    au.id as user_id,
    au.email,
    au.created_at as registration_date,
    au.updated_at,
    au.last_sign_in_at,
    au.email_confirmed_at,
    au.confirmation_sent_at,
    -- Authentication method detection
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM auth.identities ai 
            WHERE ai.user_id = au.id AND ai.provider = 'google'
        ) THEN 'google'
        WHEN EXISTS (
            SELECT 1 FROM auth.identities ai 
            WHERE ai.user_id = au.id AND ai.provider = 'facebook'
        ) THEN 'facebook'
        ELSE 'email'
    END as auth_method,
    -- User metadata
    au.user_metadata,
    au.app_metadata,
    -- Subscription information
    s.id as subscription_id,
    s.type as subscription_type,
    s.status as subscription_status,
    s.expires_at as subscription_expires_at,
    s.created_at as subscription_created_at,
    -- Usage statistics
    COALESCE(piece_stats.piece_count, 0) as piece_count,
    COALESCE(version_stats.version_count, 0) as version_count,
    piece_stats.last_piece_created,
    version_stats.last_version_created,
    -- Admin status
    admin.role as admin_role,
    admin.active as is_admin_active,
    admin.permissions as admin_permissions,
    -- Calculated fields
    CASE 
        WHEN admin.active = true THEN 'admin'
        WHEN s.status = 'disabled' THEN 'disabled'
        WHEN s.type = 'trial' AND s.expires_at < NOW() THEN 'expired'
        WHEN s.type = 'trial' THEN 'trial'
        WHEN s.status IS NOT NULL THEN s.status
        ELSE 'active'
    END as user_status,
    -- Activity score (for sorting active users)
    CASE 
        WHEN piece_stats.last_piece_created > NOW() - INTERVAL '7 days' THEN 3
        WHEN piece_stats.last_piece_created > NOW() - INTERVAL '30 days' THEN 2
        WHEN piece_stats.last_piece_created > NOW() - INTERVAL '90 days' THEN 1
        ELSE 0
    END as activity_score
FROM auth.users au
-- Left join subscriptions
LEFT JOIN subscriptions s ON s.user_id = au.id
-- Left join admin users
LEFT JOIN admin_users admin ON admin.user_id = au.id
-- Left join piece statistics
LEFT JOIN (
    SELECT 
        user_id,
        COUNT(*) as piece_count,
        MAX(created_at) as last_piece_created
    FROM pieces 
    GROUP BY user_id
) piece_stats ON piece_stats.user_id = au.id
-- Left join version statistics
LEFT JOIN (
    SELECT 
        user_id,
        COUNT(*) as version_count,
        MAX(created_at) as last_version_created
    FROM piece_versions 
    GROUP BY user_id
) version_stats ON version_stats.user_id = au.id;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_users_view_user_status 
ON admin_users_view USING btree (user_status);

CREATE INDEX IF NOT EXISTS idx_admin_users_view_subscription_type 
ON admin_users_view USING btree (subscription_type);

CREATE INDEX IF NOT EXISTS idx_admin_users_view_registration_date 
ON admin_users_view USING btree (registration_date);

CREATE INDEX IF NOT EXISTS idx_admin_users_view_activity_score 
ON admin_users_view USING btree (activity_score DESC);

-- Grant access to authenticated users (admin panel will use service role)
GRANT SELECT ON admin_users_view TO authenticated;
GRANT SELECT ON admin_users_view TO service_role;

-- Create function to get user statistics summary
CREATE OR REPLACE FUNCTION get_admin_user_stats()
RETURNS TABLE (
    total_users bigint,
    active_users bigint,
    trial_users bigint,
    premium_users bigint,
    expired_users bigint,
    admin_users bigint,
    users_this_week bigint,
    users_this_month bigint
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE user_status = 'active') as active_users,
        COUNT(*) FILTER (WHERE user_status = 'trial') as trial_users,
        COUNT(*) FILTER (WHERE subscription_type = 'premium') as premium_users,
        COUNT(*) FILTER (WHERE user_status = 'expired') as expired_users,
        COUNT(*) FILTER (WHERE admin_role IS NOT NULL AND is_admin_active = true) as admin_users,
        COUNT(*) FILTER (WHERE registration_date >= NOW() - INTERVAL '7 days') as users_this_week,
        COUNT(*) FILTER (WHERE registration_date >= NOW() - INTERVAL '30 days') as users_this_month
    FROM admin_users_view;
$$;

-- Create function to get user activity trends
CREATE OR REPLACE FUNCTION get_user_activity_trends(days_back integer DEFAULT 30)
RETURNS TABLE (
    date_period date,
    new_users bigint,
    active_users bigint,
    pieces_created bigint
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        date_trunc('day', gs.day)::date as date_period,
        COALESCE(new_user_counts.new_users, 0) as new_users,
        COALESCE(active_user_counts.active_users, 0) as active_users,
        COALESCE(piece_counts.pieces_created, 0) as pieces_created
    FROM generate_series(
        (NOW() - (days_back || ' days')::interval)::date,
        NOW()::date,
        '1 day'::interval
    ) gs(day)
    LEFT JOIN (
        SELECT 
            registration_date::date as reg_date,
            COUNT(*) as new_users
        FROM admin_users_view 
        WHERE registration_date >= NOW() - (days_back || ' days')::interval
        GROUP BY registration_date::date
    ) new_user_counts ON new_user_counts.reg_date = gs.day::date
    LEFT JOIN (
        SELECT 
            last_piece_created::date as activity_date,
            COUNT(DISTINCT user_id) as active_users
        FROM admin_users_view 
        WHERE last_piece_created >= NOW() - (days_back || ' days')::interval
        GROUP BY last_piece_created::date
    ) active_user_counts ON active_user_counts.activity_date = gs.day::date
    LEFT JOIN (
        SELECT 
            created_at::date as piece_date,
            COUNT(*) as pieces_created
        FROM pieces 
        WHERE created_at >= NOW() - (days_back || ' days')::interval
        GROUP BY created_at::date
    ) piece_counts ON piece_counts.piece_date = gs.day::date
    ORDER BY date_period;
$$;

-- Create function to search users (for admin panel search)
CREATE OR REPLACE FUNCTION search_admin_users(
    search_term text DEFAULT '',
    status_filter text DEFAULT '',
    subscription_filter text DEFAULT '',
    date_from date DEFAULT NULL,
    date_to date DEFAULT NULL,
    limit_count integer DEFAULT 25,
    offset_count integer DEFAULT 0
)
RETURNS TABLE (
    user_id uuid,
    email text,
    registration_date timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    auth_method text,
    subscription_type text,
    subscription_status text,
    subscription_expires_at timestamp with time zone,
    user_status text,
    piece_count bigint,
    version_count bigint,
    last_piece_created timestamp with time zone,
    is_admin boolean,
    admin_role text,
    activity_score integer
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        auv.user_id,
        auv.email,
        auv.registration_date,
        auv.last_sign_in_at,
        auv.auth_method,
        COALESCE(auv.subscription_type, 'none') as subscription_type,
        auv.subscription_status,
        auv.subscription_expires_at,
        auv.user_status,
        auv.piece_count,
        auv.version_count,
        auv.last_piece_created,
        (auv.admin_role IS NOT NULL AND auv.is_admin_active = true) as is_admin,
        auv.admin_role,
        auv.activity_score
    FROM admin_users_view auv
    WHERE 
        -- Search term filter
        (search_term = '' OR 
         auv.email ILIKE '%' || search_term || '%' OR
         auv.user_id::text ILIKE '%' || search_term || '%')
        -- Status filter
        AND (status_filter = '' OR auv.user_status = status_filter)
        -- Subscription filter
        AND (subscription_filter = '' OR 
             (subscription_filter = 'none' AND auv.subscription_type IS NULL) OR
             auv.subscription_type = subscription_filter)
        -- Date range filters
        AND (date_from IS NULL OR auv.registration_date::date >= date_from)
        AND (date_to IS NULL OR auv.registration_date::date <= date_to)
    ORDER BY 
        -- Admin users first, then by activity, then by registration date
        (auv.admin_role IS NOT NULL AND auv.is_admin_active = true) DESC,
        auv.activity_score DESC,
        auv.registration_date DESC
    LIMIT limit_count
    OFFSET offset_count;
$$;

-- Grant execute permissions to service role for admin functions
GRANT EXECUTE ON FUNCTION get_admin_user_stats() TO service_role;
GRANT EXECUTE ON FUNCTION get_user_activity_trends(integer) TO service_role;
GRANT EXECUTE ON FUNCTION search_admin_users(text, text, text, date, date, integer, integer) TO service_role;

-- Create admin activity log for tracking admin actions
CREATE TABLE IF NOT EXISTS admin_activity_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    action_type text NOT NULL,
    resource_type text NOT NULL,
    resource_id uuid,
    resource_data jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);

-- Create index for admin activity log
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_admin_user 
ON admin_activity_log USING btree (admin_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_activity_log_action_type 
ON admin_activity_log USING btree (action_type, created_at DESC);

-- Function to log admin activities
CREATE OR REPLACE FUNCTION log_admin_activity(
    action_type_param text,
    resource_type_param text,
    resource_id_param uuid DEFAULT NULL,
    resource_data_param jsonb DEFAULT NULL,
    ip_address_param inet DEFAULT NULL,
    user_agent_param text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    activity_id uuid;
    current_user_id uuid;
BEGIN
    -- Get current user ID
    current_user_id := auth.uid();
    
    -- Insert activity log
    INSERT INTO admin_activity_log (
        admin_user_id,
        action_type,
        resource_type,
        resource_id,
        resource_data,
        ip_address,
        user_agent
    ) VALUES (
        current_user_id,
        action_type_param,
        resource_type_param,
        resource_id_param,
        resource_data_param,
        ip_address_param,
        user_agent_param
    ) RETURNING id INTO activity_id;
    
    RETURN activity_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION log_admin_activity(text, text, uuid, jsonb, inet, text) TO service_role;

-- Add RLS policies for admin activity log
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Policy: Admin users can view all activity logs
CREATE POLICY "Admin users can view all activity logs" ON admin_activity_log
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM admin_users 
        WHERE user_id = auth.uid() AND active = true
    )
);

-- Policy: Only service role can insert activity logs
CREATE POLICY "Service role can insert activity logs" ON admin_activity_log
FOR INSERT TO service_role
WITH CHECK (true);

COMMENT ON VIEW admin_users_view IS 'Comprehensive user view for admin panel with all user information, subscriptions, usage stats, and admin status';
COMMENT ON FUNCTION get_admin_user_stats() IS 'Returns summary statistics for admin dashboard';
COMMENT ON FUNCTION get_user_activity_trends(integer) IS 'Returns user activity trends over specified number of days';
COMMENT ON FUNCTION search_admin_users(text, text, text, date, date, integer, integer) IS 'Search and filter users for admin panel with pagination';
COMMENT ON TABLE admin_activity_log IS 'Logs all admin activities for audit trail';