# ZETALAB Admin Database Setup Guide

## Overview
This guide walks you through setting up database-driven admin management for ZETALAB, replacing the hardcoded email domain verification with a proper admin user system stored in Supabase.

## Prerequisites
- ✅ Supabase project set up and configured
- ✅ Admin user (gonn.nicolas@gmail.com) already registered in the main ZETALAB app
- ✅ Access to Supabase SQL Editor

## Step 1: Run Database Setup

### Execute the Main Setup Script
1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `admin-setup.sql`
3. Click "Run" to execute

This will create:
- `admin_users` table with roles and permissions
- `admin_sessions` table for login tracking  
- `admin_activity_log` table for audit trail
- All necessary RLS policies and functions
- Indexes for performance

### Expected Output
```
✅ ZETALAB Admin Management setup completed successfully!
📧 Initial admin user will be created for: gonn.nicolas@gmail.com  
🔐 Make sure the user has registered in the app before running this script
🚀 Admin panel is now ready to use with database-driven authentication
```

## Step 2: Create Initial Admin User

### Execute Admin User Creation
1. In Supabase SQL Editor, run the contents of `create-admin-user.sql`
2. This will create the admin user for gonn.nicolas@gmail.com

### Expected Output
```
==========================================
🚀 ADMIN USER SETUP COMPLETE!
==========================================

✅ Admin user: gonn.nicolas@gmail.com
🔑 Password: cocacola (use existing app credentials)
🎯 Role: super_admin
🛡️ Permissions: All admin features enabled
```

## Step 3: Verify Setup

### Test Admin Login
1. Navigate to your ZETALAB app admin panel: `/admin/`
2. Login with:
   - **Email**: gonn.nicolas@gmail.com  
   - **Password**: cocacola (or existing password from main app)
3. Should successfully authenticate and show admin dashboard

### Verify Database Records
Check that admin user was created:
```sql
SELECT 
    email,
    role,
    active,
    permissions,
    created_at
FROM public.admin_users 
WHERE email = 'gonn.nicolas@gmail.com';
```

## Database Schema

### Admin Users Table
```sql
admin_users:
- id (UUID, primary key)
- user_id (UUID, references auth.users)
- email (VARCHAR, unique)  
- role (VARCHAR: 'admin' | 'super_admin')
- permissions (JSONB)
- active (BOOLEAN)
- created_at (TIMESTAMP)
- last_login_at (TIMESTAMP)
- notes (TEXT)
```

### Admin Sessions Table  
```sql
admin_sessions:
- id (UUID, primary key)
- admin_id (UUID, references admin_users)
- login_at (TIMESTAMP)
- logout_at (TIMESTAMP)
- ip_address (INET)
- user_agent (TEXT)
```

### Admin Activity Log
```sql
admin_activity_log:
- id (UUID, primary key)
- admin_id (UUID, references admin_users)
- action (VARCHAR)
- resource_type (VARCHAR)
- resource_id (UUID)
- details (JSONB)
- created_at (TIMESTAMP)
```

## Permissions System

### Admin Roles
- **admin**: Basic admin access to users, subscriptions, analytics
- **super_admin**: Full access including admin management

### Permission Types
```json
{
  "users": true,              // User management
  "subscriptions": true,      // Subscription management  
  "analytics": true,          // Analytics dashboard
  "admin_management": true    // Manage other admins (super_admin only)
}
```

## Adding New Admin Users

### Option 1: Through Admin Panel
1. Login as super_admin
2. Navigate to Admin Management section
3. Click "Add Admin" 
4. Fill form with email, role, permissions
5. Submit (user must already be registered in main app)

### Option 2: Through SQL
```sql
-- First ensure user is registered in main app, then:
INSERT INTO public.admin_users (
    user_id,
    email, 
    role,
    permissions,
    notes
) VALUES (
    (SELECT id FROM auth.users WHERE email = 'new-admin@example.com'),
    'new-admin@example.com',
    'admin',  -- or 'super_admin'
    '{"users":true,"subscriptions":true,"analytics":true}',
    'Added manually via SQL'
);
```

## Security Features

### Row Level Security (RLS)
- ✅ All admin tables protected with RLS
- ✅ Admins can only see appropriate records
- ✅ Super admins can manage other admins

### Activity Logging
- ✅ All admin actions automatically logged
- ✅ Login/logout sessions tracked
- ✅ Audit trail for compliance

### Database Functions
- `is_admin(user_uuid)` - Check if user is admin
- `admin_has_permission(permission, user_uuid)` - Check specific permission
- `log_admin_activity(...)` - Log admin actions

## Migration from Hardcoded System

The new system automatically replaces:
- ❌ `ADMIN_DOMAINS` array (deprecated)  
- ❌ `ADMIN_USER_IDS` array (deprecated)
- ✅ Database-driven admin verification
- ✅ Role-based permissions
- ✅ Activity logging and session tracking

## Troubleshooting

### Admin User Can't Login
1. Verify user exists in auth.users: 
   ```sql
   SELECT * FROM auth.users WHERE email = 'admin@example.com';
   ```

2. Verify admin record exists:
   ```sql 
   SELECT * FROM admin_users WHERE email = 'admin@example.com';
   ```

3. Check if admin is active:
   ```sql
   UPDATE admin_users SET active = true WHERE email = 'admin@example.com';
   ```

### Permission Issues
1. Check admin permissions:
   ```sql
   SELECT permissions FROM admin_users WHERE email = 'admin@example.com';
   ```

2. Update permissions:
   ```sql
   UPDATE admin_users 
   SET permissions = '{"users":true,"subscriptions":true,"analytics":true}'
   WHERE email = 'admin@example.com';
   ```

### Reset Admin Password
```sql
-- Send password reset email
SELECT auth.send_recovery_email('admin@example.com');
```

## Backup & Recovery

### Backup Admin Data
```sql
-- Export admin users
COPY (SELECT * FROM admin_users) TO '/backup/admin_users.csv' CSV HEADER;

-- Export admin activity log  
COPY (SELECT * FROM admin_activity_log) TO '/backup/admin_activity.csv' CSV HEADER;
```

### Emergency Admin Access
If locked out, create emergency admin:
```sql
-- Create emergency admin (requires service_role key)
INSERT INTO admin_users (user_id, email, role, permissions, notes)
VALUES (
    (SELECT id FROM auth.users WHERE email = 'emergency@zetalab.com'),
    'emergency@zetalab.com', 
    'super_admin',
    '{"users":true,"subscriptions":true,"analytics":true,"admin_management":true}',
    'Emergency admin access'
);
```

## Success Checklist

- [ ] Database setup script executed successfully
- [ ] Initial admin user created (gonn.nicolas@gmail.com)
- [ ] Admin can login to admin panel
- [ ] Admin can view users, subscriptions, analytics
- [ ] Super admin can manage other admins
- [ ] Activity logging working
- [ ] No hardcoded domains in use

---

🎉 **Congratulations!** Your ZETALAB admin system is now fully database-driven with proper role-based access control and audit logging.