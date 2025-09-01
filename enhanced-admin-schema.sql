-- ============================================
-- ENHANCED ADMIN DASHBOARD DATABASE SCHEMA
-- Comprehensive subscription and payment management
-- ============================================

-- ============================================
-- SUBSCRIPTION MANAGEMENT ENHANCEMENTS
-- ============================================

-- Enhanced subscription table with more detailed tracking
CREATE TABLE IF NOT EXISTS subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  billing_period VARCHAR(20) NOT NULL, -- 'monthly', 'yearly', 'lifetime'
  features JSONB DEFAULT '[]'::jsonb,
  max_pieces INTEGER,
  max_calculations_per_day INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default plans
INSERT INTO subscription_plans (name, description, price, billing_period, max_pieces, max_calculations_per_day)
VALUES 
  ('Free Trial', 'Trial gratuito por 7 días', 0.00, 'trial', 5, 10),
  ('Basic', 'Plan básico mensual', 9.99, 'monthly', 50, 100),
  ('Premium', 'Plan premium mensual', 19.99, 'monthly', -1, -1),
  ('Premium Annual', 'Plan premium anual', 199.99, 'yearly', -1, -1)
ON CONFLICT DO NOTHING;

-- Enhanced subscriptions table
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES subscription_plans(id);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_provider VARCHAR(50);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS auto_renewal BOOLEAN DEFAULT true;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_end TIMESTAMP WITH TIME ZONE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- ============================================
-- PAYMENT MANAGEMENT SYSTEM
-- ============================================

-- Detailed payment transactions table
CREATE TABLE IF NOT EXISTS payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  subscription_id UUID REFERENCES subscriptions(id),
  transaction_id VARCHAR(255), -- External payment provider ID
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50) NOT NULL, -- 'pending', 'completed', 'failed', 'refunded', 'cancelled'
  payment_method VARCHAR(50), -- 'credit_card', 'paypal', 'stripe', etc.
  payment_provider VARCHAR(50), -- 'stripe', 'paypal', 'mercadopago'
  provider_fee DECIMAL(10,2) DEFAULT 0,
  net_amount DECIMAL(10,2),
  failure_reason TEXT,
  refund_reason TEXT,
  refunded_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment methods table for user saved payment methods
CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  provider_method_id VARCHAR(255), -- External provider ID
  type VARCHAR(50) NOT NULL, -- 'card', 'paypal', 'bank'
  brand VARCHAR(50), -- 'visa', 'mastercard', etc.
  last_four VARCHAR(4),
  expiry_month INTEGER,
  expiry_year INTEGER,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ADMIN AUDIT TRAIL SYSTEM
-- ============================================

-- Audit log for all admin actions
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  action_type VARCHAR(100) NOT NULL,
  target_table VARCHAR(100),
  target_id UUID,
  old_values JSONB,
  new_values JSONB,
  description TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ENHANCED ADMIN VIEWS
-- ============================================

-- Complete subscription management view
CREATE OR REPLACE VIEW admin_subscriptions_view AS
SELECT 
  s.id as subscription_id,
  s.user_id,
  u.email as user_email,
  COALESCE(u.user_metadata->>'name', 'N/A') as user_name,
  sp.name as plan_name,
  sp.price as plan_price,
  sp.billing_period,
  s.status,
  s.type,
  s.amount,
  s.current_period_start,
  s.current_period_end,
  s.expires_at,
  s.trial_end,
  s.auto_renewal,
  s.payment_method,
  s.payment_provider,
  s.cancellation_reason,
  s.cancelled_at,
  s.created_at as subscription_created,
  s.updated_at as subscription_updated,
  -- Calculated fields
  CASE 
    WHEN s.trial_end IS NOT NULL AND s.trial_end > NOW() THEN 'trial'
    WHEN s.expires_at < NOW() THEN 'expired'
    WHEN s.status = 'cancelled' THEN 'cancelled'
    WHEN s.status = 'active' AND s.current_period_end > NOW() THEN 'active'
    ELSE s.status
  END as computed_status,
  EXTRACT(days FROM (COALESCE(s.expires_at, s.current_period_end) - NOW())) as days_until_expiry,
  -- Payment info
  COALESCE(latest_payment.amount, 0) as last_payment_amount,
  latest_payment.status as last_payment_status,
  latest_payment.created_at as last_payment_date,
  COALESCE(failed_payments.count, 0) as failed_payment_count,
  -- Usage stats
  COALESCE(piece_stats.piece_count, 0) as user_piece_count,
  COALESCE(calc_stats.calc_count, 0) as user_calculation_count
