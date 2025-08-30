/* ==============================
   ZETALAB - Config Profiles Service
   Servicio para gestionar perfiles de configuración en Supabase
============================== */

/**
 * Servicio para manejar perfiles de configuración de gastos fijos
 * Sincroniza con Supabase y mantiene compatibilidad con localStorage
 */
class ConfigProfilesService {
  constructor() {
    this.tableName = 'config_profiles';
    this.localStorageKey = 'zl_calc_fixed_presets';
    this.migrationKey = 'zl_profiles_migrated';
    this.cache = new Map();
    this.syncInProgress = false;
  }

  /**
   * Maneja errores de forma segura
   */
  handleError(error, context) {
    console.error(`❌ [${context}] Error:`, error);
    
    try {
      if (window.ErrorHandler && typeof window.ErrorHandler.handle === 'function') {
        window.ErrorHandler.handle(error, context);
      }
    } catch (handlerError) {
      console.error('❌ Error en ErrorHandler:', handlerError);
    }
  }

  /**
   * Inicializa el servicio y migra datos de localStorage si es necesario
   */
  async initialize() {
    try {
      // Verificar si el usuario está autenticado
      if (!window.supa || !window.currentUser) {
        console.warn('Usuario no autenticado, usando solo localStorage');
        return false;
      }

      // Migrar datos de localStorage si no se ha hecho antes
      await this.migrateFromLocalStorage();

      // Sincronizar perfiles desde Supabase
      await this.syncFromSupabase();

      console.log('✅ ConfigProfilesService inicializado correctamente');
      return true;
    } catch (error) {
      this.handleError(error, 'Config Profiles Service Initialization');
      return false;
    }
  }

  /**
   * Migra perfiles existentes de localStorage a Supabase
   */
  async migrateFromLocalStorage() {
    const migrated = localStorage.getItem(this.migrationKey);
    if (migrated) return; // Ya migrado

    try {
      const localPresets = JSON.parse(localStorage.getItem(this.localStorageKey) || '{}');
      const presetNames = Object.keys(localPresets);

      if (presetNames.length === 0) {
        localStorage.setItem(this.migrationKey, 'true');
        return;
      }

      console.log(`🔄 Migrando ${presetNames.length} perfiles de localStorage a Supabase...`);

      for (const name of presetNames) {
        const preset = localPresets[name];
        
        const profile = {
          name: name,
          description: `Perfil migrado desde localStorage`,
          precio_kg: Number(preset.precioKg) || 0,
          precio_kwh: Number(preset.precioKwh) || 0,
          consumo_w: Number(preset.consumoW) || 0,
          horas_desgaste: Number(preset.horasDesgaste) || 1,
          precio_repuestos: Number(preset.precioRepuestos) || 0,
          margen_error: Number(preset.margenError) || 0,
          multiplicador: 1.0,
          ml_fee: 0,
          is_default: false
        };

        await this.createProfile(profile, false); // No sincronizar cada uno
      }

      // Marcar migración como completada
      localStorage.setItem(this.migrationKey, 'true');
      
      if (window.toast) toast('✅ Perfiles migrados a la nube exitosamente', 'success');
      console.log('✅ Migración completada');

    } catch (error) {
      console.error('Error en migración:', error);
      this.handleError(error, 'LocalStorage Migration');
    }
  }

