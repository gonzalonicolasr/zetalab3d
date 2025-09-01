-- ZETALAB Admin Panel - SQL Setup
-- Execute these statements in Supabase SQL Editor

-- 1. Enhanced admin_users_view with additional data for user management
CREATE OR REPLACE VIEW admin_users_view AS
SELECT 
    u.id,
    u.email,
    u.created_at,
    u.updated_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    u.confirmed_at,
    u.phone,
    u.role,
    u.banned_until,
    u.deleted_at,
    CASE 
        WHEN u.email_confirmed_at IS NOT NULL OR u.confirmed_at IS NOT NULL THEN true
        ELSE false
    END as verified,
    COALESCE(
        ARRAY_AGG(DISTINCT i.provider) FILTER (WHERE i.provider IS NOT NULL), 
        ARRAY['email']::text[]
    ) as providers,
    COUNT(DISTINCT p.id) as pieces_count,
    MAX(p.created_at) as last_piece_created,
    COUNT(DISTINCT pv.id) as versions_count,
    CASE 
        WHEN s.id IS NOT NULL AND s.active = true THEN s.plan_type
        ELSE 'free'
    END as subscription_status,
    s.expires_at as subscription_expires,
    CASE 
        WHEN u.last_sign_in_at > NOW() - INTERVAL '30 days' THEN 'active'
        WHEN u.last_sign_in_at IS NULL THEN 'never_signed_in'
        ELSE 'inactive'
    END as activity_status,
    CASE 
        WHEN u.banned_until IS NOT NULL AND u.banned_until > NOW() THEN true
        ELSE false
    END as is_suspended
FROM auth.users u
LEFT JOIN auth.identities i ON u.id = i.user_id
LEFT JOIN pieces p ON u.id = p.user_id
LEFT JOIN piece_versions pv ON p.id = pv.piece_id
LEFT JOIN subscriptions s ON u.id = s.user_id AND s.active = true
GROUP BY u.id, u.email, u.created_at, u.updated_at, u.last_sign_in_at, 
         u.email_confirmed_at, u.confirmed_at, u.phone, u.role, 
         u.banned_until, u.deleted_at, s.id, s.plan_type, s.active, s.expires_at;

-- 2. User activity log view
CREATE OR REPLACE VIEW admin_user_activity_log AS
SELECT 
    u.id as user_id,
    u.email,
    'registration' as activity_type,
    u.created_at as activity_date,
    json_build_object(
        'provider', i.provider,
        'method', 'signup'
    ) as activity_data
FROM auth.users u
LEFT JOIN auth.identities i ON u.id = i.user_id AND i.created_at = u.created_at

UNION ALL

SELECT 
    p.user_id,
    u.email,
    'piece_created' as activity_type,
    p.created_at as activity_date,
    json_build_object(
        'piece_id', p.id,
        'title', p.title,
        'estimated_price', p.est_price_ars
    ) as activity_data
FROM pieces p
JOIN auth.users u ON p.user_id = u.id

UNION ALL

SELECT 
    pv.user_id,
    u.email,
    'calculation_saved' as activity_type,
    pv.created_at as activity_date,
    json_build_object(
        'piece_id', pv.piece_id,
        'version_id', pv.id,
        'calculated_price', pv.calculated_price
    ) as activity_data
FROM piece_versions pv
JOIN auth.users u ON pv.user_id = u.id

UNION ALL

SELECT 
    s.user_id,
    u.email,
    'subscription_created' as activity_type,
    s.created_at as activity_date,
    json_build_object(
        'plan_type', s.plan_type,
        'amount', s.amount,
        'expires_at', s.expires_at
    ) as activity_data
FROM subscriptions s
JOIN auth.users u ON s.user_id = u.id

ORDER BY activity_date DESC;

-- 3. User summary view for the modal
CREATE OR REPLACE VIEW admin_user_summary AS
SELECT 
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    u.phone,
    u.role,
    CASE 
        WHEN u.email_confirmed_at IS NOT NULL OR u.confirmed_at IS NOT NULL THEN true
        ELSE false
    END as verified,
    u.banned_until,
    u.deleted_at,
    -- Pieces statistics
    COUNT(DISTINCT p.id) as total_pieces,
    COUNT(DISTINCT pv.id) as total_versions,
    SUM(CASE WHEN p.est_price_ars IS NOT NULL THEN p.est_price_ars ELSE 0 END) as total_estimated_value,
    MAX(p.created_at) as last_piece_created,
    -- Subscription info
    s.plan_type as current_plan,
    s.active as subscription_active,
    s.expires_at as subscription_expires,
    s.amount as subscription_amount,
    -- Payment history
    COUNT(DISTINCT pt.id) as total_transactions,
    SUM(CASE WHEN pt.status = 'approved' THEN pt.amount ELSE 0 END) as total_payments,
    -- Activity metrics
    COUNT(DISTINCT DATE(p.created_at)) as active_days_pieces,
    COUNT(DISTINCT DATE(pv.created_at)) as active_days_calculations
