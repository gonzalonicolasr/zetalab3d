-- ==============================
-- ZETALAB Admin Database Setup
-- Create views and functions for admin panel
-- ==============================

-- 1. Create view for auth users (read-only access to auth.users)
CREATE OR REPLACE VIEW admin_auth_users_view AS
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at AS registration_date,
  updated_at,
  last_sign_in_at,
  raw_user_meta_data,
  raw_app_meta_data,
  CASE 
    WHEN banned_until IS NOT NULL AND banned_until > NOW() THEN 'disabled'
    WHEN last_sign_in_at IS NULL THEN 'inactive'
    ELSE 'active'
  END AS login_status,
  banned_until,
  -- Extract auth methods from identities
  (
    SELECT STRING_AGG(provider, ',')
    FROM auth.identities 
    WHERE user_id = auth.users.id
  ) AS auth_methods
FROM auth.users
ORDER BY created_at DESC;

-- 2. Create comprehensive users view with all related data
CREATE OR REPLACE VIEW admin_complete_users AS
SELECT 
  u.id AS user_id,
  u.email,
  u.email_confirmed_at,
  u.created_at AS registration_date,
  u.updated_at,
  u.last_sign_in_at,
  u.raw_user_meta_data,
  u.raw_app_meta_data,
  u.banned_until,
  CASE 
    WHEN u.banned_until IS NOT NULL AND u.banned_until > NOW() THEN 'disabled'
    WHEN u.last_sign_in_at IS NULL THEN 'inactive'
    ELSE 'active'
  END AS current_status,
  
  -- Auth methods
  (
    SELECT STRING_AGG(provider, ',')
    FROM auth.identities 
    WHERE user_id = u.id
  ) AS auth_methods,
  
  -- Admin information
  admin.id IS NOT NULL AS is_admin,
  admin.role AS admin_role,
  admin.permissions AS admin_permissions,
  admin.created_at AS admin_since,
  
  -- Subscription information
  sub.id AS subscription_id,
  sub.status AS subscription_status,
  sub.current_period_start,
  sub.current_period_end,
  sub.trial_ends_at,
  sub.plan_name,
  sub.plan_price,
  sub.created_at AS subscription_created_at,
  COALESCE(sub.plan_slug, legacy_sub.type, 'free') AS plan_slug,
  COALESCE(sub.current_period_end, legacy_sub.expires_at) AS legacy_expires_at,
  COALESCE(sub.plan_name, legacy_sub.type) AS legacy_plan_type,
  
  -- Usage statistics from pieces
  COALESCE(piece_stats.piece_count, 0) AS piece_count,
  COALESCE(piece_stats.version_count, 0) AS version_count,
  COALESCE(piece_stats.total_estimated_value, 0) AS total_estimated_value,
  piece_stats.first_piece_created,
  piece_stats.last_piece_created,
  piece_stats.last_calculation_date,
  
  -- Configuration and inventory
  COALESCE(config_stats.config_profile_count, 0) AS config_profile_count,
  COALESCE(filament_stats.filament_count, 0) AS filament_count,
  COALESCE(filament_stats.total_filament_weight, 0) AS total_filament_weight,
  
  -- Payment information
  COALESCE(payment_stats.payment_count, 0) AS payment_count,
  COALESCE(payment_stats.total_amount_paid, 0) AS total_amount_paid,
  COALESCE(payment_stats.successful_payments, 0) AS successful_payments,
  payment_stats.last_payment_date,
  
  -- Monthly usage
  COALESCE(monthly_stats.calculations_used, 0) AS current_month_calculations,
  COALESCE(monthly_stats.pieces_created, 0) AS current_month_pieces,
  COALESCE(monthly_stats.html_exports, 0) AS current_month_exports,
  
  -- Calculated activity score
  CASE 
    WHEN piece_stats.piece_count IS NULL THEN 0
    WHEN piece_stats.last_piece_created > NOW() - INTERVAL '7 days' THEN 5
    WHEN piece_stats.last_piece_created > NOW() - INTERVAL '30 days' THEN 4
    WHEN piece_stats.piece_count > 5 THEN 3
    WHEN piece_stats.piece_count > 0 THEN 2
    ELSE 1
  END AS activity_score
  
