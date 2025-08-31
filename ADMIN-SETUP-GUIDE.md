# 🔧 ZETALAB Admin Setup Guide

## ❌ Problemas Identificados y Soluciones

### Problema 1: Error de políticas SQL duplicadas
```
ERROR: 42710: policy "Admins can view all admin users" for table "admin_users" already exists
```

### Problema 2: Error de login administrativo
```
AuthApiError: Invalid login credentials
```

## ✅ Soluciones Implementadas

### 📋 Pasos para Resolver

#### Paso 1: Ejecutar el Script SQL Corregido

1. Ve a Supabase SQL Editor
2. Ejecuta el archivo: `admin-setup-fixed.sql`

Este script corregido:
- ✅ Maneja políticas existentes con `DROP POLICY IF EXISTS`
- ✅ Crea función helper `create_admin_user()` 
- ✅ Es idempotente (se puede ejecutar múltiples veces)

#### Paso 2: Crear el Usuario Administrador

**Opción A: Usando la página de registro (RECOMENDADO)**
1. Abre `register-admin-user.html` en tu navegador
2. Completa el formulario (datos ya pre-cargados)
3. Haz clic en "Crear Usuario Administrador"
4. Sigue las instrucciones en pantalla

**Opción B: Manualmente**
1. Si el usuario NO existe: regístrate normalmente en `index.html` con:
   - Email: `gonn.nicolas@gmail.com`
   - Password: `cocacola`

2. Una vez registrado, ejecuta en Supabase SQL:
   ```sql
   SELECT public.create_admin_user('gonn.nicolas@gmail.com');
   ```

#### Paso 3: Verificar la Instalación

Ejecuta en Supabase SQL Editor para verificar:
```sql
-- Verificar que el admin user fue creado
SELECT * FROM public.admin_users WHERE email = 'gonn.nicolas@gmail.com';

-- Verificar que el user existe en auth
SELECT id, email, email_confirmed_at FROM auth.users WHERE email = 'gonn.nicolas@gmail.com';
```

## 🔍 Diagnóstico de Problemas

### Si el login sigue fallando:

1. **Usuario no confirmado**: Revisa el email y confirma la cuenta
2. **Usuario no existe**: Usa `register-admin-user.html` para crearlo
3. **Admin no creado**: Ejecuta el SQL de creación de admin
4. **Políticas incorrectas**: Ejecuta `admin-setup-fixed.sql`

### Scripts de Verificación

```sql
-- Ver todos los admin users
SELECT 
  au.id,
  au.email,
  au.role,
  au.active,
  u.email_confirmed_at,
  au.created_at
FROM admin_users au
JOIN auth.users u ON au.user_id = u.id;

-- Ver funciones creadas
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%admin%';
```

## 📁 Archivos Creados/Modificados

1. `admin-setup-fixed.sql` - Script SQL corregido
2. `create-admin-user.sql` - Script para crear admin user específico  
3. `register-admin-user.html` - Interfaz para registro automático
4. `ADMIN-SETUP-GUIDE.md` - Esta guía

## 🚀 Próximos Pasos

Una vez resuelto:
1. Accede al panel admin con las credenciales
2. Verifica que todas las funciones funcionan
3. Opcionalmente, elimina `register-admin-user.html` por seguridad

## ⚠️ Notas de Seguridad

- `register-admin-user.html` contiene credenciales hardcodeadas
- Elimínalo después de usar o muévelo fuera del directorio público
- Cambia la contraseña admin después del primer login

## 💡 Resumen

Los errores eran causados por:
1. **Políticas duplicadas** → Solucionado con `DROP POLICY IF EXISTS`
2. **Usuario admin inexistente** → Solucionado con proceso de registro completo

Con estos archivos, el sistema admin debería funcionar correctamente.