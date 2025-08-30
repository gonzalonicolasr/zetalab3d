/* ==============================
   Sistema de Debouncing Mejorado
   ZETALAB - Debounce Utilities
============================== */

/**
 * Sistema de debouncing avanzado para optimizar operaciones costosas
 * Incluye diferentes estrategias de debounce y throttling
 */
class DebounceManager {
  constructor() {
    this.timers = new Map();
    this.lastExecution = new Map();
    this.pending = new Map();
  }

  /**
   * Debounce clásico - ejecuta después del delay sin nuevas llamadas
   * @param {string} key - Identificador único
   * @param {Function} fn - Función a ejecutar
   * @param {number} delay - Delay en millisegundos
   * @param {Object} options - Opciones adicionales
   */
  debounce(key, fn, delay = 300, options = {}) {
    const { immediate = false, maxWait = null } = options;
    
    // Limpiar timer anterior
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    const execute = () => {
      this.timers.delete(key);
      this.lastExecution.set(key, Date.now());
      
      try {
        const result = fn();
        if (result instanceof Promise) {
          result.catch(error => {
            ErrorHandler?.handle?.(error, `Debounced function: ${key}`);
          });
        }
        return result;
      } catch (error) {
        ErrorHandler?.handle?.(error, `Debounced function: ${key}`);
      }
    };

    // Ejecución inmediata si está habilitada y es la primera llamada
    const isFirstCall = !this.timers.has(key) && !this.lastExecution.has(key);
    if (immediate && isFirstCall) {
      return execute();
    }

    // Verificar maxWait si está configurado
    const lastExec = this.lastExecution.get(key) || 0;
    const timeSinceLastExec = Date.now() - lastExec;
    
    if (maxWait && timeSinceLastExec >= maxWait) {
      return execute();
    }

    // Configurar nuevo timer
    const timerId = setTimeout(execute, delay);
    this.timers.set(key, timerId);
  }

  /**
   * Throttle - limita ejecuciones a una por período
   * @param {string} key - Identificador único  
   * @param {Function} fn - Función a ejecutar
   * @param {number} delay - Delay mínimo entre ejecuciones
   */
  throttle(key, fn, delay = 300) {
    const lastExec = this.lastExecution.get(key) || 0;
    const timeSinceLastExec = Date.now() - lastExec;

    if (timeSinceLastExec >= delay) {
      this.lastExecution.set(key, Date.now());
      
      try {
        return fn();
      } catch (error) {
        ErrorHandler?.handle?.(error, `Throttled function: ${key}`);
      }
    }
  }

  /**
   * Debounce con backoff - aumenta el delay si hay muchas llamadas
   * @param {string} key - Identificador único
   * @param {Function} fn - Función a ejecutar  
   * @param {number} baseDelay - Delay base
   * @param {Object} options - Opciones de backoff
   */
  debounceWithBackoff(key, fn, baseDelay = 300, options = {}) {
    const { 
      maxDelay = 2000, 
      backoffFactor = 1.5, 
      resetAfter = 5000 
    } = options;

    const state = this.pending.get(key) || { 
      count: 0, 
      lastCall: 0, 
      currentDelay: baseDelay 
    };

    state.count++;
    state.lastCall = Date.now();

    // Reset counter if enough time has passed
    if (Date.now() - state.lastCall > resetAfter) {
      state.count = 1;
      state.currentDelay = baseDelay;
    } else {
      // Increase delay based on call frequency
      state.currentDelay = Math.min(
        baseDelay * Math.pow(backoffFactor, Math.min(state.count - 1, 5)),
        maxDelay
      );
    }

    this.pending.set(key, state);

    return this.debounce(key, fn, state.currentDelay);
  }

  /**
   * Debounce para localStorage específicamente optimizado
   * @param {string} key - Clave de storage
   * @param {Function} fn - Función que guarda datos
   * @param {*} data - Datos a guardar
   */
  debouncedSave(key, fn, data, delay = 300) {
    // Usar un debounce específico para operaciones de guardado
    const storageKey = `save_${key}`;
    
    return this.debounce(storageKey, () => {
      try {
        return fn(data);
      } catch (error) {
        // Error específico para localStorage
        if (error.name === 'QuotaExceededError') {
          ErrorHandler?.handle?.(
            new Error('Espacio de almacenamiento agotado'), 
            'localStorage save',
            { key, dataSize: JSON.stringify(data).length }
          );
        } else {
          ErrorHandler?.handle?.(error, 'localStorage save', { key });
        }
        throw error;
      }
    }, delay, { maxWait: 1000 }); // Max 1 segundo de espera
  }

  /**
   * Debounce para cálculos costosos
   * @param {string} key - Identificador del cálculo
   * @param {Function} fn - Función de cálculo
   * @param {*} inputs - Inputs del cálculo
   */
  debouncedCalculation(key, fn, inputs, delay = 100) {
    const calcKey = `calc_${key}`;
    
    return this.debounce(calcKey, () => {
      const startTime = performance.now();
      
      try {
        const result = fn(inputs);
        const duration = performance.now() - startTime;
        
        // Log si el cálculo toma mucho tiempo
        if (duration > 50) {
          console.warn(`⚠️ Cálculo lento: ${key} tomó ${duration.toFixed(2)}ms`);
        }
        
        return result;
      } catch (error) {
        ErrorHandler?.handle?.(error, 'calculation', { key, inputs });
        throw error;
      }
    }, delay);
  }

  /**
   * Limpia todos los timers activos
   */
  clearAll() {
    this.timers.forEach(timerId => clearTimeout(timerId));
    this.timers.clear();
    this.lastExecution.clear();
    this.pending.clear();
  }

  /**
   * Limpia timers específicos
   */
  clear(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    this.lastExecution.delete(key);
    this.pending.delete(key);
  }

  /**
   * Obtiene estadísticas de uso
   */
  getStats() {
    return {
      activeTimers: this.timers.size,
      executionHistory: this.lastExecution.size,
      pendingOperations: this.pending.size,
      timers: Array.from(this.timers.keys()),
      pending: Array.from(this.pending.entries()).map(([key, state]) => ({
        key,
        count: state.count,
        delay: state.currentDelay
      }))
    };
  }
}

// Crear instancia global
const debounceManager = new DebounceManager();

// Helpers globales específicos
const createDebouncer = (fn, delay, options = {}) => {
  const key = `debouncer_${Date.now()}_${Math.random()}`;
  return (...args) => debounceManager.debounce(key, () => fn(...args), delay, options);
};

const createThrottler = (fn, delay) => {
  const key = `throttler_${Date.now()}_${Math.random()}`;
  return (...args) => debounceManager.throttle(key, () => fn(...args), delay);
};

// Exportar para uso global
window.DebounceManager = DebounceManager;
window.debounceManager = debounceManager;
window.createDebouncer = createDebouncer;
window.createThrottler = createThrottler;

// Limpiar en unload para evitar memory leaks
window.addEventListener('beforeunload', () => {
  debounceManager.clearAll();
});