FROM auth.users u
LEFT JOIN pieces p ON u.id = p.user_id
LEFT JOIN piece_versions pv ON p.id = pv.piece_id
LEFT JOIN subscriptions s ON u.id = s.user_id AND s.active = true
LEFT JOIN payment_transactions pt ON u.id = pt.user_id
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.email, u.created_at, u.last_sign_in_at, u.phone, u.role, 
         u.email_confirmed_at, u.confirmed_at, u.banned_until, u.deleted_at,
         s.plan_type, s.active, s.expires_at, s.amount;

-- 4. Admin function to suspend/unsuspend users
CREATE OR REPLACE FUNCTION admin_suspend_user(
    target_user_id UUID,
    suspend_until TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    admin_reason TEXT DEFAULT 'Admin action'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    target_email TEXT;
BEGIN
    -- Get user email for logging
    SELECT email INTO target_email 
    FROM auth.users 
    WHERE id = target_user_id;
    
    IF target_email IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'User not found'
        );
    END IF;
    
    -- Update user ban status
    UPDATE auth.users 
    SET 
        banned_until = suspend_until,
        updated_at = NOW()
    WHERE id = target_user_id;
    
    -- Log the action
    INSERT INTO admin_actions (
        user_id,
        action_type,
        target_user_id,
        action_data,
        created_at
    ) VALUES (
        auth.uid(), -- Current admin user
        CASE WHEN suspend_until IS NULL THEN 'user_unsuspended' ELSE 'user_suspended' END,
        target_user_id,
        json_build_object(
            'target_email', target_email,
            'suspend_until', suspend_until,
            'reason', admin_reason
        ),
        NOW()
    );
    
    RETURN json_build_object(
        'success', true,
        'action', CASE WHEN suspend_until IS NULL THEN 'unsuspended' ELSE 'suspended' END,
        'user_email', target_email,
        'suspend_until', suspend_until
    );
END;
$$;

-- 5. Admin function to delete user account
CREATE OR REPLACE FUNCTION admin_delete_user(
    target_user_id UUID,
    admin_reason TEXT DEFAULT 'Admin deletion'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
    target_email TEXT;
BEGIN
    -- Get user email for logging
    SELECT email INTO target_email 
    FROM auth.users 
    WHERE id = target_user_id;
    
    IF target_email IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'User not found'
        );
    END IF;
    
    -- Soft delete user (mark as deleted)
    UPDATE auth.users 
    SET 
        deleted_at = NOW(),
        updated_at = NOW()
    WHERE id = target_user_id;
    
    -- Log the action
    INSERT INTO admin_actions (
        user_id,
        action_type,
        target_user_id,
        action_data,
        created_at
    ) VALUES (
        auth.uid(),
        'user_deleted',
        target_user_id,
        json_build_object(
            'target_email', target_email,
            'reason', admin_reason
        ),
        NOW()
    );
    
    RETURN json_build_object(
        'success', true,
        'action', 'deleted',
        'user_email', target_email
    );
END;
$$;

-- 6. Admin function to send welcome email
CREATE OR REPLACE FUNCTION admin_send_welcome_email(
    target_user_id UUID,
    custom_message TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_email TEXT;
BEGIN
    -- Get user email
    SELECT email INTO target_email 
    FROM auth.users 
    WHERE id = target_user_id;
    
    IF target_email IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'User not found'
        );
    END IF;
    
    -- Log the action (actual email sending would be handled by Edge Function)
    INSERT INTO admin_actions (
        user_id,
        action_type,
        target_user_id,
        action_data,
        created_at
    ) VALUES (
        auth.uid(),
        'welcome_email_sent',
        target_user_id,
        json_build_object(
            'target_email', target_email,
            'custom_message', custom_message
        ),
        NOW()
    );
    
    RETURN json_build_object(
        'success', true,
        'action', 'welcome_email_queued',
        'user_email', target_email
    );
END;
$$;

-- 7. Create admin_actions table for logging
CREATE TABLE IF NOT EXISTS admin_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON admin_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target_user ON admin_actions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_user_id ON admin_actions(user_id);

-- 8. Row Level Security policies
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

-- Allow admin users to read admin actions (you'll need to define admin role)
CREATE POLICY "Admin can view admin actions" ON admin_actions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.uid() = id 
            AND role = 'admin'
        )
    );

-- 9. Grant necessary permissions
GRANT SELECT ON admin_users_view TO anon, authenticated;
GRANT SELECT ON admin_user_activity_log TO anon, authenticated;
GRANT SELECT ON admin_user_summary TO anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_suspend_user TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_user TO authenticated;
GRANT EXECUTE ON FUNCTION admin_send_welcome_email TO authenticated;
GRANT SELECT, INSERT ON admin_actions TO authenticated;