FROM subscriptions s
LEFT JOIN auth.users u ON s.user_id = u.id
LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
LEFT JOIN LATERAL (
  SELECT amount, status, created_at
  FROM payment_transactions pt
  WHERE pt.subscription_id = s.id
  ORDER BY created_at DESC
  LIMIT 1
) latest_payment ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) as count
  FROM payment_transactions pt
  WHERE pt.subscription_id = s.id 
    AND pt.status = 'failed'
    AND pt.created_at > NOW() - INTERVAL '30 days'
) failed_payments ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) as piece_count
  FROM pieces p
  WHERE p.user_id = s.user_id
) piece_stats ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) as calc_count
  FROM piece_versions pv
  JOIN pieces p ON pv.piece_id = p.id
  WHERE p.user_id = s.user_id
    AND pv.created_at > NOW() - INTERVAL '30 days'
) calc_stats ON true;

-- Complete payment transactions view
CREATE OR REPLACE VIEW admin_payments_view AS
SELECT 
  pt.id as payment_id,
  pt.user_id,
  u.email as user_email,
  COALESCE(u.user_metadata->>'name', 'N/A') as user_name,
  pt.subscription_id,
  s.type as subscription_type,
  pt.transaction_id,
  pt.amount,
  pt.currency,
  pt.net_amount,
  pt.provider_fee,
  pt.status,
  pt.payment_method,
  pt.payment_provider,
  pt.failure_reason,
  pt.refund_reason,
  pt.refunded_at,
  pt.created_at as payment_date,
  pt.updated_at as last_updated,
  -- Calculated fields
  CASE 
    WHEN pt.status = 'completed' THEN 'success'
    WHEN pt.status = 'failed' THEN 'failed'
    WHEN pt.status = 'pending' THEN 'processing'
    WHEN pt.status = 'refunded' THEN 'refunded'
    ELSE pt.status
  END as display_status,
  EXTRACT(days FROM (NOW() - pt.created_at)) as days_ago
FROM payment_transactions pt
LEFT JOIN auth.users u ON pt.user_id = u.id
LEFT JOIN subscriptions s ON pt.subscription_id = s.id
ORDER BY pt.created_at DESC;

-- Revenue analytics view
CREATE OR REPLACE VIEW admin_revenue_view AS
SELECT 
  DATE_TRUNC('day', pt.created_at) as date,
  COUNT(*) as transaction_count,
  COUNT(DISTINCT pt.user_id) as unique_payers,
  SUM(CASE WHEN pt.status = 'completed' THEN pt.amount ELSE 0 END) as gross_revenue,
  SUM(CASE WHEN pt.status = 'completed' THEN pt.net_amount ELSE 0 END) as net_revenue,
  SUM(CASE WHEN pt.status = 'completed' THEN pt.provider_fee ELSE 0 END) as total_fees,
  SUM(CASE WHEN pt.status = 'failed' THEN pt.amount ELSE 0 END) as failed_revenue,
  COUNT(CASE WHEN pt.status = 'completed' THEN 1 END) as successful_payments,
  COUNT(CASE WHEN pt.status = 'failed' THEN 1 END) as failed_payments,
  ROUND(
    COUNT(CASE WHEN pt.status = 'completed' THEN 1 END)::numeric / 
    NULLIF(COUNT(*)::numeric, 0) * 100, 2
  ) as success_rate
