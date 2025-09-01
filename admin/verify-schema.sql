-- ============================================
-- VERIFICACIÓN DE ESQUEMA ZETALAB
-- Ejecuta esto PRIMERO para ver qué tienes
-- ============================================

-- 1. Ver todas las tablas públicas
SELECT 
    'TABLAS DISPONIBLES:' as info,
    table_name,
    CASE 
        WHEN table_name = 'pieces' THEN '✅ Tabla principal'
        WHEN table_name = 'piece_versions' THEN '✅ Versiones/cálculos'
        WHEN table_name = 'subscriptions' THEN '⚠️ Suscripciones'
        WHEN table_name = 'subscription_plans' THEN '⚠️ Planes de suscripción'
        WHEN table_name = 'payment_transactions' THEN '⚠️ Transacciones'
        ELSE '❓ Otra tabla'
    END as status
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. Ver estructura de subscription_plans SI EXISTE
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'subscription_plans'
    ) THEN
        RAISE NOTICE 'ESTRUCTURA DE subscription_plans:';
        -- Esta consulta mostrará las columnas
    ELSE
        RAISE NOTICE 'TABLA subscription_plans NO EXISTE - usar setup mínimo';
    END IF;
END $$;

SELECT 
    'COLUMNAS subscription_plans:' as info,
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'subscription_plans'
ORDER BY ordinal_position;

-- 3. Ver estructura de subscriptions SI EXISTE
SELECT 
    'COLUMNAS subscriptions:' as info,
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'subscriptions'
ORDER BY ordinal_position;

-- 4. Ver vistas admin existentes
SELECT 
    'VISTAS ADMIN EXISTENTES:' as info,
    viewname as view_name,
    CASE 
        WHEN viewname LIKE 'admin_%' THEN '✅ Vista admin'
        ELSE '❓ Otra vista'
    END as status
FROM pg_views 
WHERE schemaname = 'public' 
  AND viewname LIKE '%admin%'
ORDER BY viewname;

-- 5. Conteo básico de datos
SELECT 
    'ESTADÍSTICAS BÁSICAS:' as info,
    'pieces' as table_name,
    COUNT(*) as record_count
FROM pieces
UNION ALL
SELECT 
    '',
    'piece_versions',
    COUNT(*)
FROM piece_versions
UNION ALL  
SELECT 
    '',
    'auth.users',
    COUNT(*)
FROM auth.users;

-- 6. Verificar permisos
SELECT 
    'PERMISOS:' as info,
    table_name,
    privilege_type
FROM information_schema.role_table_grants 
WHERE grantee = 'authenticated' 
  AND table_schema = 'public'
  AND table_name IN ('pieces', 'piece_versions', 'subscriptions', 'subscription_plans')
ORDER BY table_name, privilege_type;

-- 7. Recomendación final
DO $$
DECLARE
    has_sub_plans boolean;
    has_subscriptions boolean;
    has_payments boolean;
BEGIN
    -- Check critical tables
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'subscription_plans'
    ) INTO has_sub_plans;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'subscriptions'
    ) INTO has_subscriptions;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'payment_transactions'
    ) INTO has_payments;
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'RECOMENDACIÓN PARA ZETALAB:';
    RAISE NOTICE '============================================';
    
    IF has_sub_plans AND has_subscriptions AND has_payments THEN
        RAISE NOTICE '✅ ESQUEMA COMPLETO: Usa corrected-setup.sql';
        RAISE NOTICE '   - Todas las tablas de suscripción están presentes';
        RAISE NOTICE '   - Ejecuta el setup seguro para corregir columnas';
    ELSIF has_subscriptions THEN
        RAISE NOTICE '⚠️  ESQUEMA PARCIAL: Usa corrected-setup.sql + safe functions';
        RAISE NOTICE '   - Tienes tabla subscriptions pero falta estructura completa';
        RAISE NOTICE '   - Combina setup SQL + JavaScript seguro';
    ELSE
        RAISE NOTICE '📝 ESQUEMA BÁSICO: Usa fallback-minimal-setup.sql';
        RAISE NOTICE '   - Solo tienes tablas básicas (pieces, piece_versions)';
        RAISE NOTICE '   - Usa el setup mínimo que funciona sin suscripciones';
    END IF;
    
    RAISE NOTICE '============================================';
    RAISE NOTICE 'PRÓXIMOS PASOS:';
    RAISE NOTICE '1. Ejecuta el setup SQL recomendado arriba';
    RAISE NOTICE '2. Incluye safe-admin-functions.js en tu dashboard';  
    RAISE NOTICE '3. Verifica que el admin dashboard carga sin errores';
    RAISE NOTICE '============================================';
END $$;