  /**
   * Sincroniza perfiles desde Supabase
   */
  async syncFromSupabase() {
    if (this.syncInProgress) return;
    this.syncInProgress = true;

    try {
      const { data: profiles, error } = await window.supa
        .from(this.tableName)
        .select('*')
        .order('name');

      if (error) {
        // Si la tabla no existe, mostrar instrucciones
        if (error.message.includes('relation "public.config_profiles" does not exist') || 
            error.message.includes('Could not find the table')) {
          console.warn('⚠️ Tabla config_profiles no existe');
          this.showTableCreationInstructions();
          throw new Error('Tabla config_profiles faltante - revisa las instrucciones en consola');
        }
        throw error;
      }

      // Actualizar cache
      this.cache.clear();
      profiles.forEach(profile => {
        this.cache.set(profile.id, profile);
      });

      console.log(`📥 Sincronizados ${profiles.length} perfiles desde Supabase`);
      return profiles;

    } catch (error) {
      this.handleError(error, 'Supabase Sync');
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Muestra instrucciones para crear la tabla manualmente
   */
  showTableCreationInstructions() {
    const message = `
🛠️ CONFIGURACIÓN REQUERIDA - TABLA FALTANTE

La tabla 'config_profiles' no existe en Supabase.

SOLUCIONES:

1️⃣ AUTOMÁTICO (Recomendado):
   • Abre 'setup-database.html' en tu navegador
   • Hace clic en "Ejecutar Configuración Completa"

2️⃣ MANUAL:
   • Ve a Supabase Dashboard → SQL Editor
   • Ejecuta el contenido de 'create-config-profiles-table.sql'

3️⃣ CONTINUAR SIN SUPABASE:
   • Los presets se guardarán solo en localStorage
   • No se sincronizarán entre dispositivos

Archivos disponibles:
• setup-database.html (configuración automática)
• create-config-profiles-table.sql (script SQL manual)
    `;

    console.warn(message);
    
    // Mostrar notificación visual si es posible
    if (typeof toast === 'function') {
      toast('⚠️ Tabla config_profiles faltante. Revisa la consola para instrucciones.', 'warning', 8000);
    } else if (typeof alert === 'function') {
      // Fallback a alert si no hay toast
      setTimeout(() => {
        alert('⚠️ Configuración requerida\n\nLa tabla config_profiles no existe en Supabase.\n\nSolución: Abre setup-database.html para configuración automática.');
      }, 2000);
    }
  }

  /**
   * Obtiene todos los perfiles del usuario
   */
  async getProfiles() {
    try {
      if (!window.supa) {
        // Fallback a localStorage
        return this.getProfilesFromLocalStorage();
      }

      // Si el cache está vacío, sincronizar
      if (this.cache.size === 0) {
        await this.syncFromSupabase();
      }

      return Array.from(this.cache.values())
        .filter(profile => 
          profile.user_id === window.currentUser?.id || profile.is_public
        )
        .sort((a, b) => {
          // Ordenar: propios primero, luego por nombre
          if (a.user_id === window.currentUser?.id && b.user_id !== window.currentUser?.id) return -1;
          if (a.user_id !== window.currentUser?.id && b.user_id === window.currentUser?.id) return 1;
          return a.name.localeCompare(b.name);
        });

    } catch (error) {
      this.handleError(error, 'Get Profiles');
      return this.getProfilesFromLocalStorage();
    }
  }

  /**
   * Fallback: obtener perfiles de localStorage
   */
  getProfilesFromLocalStorage() {
    try {
      const presets = JSON.parse(localStorage.getItem(this.localStorageKey) || '{}');
      return Object.entries(presets).map(([name, data]) => ({
        id: `local_${name}`,
        name,
        description: 'Perfil local',
        precio_kg: Number(data.precioKg) || 0,
        precio_kwh: Number(data.precioKwh) || 0,
        consumo_w: Number(data.consumoW) || 0,
        horas_desgaste: Number(data.horasDesgaste) || 1,
        precio_repuestos: Number(data.precioRepuestos) || 0,
        margen_error: Number(data.margenError) || 0,
        multiplicador: 1.0,
        ml_fee: 0,
        is_local: true
      }));
    } catch (error) {
      this.handleError(error, 'LocalStorage Fallback');
      return [];
    }
  }

  /**
   * Crear nuevo perfil
   */
  async createProfile(profileData, syncAfter = true) {
    try {
      if (!window.supa || !window.currentUser) {
        return this.createProfileInLocalStorage(profileData);
      }

      // Validar datos
      const validatedData = this.validateProfileData(profileData);
      
      // Agregar user_id
      validatedData.user_id = window.currentUser.id;

      const { data, error } = await window.supa
        .from(this.tableName)
        .insert([validatedData])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Unique violation
          throw new Error(`Ya existe un perfil con el nombre "${profileData.name}"`);
        }
        throw error;
      }

      // Actualizar cache
      this.cache.set(data.id, data);

      if (syncAfter && window.toast) {
        toast(`✅ Perfil "${data.name}" creado exitosamente`, 'success');
      }

      return data;

    } catch (error) {
      this.handleError(error, 'Create Profile');
      throw error;
    }
  }

