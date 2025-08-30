/* ==============================
   Sistema de Validación con Mensajes de Error
   ZETALAB - Input Validators
============================== */

/**
 * Sistema de validación centralizado para todos los inputs de la aplicación
 * Proporciona validación en tiempo real, mensajes de error específicos y feedback visual
 */
class ValidationSystem {
  constructor() {
    this.validators = new Map();
    this.errorElements = new Map();
    this.validationRules = this.getValidationRules();
    this.initializeStyles();
  }

  /**
   * Define las reglas de validación para cada campo
   */
  getValidationRules() {
    return {
      // Precios y costos
      precioKg: {
        type: 'currency',
        min: 0,
        max: 999999,
        required: false,
        label: 'Precio por Kg'
      },
      precioKwh: {
        type: 'currency',
        min: 0,
        max: 9999,
        required: false,
        label: 'Precio kWh'
      },
      consumoW: {
        type: 'number',
        min: 0,
        max: 10000,
        required: false,
        label: 'Consumo en Watts'
      },
      horasDesgaste: {
        type: 'number',
        min: 0.1,
        max: 100000,
        required: false,
        label: 'Horas de desgaste'
      },
      precioRepuestos: {
        type: 'currency',
        min: 0,
        max: 999999,
        required: false,
        label: 'Precio repuestos'
      },
      margenError: {
        type: 'percentage',
        min: 0,
        max: 100,
        required: false,
        label: 'Margen de error'
      },

      // Tiempos
      horas: {
        type: 'number',
        min: 0,
        max: 999,
        integer: true,
        required: false,
        label: 'Horas'
      },
      minutos: {
        type: 'number',
        min: 0,
        max: 59,
        integer: true,
        required: false,
        label: 'Minutos'
      },

      // Materiales
      gramos: {
        type: 'number',
        min: 0,
        max: 50000,
        required: false,
        label: 'Gramos de filamento'
      },
      insumos: {
        type: 'currency',
        min: 0,
        max: 999999,
        required: false,
        label: 'Costo de insumos'
      },

      // Márgenes
      multiplicador: {
        type: 'number',
        min: 0.1,
        max: 20,
        decimals: 2,
        required: false,
        label: 'Multiplicador de ganancia'
      },
      mlFee: {
        type: 'percentage',
        min: 0,
        max: 50,
        required: false,
        label: 'Comisión MercadoLibre'
      },

      // Textos
      pieceName: {
        type: 'text',
        minLength: 1,
        maxLength: 200,
        required: false,
        label: 'Nombre de la pieza'
      },
      pieceUrl: {
        type: 'url',
        required: false,
        label: 'URL de la pieza'
      },
      imageUrl: {
        type: 'url',
        required: false,
        label: 'URL de imagen'
      }
    };
  }

