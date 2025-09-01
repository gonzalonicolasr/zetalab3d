-- VERIFICAR ESQUEMA REAL DE ZETALAB
-- Ejecuta estas consultas una por una en Supabase SQL Editor

-- 1. Verificar estructura de tabla pieces
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'pieces'
ORDER BY ordinal_position;

-- 2. Verificar estructura de tabla piece_versions
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'piece_versions'
ORDER BY ordinal_position;

-- 3. Verificar estructura de tabla subscriptions
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'subscriptions'
ORDER BY ordinal_position;

-- 4. Verificar estructura de tabla payment_transactions
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'payment_transactions'
ORDER BY ordinal_position;

-- 5. Verificar todas las tablas públicas existentes
SELECT table_name
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;