  /**
   * Actualizar perfil existente
   */
  async updateProfile(profileId, updates) {
    try {
      if (!window.supa) {
        return this.updateProfileInLocalStorage(profileId, updates);
      }

      // Validar datos
      const validatedUpdates = this.validateProfileData(updates, false);

      const { data, error } = await window.supa
        .from(this.tableName)
        .update(validatedUpdates)
        .eq('id', profileId)
        .eq('user_id', window.currentUser.id) // Solo actualizar propios
        .select()
        .single();

      if (error) throw error;

      // Actualizar cache
      this.cache.set(data.id, data);

      if (window.toast) toast(`✅ Perfil "${data.name}" actualizado`, 'success');
      return data;

    } catch (error) {
      this.handleError(error, 'Update Profile');
      throw error;
    }
  }

  /**
   * Eliminar perfil
   */
  async deleteProfile(profileId) {
    try {
      if (!window.supa) {
        return this.deleteProfileInLocalStorage(profileId);
      }

      const profile = this.cache.get(profileId);
      if (!profile) {
        throw new Error('Perfil no encontrado');
      }

      const { error } = await window.supa
        .from(this.tableName)
        .delete()
        .eq('id', profileId)
        .eq('user_id', window.currentUser.id); // Solo eliminar propios

      if (error) throw error;

      // Remover del cache
      this.cache.delete(profileId);

      if (window.toast) toast(`🗑️ Perfil "${profile.name}" eliminado`, 'info');
      return true;

    } catch (error) {
      this.handleError(error, 'Delete Profile');
      throw error;
    }
  }

  /**
   * Obtener perfil por ID
   */
  async getProfile(profileId) {
    try {
      if (this.cache.has(profileId)) {
        return this.cache.get(profileId);
      }

      if (!window.supa) return null;

      const { data, error } = await window.supa
        .from(this.tableName)
        .select('*')
        .eq('id', profileId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        this.cache.set(data.id, data);
      }

      return data;

    } catch (error) {
      this.handleError(error, 'Get Profile');
      return null;
    }
  }

  /**
   * Marcar perfil como predeterminado
   */
  async setDefaultProfile(profileId) {
    try {
      if (!window.supa) return false;

      const { error } = await window.supa
        .from(this.tableName)
        .update({ is_default: true })
        .eq('id', profileId)
        .eq('user_id', window.currentUser.id);

      if (error) throw error;

      // Actualizar cache
      const profile = this.cache.get(profileId);
      if (profile) {
        profile.is_default = true;
        // Quitar default de otros perfiles en cache
        for (const [id, p] of this.cache.entries()) {
          if (id !== profileId && p.user_id === window.currentUser.id) {
            p.is_default = false;
          }
        }
      }

      if (window.toast) toast(`⭐ "${profile?.name}" establecido como perfil predeterminado`, 'success');
      return true;

    } catch (error) {
      this.handleError(error, 'Set Default Profile');
      return false;
    }
  }

  /**
   * Validar datos del perfil
   */
  validateProfileData(data, isNew = true) {
    const validated = {};

    if (isNew && !data.name?.trim()) {
      throw new Error('El nombre del perfil es requerido');
    }

    if (data.name !== undefined) {
      validated.name = data.name.trim().substring(0, 200);
    }

    if (data.description !== undefined) {
      validated.description = data.description?.trim() || null;
    }

    // Validar campos numéricos
    const numericFields = {
      precio_kg: { min: 0, max: 9999999.99 },
      precio_kwh: { min: 0, max: 99999.99 },
      consumo_w: { min: 0, max: 10000 },
      horas_desgaste: { min: 1, max: 999999 },
      precio_repuestos: { min: 0, max: 9999999.99 },
      margen_error: { min: 0, max: 100 },
      multiplicador: { min: 0.1, max: 20 },
      ml_fee: { min: 0, max: 50 }
    };

    Object.entries(numericFields).forEach(([field, validation]) => {
      if (data[field] !== undefined) {
        const value = Number(data[field]) || 0;
        if (value < validation.min || value > validation.max) {
          throw new Error(`${field} debe estar entre ${validation.min} y ${validation.max}`);
        }
        validated[field] = value;
      }
    });

    // Campos booleanos
    if (data.is_default !== undefined) validated.is_default = Boolean(data.is_default);
    if (data.is_public !== undefined) validated.is_public = Boolean(data.is_public);

    // Campo config_data - asegurar que siempre tenga un valor por defecto
    if (data.config_data !== undefined) {
      try {
        validated.config_data = typeof data.config_data === 'string' 
          ? JSON.parse(data.config_data) 
          : (data.config_data || {});
      } catch (e) {
        validated.config_data = {};
      }
    } else {
      // Siempre incluir config_data con valor por defecto
      validated.config_data = {};
    }

    return validated;
  }

