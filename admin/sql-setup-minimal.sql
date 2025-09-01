-- ZETALAB Admin Panel - Minimal Safe Setup
-- This script works even if optional tables (subscriptions, payment_transactions) don't exist

-- Clean slate approach
DROP VIEW IF EXISTS admin_users_view CASCADE;
DROP VIEW IF EXISTS admin_user_activity_log CASCADE;
DROP VIEW IF EXISTS admin_user_summary CASCADE;

-- 1. Basic admin users view (core functionality only)
CREATE VIEW admin_users_view AS
SELECT 
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    u.phone,
    u.role,
    u.banned_until,
    CASE 
        WHEN u.email_confirmed_at IS NOT NULL THEN true
        ELSE false
    END as verified,
    COUNT(DISTINCT p.id) as pieces_count,
    MAX(p.created_at) as last_piece_created,
    COUNT(DISTINCT pv.id) as versions_count,
    CASE 
        WHEN u.last_sign_in_at > NOW() - INTERVAL '30 days' THEN 'active'
        WHEN u.last_sign_in_at IS NULL THEN 'never_signed_in'
        ELSE 'inactive'
    END as activity_status,
    CASE 
        WHEN u.banned_until IS NOT NULL AND u.banned_until > NOW() THEN true
        ELSE false
    END as is_suspended,
    'free' as subscription_status -- Default since subscriptions table might not exist
FROM auth.users u
LEFT JOIN pieces p ON u.id = p.user_id
LEFT JOIN piece_versions pv ON p.id = pv.piece_id
WHERE u.deleted_at IS NULL OR u.deleted_at IS NULL -- Handle cases where deleted_at column doesn't exist
GROUP BY u.id, u.email, u.created_at, u.last_sign_in_at, 
         u.email_confirmed_at, u.phone, u.role, u.banned_until;

-- 2. Basic activity log
CREATE VIEW admin_user_activity_log AS
SELECT 
    u.id as user_id,
    u.email,
    'registration' as activity_type,
    u.created_at as activity_date,
    json_build_object('method', 'signup') as activity_data
FROM auth.users u

UNION ALL

SELECT 
    p.user_id,
    u.email,
    'piece_created' as activity_type,
    p.created_at as activity_date,
    json_build_object(
        'piece_id', p.id,
        'title', p.title
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
        'version_id', pv.id
    ) as activity_data
FROM piece_versions pv
JOIN auth.users u ON pv.user_id = u.id

ORDER BY activity_date DESC;

-- 3. Basic user summary
CREATE VIEW admin_user_summary AS
SELECT 
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    u.phone,
    u.role,
    CASE 
        WHEN u.email_confirmed_at IS NOT NULL THEN true
        ELSE false
    END as verified,
    u.banned_until,
    COUNT(DISTINCT p.id) as total_pieces,
    COUNT(DISTINCT pv.id) as total_versions,
    MAX(p.created_at) as last_piece_created,
    'free' as current_plan,
    false as subscription_active,
    COUNT(DISTINCT DATE(p.created_at)) as active_days_pieces,
    COUNT(DISTINCT DATE(pv.created_at)) as active_days_calculations
FROM auth.users u
LEFT JOIN pieces p ON u.id = p.user_id
LEFT JOIN piece_versions pv ON p.id = pv.piece_id
WHERE (u.deleted_at IS NULL OR u.deleted_at IS NULL) -- Defensive check
GROUP BY u.id, u.email, u.created_at, u.last_sign_in_at, u.phone, u.role, 
         u.email_confirmed_at, u.banned_until;

-- 4. Basic admin functions
CREATE OR REPLACE FUNCTION admin_suspend_user(
    target_user_id UUID,
    suspend_until TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    target_email TEXT;
    current_user_role TEXT;
BEGIN
    -- Check admin permission
    SELECT role INTO current_user_role FROM auth.users WHERE id = auth.uid();
    
    IF current_user_role IS NULL OR current_user_role != 'admin' THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    -- Get target user
    SELECT email INTO target_email FROM auth.users WHERE id = target_user_id;
    
    IF target_email IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;
    
    -- Update ban status
    UPDATE auth.users 
    SET banned_until = suspend_until
    WHERE id = target_user_id;
    
    RETURN json_build_object(
        'success', true,
        'action', CASE WHEN suspend_until IS NULL THEN 'unsuspended' ELSE 'suspended' END,
        'user_email', target_email
    );
END;
$$;

-- 5. Grant basic permissions
GRANT SELECT ON admin_users_view TO authenticated;
GRANT SELECT ON admin_user_activity_log TO authenticated;
GRANT SELECT ON admin_user_summary TO authenticated;
GRANT EXECUTE ON FUNCTION admin_suspend_user TO authenticated;

-- Success message
SELECT 'Admin views created successfully - basic version' as status;