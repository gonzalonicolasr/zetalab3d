-- ZETALAB Admin User Setup
-- Execute this SQL in Supabase SQL Editor if the automated process fails

-- Step 1: Verify that the user exists in auth.users
SELECT id, email, email_confirmed_at, created_at
FROM auth.users 
WHERE email = 'gonn.nicolas@gmail.com';

-- Step 2: Insert user into admin_users table (if not already exists)
INSERT INTO admin_users (id, email, role, is_active, created_at, updated_at)
SELECT 
    id,
    email,
    'super_admin' as role,
    true as is_active,
    now() as created_at,
    now() as updated_at
FROM auth.users 
WHERE email = 'gonn.nicolas@gmail.com'
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active,
    updated_at = now();

-- Step 3: Verify admin user was created successfully
SELECT au.id, au.email, au.role, au.is_active, au.created_at,
       u.email_confirmed_at as auth_confirmed
FROM admin_users au 
JOIN auth.users u ON au.id = u.id 
WHERE au.email = 'gonn.nicolas@gmail.com';

-- Step 4: Create initial admin session (optional - will be created on first login)
-- This is automatically handled by the admin login system

-- Step 5: Verify RLS policies allow admin operations
-- Check that RLS is enabled and policies exist
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('admin_users', 'admin_sessions', 'admin_actions')
ORDER BY tablename, policyname;

-- Expected result: You should see the user with super_admin role and is_active = true
-- If the user doesn't appear, check that the email exists in auth.users first