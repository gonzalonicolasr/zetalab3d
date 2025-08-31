-- ========================================
-- ZETALAB Admin Management Database Setup (Simplified)
-- Execute in Supabase SQL Editor
-- ========================================

-- 1. Create admin_users table
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(20) DEFAULT 'admin' NOT NULL CHECK (role IN ('admin', 'super_admin')),
  permissions JSONB DEFAULT '{"users":true,"subscriptions":true,"analytics":true}' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_by UUID REFERENCES public.admin_users(id),
  last_login_at TIMESTAMP WITH TIME ZONE,
  active BOOLEAN DEFAULT true NOT NULL,
  notes TEXT
);

-- 2. Create admin_sessions table (for audit trail)
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES public.admin_users(id) ON DELETE CASCADE NOT NULL,
  login_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  logout_at TIMESTAMP WITH TIME ZONE,
  ip_address INET,
  user_agent TEXT,
  session_duration_minutes INTEGER
);

-- 3. Create admin_activity_log table (for actions audit)
CREATE TABLE IF NOT EXISTS public.admin_activity_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES public.admin_users(id) ON DELETE CASCADE NOT NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL, -- 'user', 'subscription', 'admin', etc.
  resource_id UUID,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON public.admin_users(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_active ON public.admin_users(active);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON public.admin_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_login_at ON public.admin_sessions(login_at);
CREATE INDEX IF NOT EXISTS idx_admin_activity_admin_id ON public.admin_activity_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_created_at ON public.admin_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_activity_action ON public.admin_activity_log(action);

-- 5. Enable RLS (Row Level Security)
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for admin_users
-- Admins can view all admin users
CREATE POLICY "Admins can view all admin users" ON public.admin_users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au 
      WHERE au.user_id = auth.uid() AND au.active = true
    )
  );

-- Super admins can insert new admin users
CREATE POLICY "Super admins can insert admin users" ON public.admin_users
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users au 
      WHERE au.user_id = auth.uid() AND au.role = 'super_admin' AND au.active = true
    )
  );

-- Super admins can update admin users
CREATE POLICY "Super admins can update admin users" ON public.admin_users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au 
      WHERE au.user_id = auth.uid() AND au.role = 'super_admin' AND au.active = true
    )
  );

-- 7. RLS Policies for admin_sessions
CREATE POLICY "Admins can view their own sessions" ON public.admin_sessions
  FOR SELECT USING (
    admin_id IN (
      SELECT id FROM public.admin_users 
      WHERE user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "System can insert admin sessions" ON public.admin_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can update their own sessions" ON public.admin_sessions
  FOR UPDATE USING (
    admin_id IN (
      SELECT id FROM public.admin_users 
      WHERE user_id = auth.uid() AND active = true
    )
  );

-- 8. RLS Policies for admin_activity_log
CREATE POLICY "Admins can view activity logs" ON public.admin_activity_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au 
      WHERE au.user_id = auth.uid() AND au.active = true
    )
  );

CREATE POLICY "System can insert activity logs" ON public.admin_activity_log
  FOR INSERT WITH CHECK (true);

-- 9. Create function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users 
    WHERE user_id = user_uuid AND active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Create function to check admin permissions
CREATE OR REPLACE FUNCTION public.admin_has_permission(
  permission_key TEXT, 
  user_uuid UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN AS $$
DECLARE
  admin_perms JSONB;
BEGIN
  SELECT permissions INTO admin_perms
  FROM public.admin_users 
  WHERE user_id = user_uuid AND active = true;
  
  IF admin_perms IS NULL THEN
    RETURN FALSE;
  END IF;
  
  RETURN COALESCE((admin_perms ->> permission_key)::BOOLEAN, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Create function to log admin activity
CREATE OR REPLACE FUNCTION public.log_admin_activity(
  action_name TEXT,
  resource_type_name TEXT,
  resource_uuid UUID DEFAULT NULL,
  details_json JSONB DEFAULT NULL,
  user_ip INET DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  admin_uuid UUID;
  log_id UUID;
BEGIN
  -- Get admin ID from user_id
  SELECT id INTO admin_uuid
  FROM public.admin_users 
  WHERE user_id = auth.uid() AND active = true;
  
  IF admin_uuid IS NULL THEN
    RAISE EXCEPTION 'User is not an active admin';
  END IF;
  
  -- Insert activity log
  INSERT INTO public.admin_activity_log (
    admin_id, action, resource_type, resource_id, details, ip_address
  ) VALUES (
    admin_uuid, action_name, resource_type_name, resource_uuid, details_json, user_ip
  ) RETURNING id INTO log_id;
  
  RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Allow admins to view all pieces (existing table)
DROP POLICY IF EXISTS "Admins can view all pieces" ON public.pieces;
CREATE POLICY "Admins can view all pieces" ON public.pieces
  FOR SELECT USING (public.is_admin() OR auth.uid() = user_id);

-- 13. Allow admins to view all piece versions (existing table) 
DROP POLICY IF EXISTS "Admins can view all piece versions" ON public.piece_versions;
CREATE POLICY "Admins can view all piece versions" ON public.piece_versions
  FOR SELECT USING (
    public.is_admin() OR 
    EXISTS (SELECT 1 FROM public.pieces WHERE pieces.id = piece_versions.piece_id AND pieces.user_id = auth.uid())
  );

-- 14. Add comments for documentation
COMMENT ON TABLE public.admin_users IS 'Admin users with role-based permissions for ZETALAB admin panel';
COMMENT ON TABLE public.admin_sessions IS 'Admin login sessions for security audit trail';
COMMENT ON TABLE public.admin_activity_log IS 'Log of all admin actions for compliance and auditing';

COMMENT ON COLUMN public.admin_users.role IS 'Admin role: admin (basic) or super_admin (full access)';
COMMENT ON COLUMN public.admin_users.permissions IS 'JSON object with permission flags for different admin features';
COMMENT ON COLUMN public.admin_users.active IS 'Whether admin account is active (soft delete)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ ZETALAB Admin Management setup completed successfully!';
  RAISE NOTICE '📧 Ready to create admin user for: gonn.nicolas@gmail.com';
  RAISE NOTICE '🔐 First register the user in your app, then run create-admin-user.sql';
  RAISE NOTICE '🚀 Admin panel is now ready to use with database-driven authentication';
END $$;