FROM auth.users u

-- Left join admin users
LEFT JOIN admin_users admin ON admin.user_id = u.id AND admin.active = true

-- Left join current subscriptions
LEFT JOIN subscriptions sub ON sub.user_id = u.id AND sub.status = 'active'

-- Left join legacy subscription data (if exists)
LEFT JOIN (
  SELECT DISTINCT user_id, type, expires_at 
  FROM subscriptions 
  WHERE status != 'canceled'
) legacy_sub ON legacy_sub.user_id = u.id

-- Left join piece statistics
LEFT JOIN (
  SELECT 
    p.user_id,
    COUNT(p.id) AS piece_count,
    SUM(COALESCE(p.est_price_ars, 0)) AS total_estimated_value,
    MIN(p.created_at) AS first_piece_created,
    MAX(p.created_at) AS last_piece_created,
    COUNT(pv.id) AS version_count,
    MAX(pv.created_at) AS last_calculation_date
  FROM pieces p
  LEFT JOIN piece_versions pv ON pv.piece_id = p.id
  WHERE p.user_id IS NOT NULL
  GROUP BY p.user_id
) piece_stats ON piece_stats.user_id = u.id

-- Left join config profile stats
LEFT JOIN (
  SELECT 
    user_id,
    COUNT(*) AS config_profile_count
  FROM user_config_profiles
  GROUP BY user_id
) config_stats ON config_stats.user_id = u.id

-- Left join filament inventory stats  
LEFT JOIN (
  SELECT 
    user_id,
    COUNT(*) AS filament_count,
    SUM(weight_g) AS total_filament_weight
  FROM user_filaments
  GROUP BY user_id
) filament_stats ON filament_stats.user_id = u.id

-- Left join payment statistics
LEFT JOIN (
  SELECT 
    user_id,
    COUNT(*) AS payment_count,
    SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END) AS total_amount_paid,
    COUNT(CASE WHEN status = 'approved' THEN 1 END) AS successful_payments,
    MAX(CASE WHEN status = 'approved' THEN created_at END) AS last_payment_date
  FROM payments
  GROUP BY user_id
) payment_stats ON payment_stats.user_id = u.id

-- Left join monthly usage stats
LEFT JOIN (
  SELECT 
    user_id,
    calculations_used,
    pieces_created,
    html_exports
  FROM monthly_usage
  WHERE month_year = TO_CHAR(NOW(), 'YYYY-MM')
) monthly_stats ON monthly_stats.user_id = u.id

ORDER BY u.created_at DESC;

-- 3. Create RPC function to get comprehensive admin stats
CREATE OR REPLACE FUNCTION get_comprehensive_admin_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  total_users INTEGER;
  active_users INTEGER;
  inactive_users INTEGER;
  admin_users INTEGER;
  users_with_pieces INTEGER;
  users_with_subscriptions INTEGER;
  total_pieces INTEGER;
  total_versions INTEGER;
  total_revenue NUMERIC;
BEGIN
  -- Get user counts
  SELECT COUNT(*) INTO total_users FROM auth.users;
  
  SELECT COUNT(*) INTO active_users 
  FROM auth.users 
  WHERE last_sign_in_at IS NOT NULL 
    AND (banned_until IS NULL OR banned_until < NOW());
  
  SELECT COUNT(*) INTO inactive_users 
  FROM auth.users 
  WHERE last_sign_in_at IS NULL;
  
  SELECT COUNT(*) INTO admin_users 
  FROM admin_users 
  WHERE active = true;
  
  SELECT COUNT(DISTINCT user_id) INTO users_with_pieces 
  FROM pieces;
  
  SELECT COUNT(DISTINCT user_id) INTO users_with_subscriptions 
  FROM subscriptions 
  WHERE status = 'active';
  
  SELECT COUNT(*) INTO total_pieces FROM pieces;
  SELECT COUNT(*) INTO total_versions FROM piece_versions;
  
  SELECT COALESCE(SUM(est_price_ars), 0) INTO total_revenue FROM pieces;
  
  -- Build result JSON
  result := json_build_object(
    'total_users', total_users,
    'active_users', active_users,
    'inactive_users', inactive_users,
    'admin_users', admin_users,
    'users_with_pieces', users_with_pieces,
    'users_with_subscriptions', users_with_subscriptions,
    'total_pieces', total_pieces,
    'total_versions', total_versions,
    'total_revenue', total_revenue,
    'all_users', (
      SELECT json_agg(
        json_build_object(
          'user_id', user_id,
          'email', email,
          'registration_date', registration_date,
          'last_sign_in_at', last_sign_in_at,
          'current_status', current_status,
          'is_admin', is_admin,
          'piece_count', piece_count,
          'version_count', version_count,
          'activity_score', activity_score,
          'subscription_status', subscription_status,
          'plan_slug', plan_slug
        )
      )
      FROM admin_complete_users
    )
  );
  
  RETURN result;
