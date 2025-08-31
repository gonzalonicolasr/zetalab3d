-- ========================================
-- Create Admin User for gonn.nicolas@gmail.com
-- Run this AFTER the user has registered normally in the app
-- ========================================

-- Create admin user using the helper function
SELECT public.create_admin_user(
  'gonn.nicolas@gmail.com',
  'super_admin',
  '{"users":true,"subscriptions":true,"analytics":true,"admin_management":true}',
  'Initial super admin user - created during setup'
);

-- Verify the admin user was created
SELECT 
  id,
  user_id,
  email,
  role,
  permissions,
  active,
  created_at
FROM public.admin_users 
WHERE email = 'gonn.nicolas@gmail.com';

-- Also verify the corresponding auth.users record exists
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users 
WHERE email = 'gonn.nicolas@gmail.com';