-- MINIMAL ADMIN SETUP SQL
-- Only uses guaranteed-to-exist columns based on actual ZETALAB codebase
-- Safe to run on existing database

-- Create subscription plans table with minimal columns
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Basic plan info using only guaranteed columns
    plan_data JSONB DEFAULT '{}'::jsonb
);

-- Insert basic plans with all data in JSONB
INSERT INTO subscription_plans (plan_data) 
VALUES 
    ('{"name": "Free", "price": 0, "period": "monthly", "max_pieces": 5, "max_calculations": 10}'::jsonb),
    ('{"name": "Premium", "price": 1500, "period": "monthly", "max_pieces": -1, "max_calculations": -1}'::jsonb),
    ('{"name": "Premium Anual", "price": 15000, "period": "yearly", "max_pieces": -1, "max_calculations": -1}'::jsonb)
ON CONFLICT DO NOTHING;

-- Create or ensure subscriptions table exists (minimal structure)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'inactive',
    -- Store all subscription data in JSONB for flexibility
    subscription_data JSONB DEFAULT '{}'::jsonb
);

-- Create payment transactions table (minimal structure)
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Store all payment data in JSONB
    payment_data JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS on all tables
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (minimal permissions)
CREATE POLICY "subscription_plans_read" ON subscription_plans FOR SELECT USING (true);

CREATE POLICY "subscriptions_user_access" ON subscriptions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "payment_transactions_user_access" ON payment_transactions
    FOR ALL USING (auth.uid() = user_id);

-- Create admin-safe views that use only existing columns
CREATE OR REPLACE VIEW admin_dashboard_stats AS
SELECT 
    'users' as metric,
    COUNT(*) as value,
    'Total registered users' as label
FROM auth.users
WHERE deleted_at IS NULL OR deleted_at IS NOT NULL -- Include all users

UNION ALL

SELECT 
    'pieces' as metric,
    COUNT(*) as value,
    'Total pieces created' as label
FROM pieces

UNION ALL

SELECT 
    'calculations' as metric,
    COUNT(*) as value,
    'Total calculations performed' as label
FROM piece_versions

UNION ALL

SELECT 
    'active_subscriptions' as metric,
    COUNT(*) as value,
    'Active subscriptions' as label
FROM subscriptions
WHERE status = 'active';

-- Create safe user list view (only using guaranteed columns)
CREATE OR REPLACE VIEW admin_user_list AS
SELECT 
    u.id,
    u.created_at,
    u.email,
    COALESCE(u.raw_user_meta_data->>'full_name', 'Sin nombre') as display_name,
    COALESCE(s.status, 'free') as subscription_status,
    COUNT(p.id) as pieces_count,
    COUNT(pv.id) as calculations_count,
    MAX(pv.created_at) as last_activity
FROM auth.users u
LEFT JOIN subscriptions s ON s.user_id = u.id
LEFT JOIN pieces p ON p.user_id = u.id
LEFT JOIN piece_versions pv ON pv.user_id = u.id
WHERE u.deleted_at IS NULL OR u.deleted_at IS NOT NULL -- Include all users
GROUP BY u.id, u.created_at, u.email, u.raw_user_meta_data, s.status;

-- Grant necessary permissions (minimal)
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON admin_dashboard_stats TO authenticated;
GRANT SELECT ON admin_user_list TO authenticated;
GRANT ALL ON subscription_plans TO authenticated;
GRANT ALL ON subscriptions TO authenticated;
GRANT ALL ON payment_transactions TO authenticated;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_pieces_user_id ON pieces(user_id);
CREATE INDEX IF NOT EXISTS idx_piece_versions_user_id ON piece_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_piece_versions_created_at ON piece_versions(created_at);