  /**
   * Métodos fallback para localStorage
   */
  createProfileInLocalStorage(profileData) {
    const presets = JSON.parse(localStorage.getItem(this.localStorageKey) || '{}');
    
    if (presets[profileData.name]) {
      throw new Error(`Ya existe un perfil con el nombre "${profileData.name}"`);
    }

    presets[profileData.name] = {
      precioKg: profileData.precio_kg || 0,
      precioKwh: profileData.precio_kwh || 0,
      consumoW: profileData.consumo_w || 0,
      horasDesgaste: profileData.horas_desgaste || 1,
      precioRepuestos: profileData.precio_repuestos || 0,
      margenError: profileData.margen_error || 0
    };

    localStorage.setItem(this.localStorageKey, JSON.stringify(presets));
    return { id: `local_${profileData.name}`, name: profileData.name };
  }

  updateProfileInLocalStorage(profileId, updates) {
    // Para localStorage, necesitamos el nombre del perfil
    const profileName = profileId.replace('local_', '');
    const presets = JSON.parse(localStorage.getItem(this.localStorageKey) || '{}');
    
    if (!presets[profileName]) {
      throw new Error('Perfil no encontrado');
    }

    // Actualizar campos
    if (updates.precio_kg !== undefined) presets[profileName].precioKg = updates.precio_kg;
    if (updates.precio_kwh !== undefined) presets[profileName].precioKwh = updates.precio_kwh;
    if (updates.consumo_w !== undefined) presets[profileName].consumoW = updates.consumo_w;
    if (updates.horas_desgaste !== undefined) presets[profileName].horasDesgaste = updates.horas_desgaste;
    if (updates.precio_repuestos !== undefined) presets[profileName].precioRepuestos = updates.precio_repuestos;
    if (updates.margen_error !== undefined) presets[profileName].margenError = updates.margen_error;

    localStorage.setItem(this.localStorageKey, JSON.stringify(presets));
    return { id: profileId, name: profileName };
  }

  deleteProfileInLocalStorage(profileId) {
    const profileName = profileId.replace('local_', '');
    const presets = JSON.parse(localStorage.getItem(this.localStorageKey) || '{}');
    
    if (!presets[profileName]) {
      throw new Error('Perfil no encontrado');
    }

    delete presets[profileName];
    localStorage.setItem(this.localStorageKey, JSON.stringify(presets));
    return true;
  }

  /**
   * Convertir perfil de Supabase al formato legacy para compatibilidad
   */
  profileToLegacyFormat(profile) {
    return {
      precioKg: profile.precio_kg?.toString() || '0',
      precioKwh: profile.precio_kwh?.toString() || '0',
      consumoW: profile.consumo_w?.toString() || '0',
      horasDesgaste: profile.horas_desgaste?.toString() || '1',
      precioRepuestos: profile.precio_repuestos?.toString() || '0',
      margenError: profile.margen_error?.toString() || '0'
    };
  }

  /**
   * Estadísticas de uso
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      syncInProgress: this.syncInProgress,
      isOnline: !!window.supa && !!window.currentUser,
      migrated: !!localStorage.getItem(this.migrationKey)
    };
  }
}

// Crear instancia global
const configProfilesService = new ConfigProfilesService();

// Exportar para uso global
window.ConfigProfilesService = ConfigProfilesService;
window.configProfilesService = configProfilesService;

// Auto-inicializar cuando el usuario esté autenticado
document.addEventListener('DOMContentLoaded', async () => {
  // Esperar un poco a que se carguen todos los scripts
  setTimeout(async () => {
    if (window.currentUser && window.configProfilesService) {
      try {
        await window.configProfilesService.initialize();
      } catch (error) {
        console.error('❌ Error inicializando ConfigProfilesService:', error);
      }
    }
  }, 1500); // Aumentar tiempo para asegurar carga completa
});

// Inicializar cuando cambie el estado de auth
if (window.supa) {
  window.supa.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      await configProfilesService.initialize();
    }
  });
}