FROM payment_transactions pt
WHERE pt.created_at > NOW() - INTERVAL '90 days'
GROUP BY DATE_TRUNC('day', pt.created_at)
ORDER BY date DESC;

-- Subscription analytics view
CREATE OR REPLACE VIEW admin_subscription_analytics AS
SELECT 
  -- Current metrics
  COUNT(CASE WHEN computed_status = 'active' THEN 1 END) as active_subscriptions,
  COUNT(CASE WHEN computed_status = 'trial' THEN 1 END) as trial_subscriptions,
  COUNT(CASE WHEN computed_status = 'expired' THEN 1 END) as expired_subscriptions,
  COUNT(CASE WHEN computed_status = 'cancelled' THEN 1 END) as cancelled_subscriptions,
  
  -- Revenue metrics
  SUM(CASE WHEN computed_status = 'active' THEN plan_price ELSE 0 END) as monthly_recurring_revenue,
  AVG(CASE WHEN computed_status = 'active' THEN plan_price END) as average_revenue_per_user,
  
  -- Upcoming renewals
  COUNT(CASE WHEN computed_status = 'active' AND days_until_expiry <= 7 THEN 1 END) as renewals_next_7_days,
  COUNT(CASE WHEN computed_status = 'active' AND days_until_expiry <= 30 THEN 1 END) as renewals_next_30_days,
  
  -- Payment issues
  SUM(failed_payment_count) as total_failed_payments,
  COUNT(CASE WHEN failed_payment_count > 0 THEN 1 END) as users_with_payment_issues
FROM admin_subscriptions_view;

-- ============================================
-- ADMIN FUNCTIONS
-- ============================================

