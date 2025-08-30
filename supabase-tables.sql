-- Script SQL para crear las tablas de suscripciones en Supabase
-- Ejecutar estos comandos en el SQL Editor de Supabase

-- Tabla de suscripciones
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('monthly', 'yearly', 'trial', 'premium')),
  active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  payment_id VARCHAR(100),
  payment_status VARCHAR(20),
  amount DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'ARS'
);

-- Tabla de pagos (historial completo)
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  payment_id VARCHAR(100) NOT NULL UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'ARS' NOT NULL,
  status VARCHAR(20) NOT NULL,
  plan_type VARCHAR(20) NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  external_reference VARCHAR(200),
  payment_method VARCHAR(50)
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON public.subscriptions(active);
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires_at ON public.subscriptions(expires_at);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_id ON public.payments(payment_id);

-- RLS (Row Level Security) para suscripciones
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Política para que los usuarios solo vean sus propias suscripciones
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Política para insertar suscripciones (solo backend con service_role)
CREATE POLICY "Service role can insert subscriptions" ON public.subscriptions
  FOR INSERT WITH CHECK (true);

-- Política para actualizar suscripciones (solo backend con service_role)  
CREATE POLICY "Service role can update subscriptions" ON public.subscriptions
  FOR UPDATE USING (true);

-- RLS para pagos
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Política para que los usuarios solo vean sus propios pagos
CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

-- Política para insertar pagos (solo backend con service_role)
CREATE POLICY "Service role can insert payments" ON public.payments
  FOR INSERT WITH CHECK (true);

-- Agregar comentarios para documentación
COMMENT ON TABLE public.subscriptions IS 'Tabla de suscripciones de usuarios con planes activos';
COMMENT ON TABLE public.payments IS 'Historial completo de pagos procesados por MercadoPago';
COMMENT ON COLUMN public.subscriptions.plan_type IS 'Tipo de plan: monthly, yearly, trial, premium';
COMMENT ON COLUMN public.subscriptions.active IS 'Indica si la suscripción está activa';
COMMENT ON COLUMN public.subscriptions.expires_at IS 'Fecha de expiración de la suscripción';
COMMENT ON COLUMN public.subscriptions.payment_id IS 'ID del pago en MercadoPago';