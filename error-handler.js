/* ==============================
   Sistema Centralizado de Manejo de Errores
   ZETALAB - Error Handler
============================== */

/**
 * Sistema centralizado para manejar todos los errores de la aplicación
 * Proporciona logging, notificaciones al usuario y recuperación de errores
 */
class ErrorHandler {
  static errorTypes = {
    NETWORK_ERROR: 'NETWORK_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR', 
    AUTH_ERROR: 'AUTH_ERROR',
    STORAGE_ERROR: 'STORAGE_ERROR',
    CALCULATION_ERROR: 'CALCULATION_ERROR',
    SUPABASE_ERROR: 'SUPABASE_ERROR',
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
  };

  static userMessages = {
    [this.errorTypes.NETWORK_ERROR]: 'Error de conexión. Verificá tu conexión a internet.',
    [this.errorTypes.VALIDATION_ERROR]: 'Algunos datos ingresados no son válidos. Revisá los campos marcados.',
    [this.errorTypes.AUTH_ERROR]: 'Problema de autenticación. Iniciá sesión nuevamente.',
    [this.errorTypes.STORAGE_ERROR]: 'Error guardando datos. Intentá nuevamente.',
    [this.errorTypes.CALCULATION_ERROR]: 'Error en el cálculo. Verificá los datos ingresados.',
    [this.errorTypes.SUPABASE_ERROR]: 'Error del servidor. Intentá más tarde.',
    [this.errorTypes.UNKNOWN_ERROR]: 'Error inesperado. Intentá nuevamente.'
  };

  /**
   * Maneja cualquier error de la aplicación
   * @param {Error|string} error - El error a manejar
   * @param {string} context - Contexto donde ocurrió el error
   * @param {Object} metadata - Datos adicionales del error
   */
  static handle(error, context = 'Unknown', metadata = {}) {
    const errorInfo = this.buildErrorInfo(error, context, metadata);
    
    // Log para desarrollo
    this.logError(errorInfo);
    
    // Notificar al usuario
    this.showUserNotification(error, context);
    
    // En producción, podríamos enviar a servicio de logging
    // this.reportToService(errorInfo);
    
    return errorInfo;
  }

  /**
   * Construye información detallada del error
   */
  static buildErrorInfo(error, context, metadata) {
    let errorObj;
    let message;
    
    if (error instanceof Error) {
      errorObj = error;
      message = error.message;
    } else if (typeof error === 'string') {
      message = error;
      errorObj = new Error(error);
    } else if (error && typeof error === 'object') {
      // Manejar objetos de error (ej: respuestas de Supabase)
      message = error.message || error.error || JSON.stringify(error);
      errorObj = new Error(message);
    } else {
      message = 'Unknown error occurred';
      errorObj = new Error(message);
    }
    
    return {
      message,
      stack: errorObj.stack,
      context,
      metadata,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      type: this.getErrorType(errorObj, context)
    };
  }

  /**
   * Determina el tipo de error basado en el mensaje y contexto
   */
  static getErrorType(error, context) {
    const message = error.message.toLowerCase();
    
    if (context.includes('auth') || message.includes('unauthorized') || message.includes('session')) {
      return this.errorTypes.AUTH_ERROR;
    }
    
    if (context.includes('network') || message.includes('fetch') || message.includes('network')) {
      return this.errorTypes.NETWORK_ERROR;
    }
    
    if (context.includes('validation') || message.includes('invalid') || message.includes('required')) {
      return this.errorTypes.VALIDATION_ERROR;
    }
    
    if (context.includes('storage') || message.includes('localstorage') || message.includes('quota')) {
      return this.errorTypes.STORAGE_ERROR;
    }
    
    if (context.includes('calculation') || context.includes('calc')) {
      return this.errorTypes.CALCULATION_ERROR;
    }
    
    if (context.includes('supabase') || message.includes('supabase')) {
      return this.errorTypes.SUPABASE_ERROR;
    }
    
    return this.errorTypes.UNKNOWN_ERROR;
  }

  /**
   * Log estructurado del error
   */
  static logError(errorInfo) {
    console.group(`🚨 [${errorInfo.context}] Error at ${errorInfo.timestamp}`);
    console.error('Message:', errorInfo.message);
    console.error('Type:', errorInfo.type);
    console.error('Stack:', errorInfo.stack);
    if (Object.keys(errorInfo.metadata).length > 0) {
      console.error('Metadata:', errorInfo.metadata);
    }
    console.groupEnd();
  }

  /**
   * Muestra notificación amigable al usuario
   */
  static showUserNotification(error, context) {
    const errorType = this.getErrorType(error instanceof Error ? error : new Error(String(error)), context);
    const message = this.userMessages[errorType] || this.userMessages[this.errorTypes.UNKNOWN_ERROR];
    
    // Usar la función toast existente si está disponible
    if (typeof toast === 'function') {
      toast(`❌ ${message}`, 'error');
    } else {
      // Fallback para mostrar errores si no hay toast
      this.showFallbackNotification(message);
    }
  }

  /**
   * Notificación fallback si no hay sistema de toast
   */
  static showFallbackNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #dc3545;
      color: white;
      padding: 12px 16px;
      border-radius: 4px;
      z-index: 10000;
      font-family: system-ui, -apple-system, sans-serif;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }

  /**
   * Wrapper para operaciones async que pueden fallar
   * @param {Function} operation - Función async a ejecutar
   * @param {string} context - Contexto de la operación
   * @param {*} fallbackValue - Valor a retornar si falla
   */
  static async safe(operation, context, fallbackValue = null) {
    try {
      return await operation();
    } catch (error) {
      this.handle(error, context);
      return fallbackValue;
    }
  }

  /**
   * Wrapper para operaciones síncronas que pueden fallar
   */
  static safeSync(operation, context, fallbackValue = null) {
    try {
      return operation();
    } catch (error) {
      this.handle(error, context);
      return fallbackValue;
    }
  }
}

// Manejador global para errores no capturados
window.addEventListener('error', (event) => {
  ErrorHandler.handle(event.error, 'Global Error Handler', {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno
  });
});

// Manejador para promesas rechazadas no capturadas
window.addEventListener('unhandledrejection', (event) => {
  ErrorHandler.handle(event.reason, 'Unhandled Promise Rejection');
  event.preventDefault(); // Prevenir que aparezca en consola como "uncaught"
});

// Exportar para uso global
window.ErrorHandler = ErrorHandler;