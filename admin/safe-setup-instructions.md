# Setup Seguro para Admin Dashboard ZETALAB

## Paso 1: Verificar Schema Existente

1. Ve a Supabase SQL Editor
2. Ejecuta `check-schema.sql` **línea por línea**
3. Anota las columnas que realmente existen en cada tabla

## Paso 2: Crear Vistas Básicas

1. Ejecuta `minimal-admin-views.sql` en SQL Editor
2. Si alguna vista falla, comenta esa sección y continúa
3. Solo usa las vistas que se crearon exitosamente

## Paso 3: Verificar Vistas Creadas

```sql
-- Verificar qué vistas se crearon correctamente
SELECT table_name 
FROM information_schema.views 
WHERE table_schema = 'public' 
  AND table_name LIKE 'admin_%';
```

## Paso 4: Test Básico

```sql
-- Test solo las vistas que existen
SELECT COUNT(*) FROM admin_user_activity;
SELECT COUNT(*) FROM admin_pieces_overview;
SELECT COUNT(*) FROM admin_daily_stats;
```

## Si hay errores:

1. **Tabla no existe**: Comenta esa vista completa
2. **Columna no existe**: Remueve esa columna del SELECT
3. **Permission denied**: Verifica RLS policies

## Resultado esperado:

- Al menos `admin_user_activity` y `admin_pieces_overview` deberían funcionar
- Si `subscriptions` no existe, esa vista fallará (normal)
- El dashboard web se adaptará a las vistas disponibles