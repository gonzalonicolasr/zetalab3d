# ZETALAB Admin SQL Troubleshooting Guide

## The Error You Encountered

**Error**: `42P16: cannot change name of view column "last_sign_in_at" to "updated_at"`

### Root Cause
This error occurs when using `CREATE OR REPLACE VIEW` and trying to change column names. PostgreSQL doesn't allow column renaming in view replacements - you can only change the underlying query logic, not the column names/types.

### What Happened
In the original `sql-setup.sql`, line 10 had:
```sql
u.updated_at,  -- This was the problem
```

But the `auth.users` table in Supabase doesn't have an `updated_at` column by default. The attempt to alias or reference a non-existent column caused the conflict.

## Solutions Provided

### 1. Complete Fix (`sql-setup-fixed.sql`)
- ✅ Drops existing views first with `CASCADE`
- ✅ Uses correct column names (`user_created_at` instead of `updated_at`)
- ✅ Handles missing optional tables (`subscriptions`, `payment_transactions`)
- ✅ Includes proper admin authentication checks
- ✅ Creates admin_actions logging table with RLS
- ✅ Comprehensive error handling

### 2. Minimal Safe Version (`sql-setup-minimal.sql`)
- ✅ Works with basic ZETALAB schema only
- ✅ No dependencies on optional tables
- ✅ Core admin functionality only
- ✅ Guaranteed to work on fresh Supabase projects

## How to Use These Scripts

### Option A: Full Setup (Recommended)
```sql
-- Run in Supabase SQL Editor
\i sql-setup-fixed.sql
```

### Option B: Minimal Setup (If you get errors)
```sql
-- Run in Supabase SQL Editor  
\i sql-setup-minimal.sql
```

### Option C: Step by Step (If both fail)
1. First, check what tables exist:
```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('pieces', 'piece_versions', 'subscriptions', 'payment_transactions');
```

2. Check auth.users columns:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'auth' 
AND table_name = 'users';
```

3. Run appropriate script based on what exists.

## Common Supabase Auth Schema

The `auth.users` table typically has these columns:
- `id` (uuid)
- `email` (text)
- `created_at` (timestamp)
- `last_sign_in_at` (timestamp) 
- `email_confirmed_at` (timestamp)
- `phone` (text)
- `role` (text)
- `banned_until` (timestamp)

**Note**: No `updated_at` by default!

## Prevention Tips

1. **Always use `DROP VIEW IF EXISTS ... CASCADE`** before creating views
2. **Check actual table schema** before referencing columns
3. **Use aliases for clarity**: `u.created_at as user_created_at`
4. **Handle optional tables** with `LEFT JOIN` and `COALESCE()`
5. **Test queries separately** before combining into views

## Admin Dashboard Requirements

After running the SQL setup, you'll have:

### Views Available:
- `admin_users_view` - Main user listing with statistics
- `admin_user_activity_log` - Activity feed for all users  
- `admin_user_summary` - Detailed user info for modals

### Functions Available:
- `admin_suspend_user(user_id, until_date)` - Suspend/unsuspend users
- `admin_delete_user(user_id)` - Soft delete users
- `admin_send_welcome_email(user_id)` - Queue welcome emails
- `is_admin()` - Check if current user is admin

### Admin Access Control:
```javascript
// In your frontend, check admin status:
const { data: isAdmin } = await supabase.rpc('is_admin');
if (!isAdmin) {
    // Redirect or show access denied
}
```

## Next Steps

1. ✅ Run one of the SQL scripts
2. ✅ Test views in Supabase SQL Editor:
   ```sql
   SELECT * FROM admin_users_view LIMIT 5;
   SELECT * FROM admin_user_activity_log LIMIT 10;
   ```
3. ✅ Update your admin dashboard JavaScript to use these views
4. ✅ Set a user's role to 'admin' for testing:
   ```sql
   UPDATE auth.users SET role = 'admin' WHERE email = 'your-email@domain.com';
   ```

## Support

If you still encounter errors:
1. Copy the exact error message
2. Run the diagnostic queries above  
3. Check which version of the script matches your schema
4. Consider the minimal version as a fallback