  /**
   * Inicializa estilos CSS para validación
   */
  initializeStyles() {
    if (document.getElementById('validation-styles')) return;

    const style = document.createElement('style');
    style.id = 'validation-styles';
    style.textContent = `
      .zl-field-group {
        position: relative;
        margin-bottom: 1rem;
      }

      .zl-input-error {
        border-color: #dc3545 !important;
        box-shadow: 0 0 0 0.2rem rgba(220, 53, 69, 0.25) !important;
        background-color: rgba(220, 53, 69, 0.05) !important;
      }

      .zl-input-valid {
        border-color: #28a745 !important;
        box-shadow: 0 0 0 0.2rem rgba(40, 167, 69, 0.25) !important;
      }

      .zl-error-message {
        display: block;
        width: 100%;
        margin-top: 0.25rem;
        font-size: 0.875rem;
        color: #dc3545;
        font-family: system-ui, -apple-system, sans-serif;
        animation: zl-error-fadeIn 0.3s ease-in-out;
      }

      .zl-warning-message {
        display: block;
        width: 100%;
        margin-top: 0.25rem;
        font-size: 0.875rem;
        color: #ffc107;
        font-family: system-ui, -apple-system, sans-serif;
      }

      @keyframes zl-error-fadeIn {
        from {
          opacity: 0;
          transform: translateY(-5px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .zl-validation-icon {
        position: absolute;
        right: 10px;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
        font-size: 16px;
      }

      .zl-validation-summary {
        background: rgba(220, 53, 69, 0.1);
        border: 1px solid rgba(220, 53, 69, 0.3);
        border-radius: 4px;
        padding: 12px;
        margin: 16px 0;
        color: #721c24;
      }

      .zl-validation-summary h4 {
        margin: 0 0 8px 0;
        font-size: 14px;
        font-weight: 600;
      }

      .zl-validation-summary ul {
        margin: 0;
        padding-left: 20px;
        font-size: 13px;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Validadores específicos por tipo
   */
  getValidators() {
    return {
      number: (value, rule) => {
        if (value === '' || value === null || value === undefined) {
          return rule.required ? { valid: false, message: `${rule.label} es requerido` } : { valid: true };
        }

        const num = Number(value);
        if (!Number.isFinite(num)) {
          return { valid: false, message: `${rule.label} debe ser un número válido` };
        }

        if (rule.min !== undefined && num < rule.min) {
          return { valid: false, message: `${rule.label} debe ser mayor o igual a ${rule.min}` };
        }

        if (rule.max !== undefined && num > rule.max) {
          return { valid: false, message: `${rule.label} debe ser menor o igual a ${rule.max}` };
        }

        if (rule.integer && !Number.isInteger(num)) {
          return { valid: false, message: `${rule.label} debe ser un número entero` };
        }

        if (rule.decimals !== undefined) {
          const decimals = (value.toString().split('.')[1] || '').length;
          if (decimals > rule.decimals) {
            return { valid: false, message: `${rule.label} puede tener máximo ${rule.decimals} decimales` };
          }
        }

        return { valid: true };
      },

      currency: (value, rule) => {
        const result = this.getValidators().number(value, rule);
        if (!result.valid) return result;

        if (value !== '' && Number(value) < 0) {
          return { valid: false, message: `${rule.label} no puede ser negativo` };
        }

        return { valid: true };
      },

      percentage: (value, rule) => {
        const result = this.getValidators().number(value, rule);
        if (!result.valid) return result;

        const num = Number(value);
        if (value !== '' && (num < 0 || num > 100)) {
          return { valid: false, message: `${rule.label} debe estar entre 0 y 100` };
        }

        return { valid: true };
      },

      text: (value, rule) => {
        if (!value && rule.required) {
          return { valid: false, message: `${rule.label} es requerido` };
        }

        if (!value) return { valid: true };

        if (rule.minLength && value.length < rule.minLength) {
          return { valid: false, message: `${rule.label} debe tener al menos ${rule.minLength} caracteres` };
        }

        if (rule.maxLength && value.length > rule.maxLength) {
          return { valid: false, message: `${rule.label} debe tener máximo ${rule.maxLength} caracteres` };
        }

        // Validar caracteres especiales peligrosos
        if (/<script|javascript:|vbscript:|onload=|onerror=/i.test(value)) {
          return { valid: false, message: `${rule.label} contiene caracteres no permitidos` };
        }

        return { valid: true };
      },

      url: (value, rule) => {
        if (!value && rule.required) {
          return { valid: false, message: `${rule.label} es requerido` };
        }

        if (!value) return { valid: true };

        try {
          const url = new URL(value);
          if (!['http:', 'https:'].includes(url.protocol)) {
            return { valid: false, message: `${rule.label} debe usar protocolo HTTP o HTTPS` };
          }
          return { valid: true };
        } catch {
          return { valid: false, message: `${rule.label} debe ser una URL válida` };
        }
      }
    };
  }

  /**
   * Valida un campo específico
   */
  validateField(fieldName, value) {
    const rule = this.validationRules[fieldName];
    if (!rule) return { valid: true };

    const validator = this.getValidators()[rule.type];
    if (!validator) return { valid: true };

    return validator.call(this, value, rule);
  }

  /**
   * Valida todos los campos del formulario
   */
  validateAll(formData = {}) {
    const errors = [];
    const warnings = [];

    Object.keys(this.validationRules).forEach(fieldName => {
      const value = formData[fieldName] ?? document.getElementById(fieldName)?.value ?? '';
      const result = this.validateField(fieldName, value);

      if (!result.valid) {
        errors.push({
          field: fieldName,
          message: result.message,
          label: this.validationRules[fieldName].label
        });
      }

      // Verificar warnings específicos
      const warning = this.checkFieldWarning(fieldName, value);
      if (warning) {
        warnings.push({
          field: fieldName,
          message: warning,
          label: this.validationRules[fieldName].label
        });
      }
    });

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Verifica warnings específicos (no errores, pero sugerencias)
   */
  checkFieldWarning(fieldName, value) {
    const num = Number(value);
    
    // Warnings específicos por campo
    switch (fieldName) {
      case 'multiplicador':
        if (num < 1.5) return 'Multiplicador muy bajo, podrías no tener ganancia';
        if (num > 5) return 'Multiplicador muy alto, podría afectar competitividad';
        break;
      
      case 'gramos':
        if (num > 1000) return 'Pieza muy pesada, verificá el peso';
        break;
        
      case 'horas':
        if (num > 24) return 'Tiempo muy largo para una pieza';
        break;
        
      case 'precioKg':
        if (num > 50000) return 'Precio del filamento muy alto';
        break;
    }
    
    return null;
  }

  /**
   * Actualiza la UI con el resultado de validación
   */
  updateFieldUI(fieldName, result) {
    const element = document.getElementById(fieldName);
    if (!element) return;

    // Limpiar estados previos
    element.classList.remove('zl-input-error', 'zl-input-valid');
    this.clearFieldError(fieldName);

    if (result.valid) {
      // Solo marcar como válido si hay contenido
      if (element.value.trim()) {
        element.classList.add('zl-input-valid');
      }
    } else {
      element.classList.add('zl-input-error');
      this.showFieldError(fieldName, result.message);
    }

    // Mostrar warnings si existen
    const warning = this.checkFieldWarning(fieldName, element.value);
    if (warning) {
      this.showFieldWarning(fieldName, warning);
    }
  }

  /**
   * Muestra mensaje de error para un campo
   */
  showFieldError(fieldName, message) {
    const element = document.getElementById(fieldName);
    if (!element) return;

    let errorElement = this.errorElements.get(fieldName);
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.className = 'zl-error-message';
      errorElement.id = `${fieldName}-error`;
      element.parentNode.insertBefore(errorElement, element.nextSibling);
      this.errorElements.set(fieldName, errorElement);
    }

    errorElement.textContent = message;
    errorElement.className = 'zl-error-message';
  }

  /**
   * Muestra mensaje de warning para un campo
   */
  showFieldWarning(fieldName, message) {
    const element = document.getElementById(fieldName);
    if (!element) return;

    let errorElement = this.errorElements.get(fieldName);
    if (!errorElement) {
      errorElement = document.createElement('div');
      errorElement.id = `${fieldName}-error`;
      element.parentNode.insertBefore(errorElement, element.nextSibling);
      this.errorElements.set(fieldName, errorElement);
    }

    errorElement.textContent = message;
    errorElement.className = 'zl-warning-message';
  }

  /**
   * Limpia error de campo
   */
  clearFieldError(fieldName) {
    const errorElement = this.errorElements.get(fieldName);
    if (errorElement) {
      errorElement.remove();
      this.errorElements.delete(fieldName);
    }
  }

  /**
   * Inicializa validación en tiempo real para todos los campos
   */
  initializeRealTimeValidation() {
    Object.keys(this.validationRules).forEach(fieldName => {
      const element = document.getElementById(fieldName);
      if (element) {
        // Validar on blur (cuando el usuario sale del campo)
        element.addEventListener('blur', () => {
          const result = this.validateField(fieldName, element.value);
          this.updateFieldUI(fieldName, result);
        });

        // Limpiar errores on focus (cuando el usuario entra al campo)
        element.addEventListener('focus', () => {
          element.classList.remove('zl-input-error');
        });
      }
    });
  }

  /**
   * Muestra resumen de errores de validación
   */
  showValidationSummary(errors, containerId = 'validation-summary') {
    let container = document.getElementById(containerId);
    
    if (errors.length === 0) {
      if (container) container.remove();
      return;
    }

    if (!container) {
      container = document.createElement('div');
      container.id = containerId;
      container.className = 'zl-validation-summary';
      
      // Insertar al principio del formulario o donde sea apropiado
      const form = document.querySelector('form') || document.body;
      form.insertBefore(container, form.firstChild);
    }

    container.innerHTML = `
      <h4>⚠️ Errores de validación:</h4>
      <ul>
        ${errors.map(error => `<li>${error.message}</li>`).join('')}
      </ul>
    `;
  }

  /**
   * Limpia todos los errores de validación
   */
  clearAllErrors() {
    // Limpiar clases de error
    document.querySelectorAll('.zl-input-error, .zl-input-valid').forEach(el => {
      el.classList.remove('zl-input-error', 'zl-input-valid');
    });

    // Limpiar mensajes de error
    this.errorElements.forEach(element => element.remove());
    this.errorElements.clear();

    // Limpiar resumen de validación
    const summary = document.getElementById('validation-summary');
    if (summary) summary.remove();
  }
}

// Crear instancia global
const validationSystem = new ValidationSystem();

// Exportar para uso global
window.ValidationSystem = ValidationSystem;
window.validationSystem = validationSystem;

// Helpers globales
window.validateField = (field, value) => validationSystem.validateField(field, value);
window.validateAll = (data) => validationSystem.validateAll(data);
window.initValidation = () => validationSystem.initializeRealTimeValidation();