END;
$$;

-- 4. Create function to get user details for admin
CREATE OR REPLACE FUNCTION get_admin_user_details(target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'user', row_to_json(u),
    'pieces', (
      SELECT json_agg(
        json_build_object(
          'id', p.id,
          'title', p.title,
          'created_at', p.created_at,
          'est_price_ars', p.est_price_ars,
          'version_count', (
            SELECT COUNT(*) FROM piece_versions pv WHERE pv.piece_id = p.id
          )
        )
      )
      FROM pieces p 
      WHERE p.user_id = target_user_id
      ORDER BY p.created_at DESC
      LIMIT 10
    ),
    'subscriptions', (
      SELECT json_agg(row_to_json(s))
      FROM subscriptions s
      WHERE s.user_id = target_user_id
      ORDER BY s.created_at DESC
    ),
    'payments', (
      SELECT json_agg(row_to_json(p))
      FROM payments p
      WHERE p.user_id = target_user_id
      ORDER BY p.created_at DESC
      LIMIT 5
    )
  ) INTO result
  FROM admin_complete_users u
  WHERE u.user_id = target_user_id;
  
  RETURN result;
END;
$$;

-- 5. Create function to safely get all registered users for admin
CREATE OR REPLACE FUNCTION get_all_users_for_admin()
RETURNS TABLE (
  id UUID,
  email TEXT,
  registration_date TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  current_status TEXT,
  is_admin BOOLEAN,
  piece_count BIGINT,
  version_count BIGINT,
  activity_score INTEGER,
  subscription_status TEXT,
  plan_slug TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.user_id,
    u.email,
    u.registration_date,
    u.last_sign_in_at,
    u.current_status,
    u.is_admin,
    u.piece_count,
    u.version_count,
    u.activity_score,
    u.subscription_status,
    u.plan_slug
  FROM admin_complete_users u
  ORDER BY u.registration_date DESC;
END;
$$;

-- 6. Grant necessary permissions
-- Grant SELECT on the views to authenticated users (admin will verify permissions in app)
GRANT SELECT ON admin_auth_users_view TO authenticated;
GRANT SELECT ON admin_complete_users TO authenticated;

-- Grant EXECUTE on the functions to authenticated users
GRANT EXECUTE ON FUNCTION get_comprehensive_admin_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_admin_user_details(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_users_for_admin() TO authenticated;

-- 7. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON admin_users(active);
CREATE INDEX IF NOT EXISTS idx_pieces_user_id ON pieces(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- 8. Add RLS policies for admin access
-- Enable RLS on admin tables if not already enabled
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Policy to allow admins to read all admin_users records
CREATE POLICY admin_users_admin_read ON admin_users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au 
      WHERE au.user_id = auth.uid() 
      AND au.active = true
    )
  );

-- Comments for documentation
COMMENT ON VIEW admin_auth_users_view IS 'Read-only view of auth.users for admin panel';
COMMENT ON VIEW admin_complete_users IS 'Comprehensive user data with stats for admin panel';
COMMENT ON FUNCTION get_comprehensive_admin_stats() IS 'Get complete admin dashboard statistics';
COMMENT ON FUNCTION get_admin_user_details(UUID) IS 'Get detailed user information for admin panel';
COMMENT ON FUNCTION get_all_users_for_admin() IS 'Safely get all registered users for admin panel';