-- Function to update subscription details
CREATE OR REPLACE FUNCTION admin_update_subscription(
  p_subscription_id UUID,
  p_admin_user_id UUID,
  p_updates JSONB,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old_record JSONB;
  result JSONB;
BEGIN
  -- Get current subscription data
  SELECT to_jsonb(s.*) INTO old_record
  FROM subscriptions s
  WHERE s.id = p_subscription_id;
  
  IF old_record IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Subscription not found');
  END IF;
  
  -- Update subscription
  UPDATE subscriptions SET
    status = COALESCE((p_updates->>'status')::VARCHAR, status),
    expires_at = COALESCE((p_updates->>'expires_at')::TIMESTAMP WITH TIME ZONE, expires_at),
    current_period_end = COALESCE((p_updates->>'current_period_end')::TIMESTAMP WITH TIME ZONE, current_period_end),
    amount = COALESCE((p_updates->>'amount')::DECIMAL, amount),
    auto_renewal = COALESCE((p_updates->>'auto_renewal')::BOOLEAN, auto_renewal),
    cancellation_reason = COALESCE(p_updates->>'cancellation_reason', cancellation_reason),
    cancelled_at = CASE 
      WHEN p_updates->>'status' = 'cancelled' AND cancelled_at IS NULL THEN NOW()
      ELSE cancelled_at
    END,
    updated_at = NOW(),
    metadata = COALESCE(p_updates->'metadata', metadata)
  WHERE id = p_subscription_id;
  
  -- Log the change
  INSERT INTO admin_audit_log (
    admin_user_id,
    action_type,
    target_table,
    target_id,
    old_values,
    new_values,
    description
  ) VALUES (
    p_admin_user_id,
    'subscription_update',
    'subscriptions',
    p_subscription_id,
    old_record,
    p_updates,
    COALESCE(p_reason, 'Admin subscription update')
  );
  
  RETURN jsonb_build_object('success', true, 'message', 'Subscription updated successfully');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function to process refund
CREATE OR REPLACE FUNCTION admin_process_refund(
  p_payment_id UUID,
  p_admin_user_id UUID,
  p_refund_amount DECIMAL DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  payment_record RECORD;
  refund_amount DECIMAL;
BEGIN
  -- Get payment details
  SELECT * INTO payment_record
  FROM payment_transactions
  WHERE id = p_payment_id AND status = 'completed';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Payment not found or not completed');
  END IF;
  
  -- Determine refund amount
  refund_amount := COALESCE(p_refund_amount, payment_record.amount);
  
  IF refund_amount > payment_record.amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Refund amount cannot exceed original payment');
  END IF;
  
  -- Update payment record
  UPDATE payment_transactions SET
    status = CASE WHEN refund_amount = amount THEN 'refunded' ELSE 'partially_refunded' END,
    refund_reason = p_reason,
    refunded_at = NOW(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'refund_amount', refund_amount,
      'refunded_by', p_admin_user_id
    )
  WHERE id = p_payment_id;
  
  -- Log the refund
  INSERT INTO admin_audit_log (
    admin_user_id,
    action_type,
    target_table,
    target_id,
    new_values,
    description
  ) VALUES (
    p_admin_user_id,
    'payment_refund',
    'payment_transactions',
    p_payment_id,
    jsonb_build_object('refund_amount', refund_amount, 'reason', p_reason),
    format('Refund processed: $%s for payment %s', refund_amount, p_payment_id)
  );
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', format('Refund of $%s processed successfully', refund_amount),
    'refund_amount', refund_amount
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Function to assign subscription to user
CREATE OR REPLACE FUNCTION admin_assign_subscription(
  p_user_id UUID,
  p_plan_id UUID,
  p_admin_user_id UUID,
  p_duration_months INTEGER DEFAULT 1,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  plan_record RECORD;
  new_subscription_id UUID;
BEGIN
  -- Get plan details
  SELECT * INTO plan_record
  FROM subscription_plans
  WHERE id = p_plan_id AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Plan not found or inactive');
  END IF;
  
  -- Check if user already has active subscription
  IF EXISTS (
    SELECT 1 FROM subscriptions 
    WHERE user_id = p_user_id AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User already has active subscription');
  END IF;
  
  -- Create new subscription
  INSERT INTO subscriptions (
    user_id,
    plan_id,
    status,
    type,
    amount,
    current_period_start,
    current_period_end,
    expires_at,
    metadata
  ) VALUES (
    p_user_id,
    p_plan_id,
    'active',
    plan_record.billing_period,
    plan_record.price,
    NOW(),
    NOW() + INTERVAL '1 month' * p_duration_months,
    NOW() + INTERVAL '1 month' * p_duration_months,
    jsonb_build_object('assigned_by_admin', p_admin_user_id, 'reason', p_reason)
  ) RETURNING id INTO new_subscription_id;
  
  -- Log the assignment
  INSERT INTO admin_audit_log (
    admin_user_id,
    action_type,
    target_table,
    target_id,
    new_values,
    description
  ) VALUES (
    p_admin_user_id,
    'subscription_assign',
    'subscriptions',
    new_subscription_id,
    jsonb_build_object(
      'user_id', p_user_id,
      'plan_id', p_plan_id,
      'duration_months', p_duration_months
    ),
    COALESCE(p_reason, 'Admin assigned subscription')
  );
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Subscription assigned successfully',
    'subscription_id', new_subscription_id
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================
-- PERMISSIONS AND SECURITY
-- ============================================

-- Grant permissions to authenticated role
GRANT SELECT ON admin_subscriptions_view TO authenticated;
GRANT SELECT ON admin_payments_view TO authenticated;
GRANT SELECT ON admin_revenue_view TO authenticated;
GRANT SELECT ON admin_subscription_analytics TO authenticated;

-- Grant admin functions to service role only
GRANT EXECUTE ON FUNCTION admin_update_subscription TO service_role;
GRANT EXECUTE ON FUNCTION admin_process_refund TO service_role;
GRANT EXECUTE ON FUNCTION admin_assign_subscription TO service_role;

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at ON subscriptions(expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_status ON payment_transactions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_subscription ON payment_transactions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_created_status ON payment_transactions(created_at DESC, status);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_created ON admin_audit_log(admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target ON admin_audit_log(target_table, target_id);