/* ==============================
   ZETALAB - Demostración de Mejoras
   Script para mostrar todas las mejoras implementadas
============================== */

/**
 * Este archivo demuestra cómo usar todas las mejoras implementadas en ZETALAB
 * Incluye ejemplos prácticos de cada sistema nuevo
 */

// =============================================================================
// 1. SISTEMA DE MANEJO DE ERRORES
// =============================================================================

console.log('📋 DEMO: Sistema de Manejo de Errores');

// Ejemplo: Manejo de errores de validación
try {
  // Simular error de validación
  throw new Error('Precio por kg debe ser un número positivo');
} catch (error) {
  ErrorHandler.handle(error, 'validation', { field: 'precioKg', value: -100 });
}

// Ejemplo: Wrapper seguro para operaciones async
const demoAsyncOperation = async () => {
  const result = await ErrorHandler.safe(async () => {
    // Simular operación que puede fallar
    if (Math.random() > 0.5) {
      throw new Error('Error de red simulado');
    }
    return 'Operación exitosa';
  }, 'network operation', 'valor por defecto');
  
  console.log('Resultado:', result);
};

demoAsyncOperation();

// =============================================================================
// 2. SISTEMA DE ESTADOS DE LOADING
// =============================================================================

console.log('⏳ DEMO: Sistema de Estados de Loading');

// Ejemplo: Loading en botón
const demoButtonLoading = () => {
  const button = document.createElement('button');
  button.textContent = 'Calcular Precio';
  button.id = 'demo-button';
  document.body.appendChild(button);

  // Simular operación con loading
  setLoading('demo-calc', true, {
    type: 'button',
    element: button,
    message: 'Calculando...'
  });

  setTimeout(() => {
    setLoading('demo-calc', false);
    console.log('✅ Loading de botón completado');
  }, 2000);
};

// Ejemplo: Loading con wrapper automático
const demoAutoLoading = async () => {
  const result = await withLoading('demo-operation', async () => {
    console.log('⏳ Operación iniciada...');
    await new Promise(resolve => setTimeout(resolve, 1500));
    return 'Datos calculados';
  }, { type: 'global', message: 'Procesando datos...' });

  console.log('✅ Resultado:', result);
};

// =============================================================================
// 3. SISTEMA DE VALIDACIÓN
// =============================================================================

console.log('✅ DEMO: Sistema de Validación');

// Ejemplo: Validar campos individuales
const demoFieldValidation = () => {
  const testValues = {
    precioKg: '15000',
    multiplicador: '2.5',
    pieceName: 'Pieza de prueba',
    pieceUrl: 'https://makerworld.com/test',
    gramos: '-10' // Valor inválido
  };

  Object.entries(testValues).forEach(([field, value]) => {
    const result = validateField(field, value);
    console.log(`${field}: ${value} -> ${result.valid ? '✅' : '❌'} ${result.message || 'Válido'}`);
  });
};

// Ejemplo: Validar formulario completo
const demoFormValidation = () => {
  const formData = {
    precioKg: '17000',
    precioKwh: '598',
    gramos: '150',
    multiplicador: '0.5', // Warning: muy bajo
    pieceName: 'Test'
  };

  const validation = validateAll(formData);
  console.log('📝 Validación completa:', validation);

  if (!validation.valid) {
    console.log('❌ Errores encontrados:', validation.errors);
  }
  
  if (validation.warnings.length > 0) {
    console.log('⚠️ Warnings:', validation.warnings);
  }
};

// =============================================================================
// 4. SISTEMA DE DEBOUNCING MEJORADO
// =============================================================================

console.log('🔄 DEMO: Sistema de Debouncing');

// Ejemplo: Debounce para guardado
const demoSaveDebouncing = () => {
  let saveCount = 0;
  
  const simulateSave = (data) => {
    saveCount++;
    console.log(`💾 Guardado #${saveCount}:`, data);
  };

  // Simular múltiples calls rápidos
  console.log('📝 Simulando escritura rápida (5 cambios)...');
  for (let i = 1; i <= 5; i++) {
    setTimeout(() => {
      debounceManager.debouncedSave(
        'demo-form',
        simulateSave,
        { campo: `valor ${i}` },
        300
      );
    }, i * 50); // 50ms entre cambios
  }

  // Solo debería haber 1 guardado al final
  setTimeout(() => {
    console.log(`✅ Total de guardados: ${saveCount} (debería ser 1)`);
  }, 1000);
};

// Ejemplo: Debounce con backoff
const demoBackoffDebouncing = () => {
  console.log('🔄 Simulando debounce con backoff...');
  
  const operation = () => console.log('⚡ Operación ejecutada');
  
  // Simular muchas calls rápidas - el delay aumentará
  for (let i = 0; i < 10; i++) {
    setTimeout(() => {
      debounceManager.debounceWithBackoff(
        'backoff-demo',
        operation,
        100, // base delay
        { maxDelay: 1000, backoffFactor: 1.5 }
      );
    }, i * 20);
  }
};

// =============================================================================
// 5. INTEGRACIÓN COMPLETA - EJEMPLO REAL
// =============================================================================

console.log('🎯 DEMO: Ejemplo de Integración Completa');

const demoCompleteWorkflow = async () => {
  console.log('🚀 Iniciando flujo completo...');

  // 1. Validar datos de entrada
  const inputData = {
    precioKg: '17000',
    gramos: '150',
    horas: '2',
    multiplicador: '2'
  };

  const validation = validateAll(inputData);
  if (!validation.valid) {
    console.log('❌ Datos inválidos:', validation.errors);
    return;
  }

  // 2. Ejecutar cálculo con loading y error handling
  try {
    setLoading('complete-demo', true, { 
      type: 'global', 
      message: 'Calculando precio...' 
    });

    const result = await ErrorHandler.safe(async () => {
      // Simular cálculo
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const precioKg = Number(inputData.precioKg);
      const gramos = Number(inputData.gramos);
      const material = (gramos / 1000) * precioKg;
      
      return {
        material,
        total: material * Number(inputData.multiplicador)
      };
    }, 'price calculation');

    console.log('💰 Cálculo completado:', result);

    // 3. Guardar con debounce
    debounceManager.debouncedSave(
      'calculation-result',
      (data) => console.log('💾 Guardado:', data),
      result
    );

  } finally {
    setLoading('complete-demo', false);
  }

  console.log('✅ Flujo completo terminado');
};

// =============================================================================
// 6. ESTADÍSTICAS Y MONITORING
// =============================================================================

const demoStats = () => {
  console.log('📊 DEMO: Estadísticas del Sistema');
  
  setTimeout(() => {
    console.log('🔄 Debounce Stats:', debounceManager.getStats());
    console.log('⏳ Loading Stats:', loadingManager.getStats());
    
    // Mostrar errores capturados (si hay)
    console.log('🚨 Sistema de errores activo:', !!window.ErrorHandler);
    console.log('✅ Sistema de validación activo:', !!window.validationSystem);
  }, 3000);
};

// =============================================================================
// EJECUTAR DEMOS
// =============================================================================

const runAllDemos = async () => {
  console.log('🎬 Iniciando demos de mejoras ZETALAB...\n');

  // Esperar a que los sistemas estén listos
  await new Promise(resolve => setTimeout(resolve, 100));

  try {
    // Solo ejecutar si los sistemas están disponibles
    if (window.ErrorHandler) {
      console.log('1️⃣ Demo de manejo de errores...');
    }

    if (window.loadingManager) {
      console.log('2️⃣ Demo de loading states...');
      // demoButtonLoading(); // Comentado para no agregar elementos al DOM
      await demoAutoLoading();
    }

    if (window.validationSystem) {
      console.log('3️⃣ Demo de validación...');
      demoFieldValidation();
      demoFormValidation();
    }

    if (window.debounceManager) {
      console.log('4️⃣ Demo de debouncing...');
      demoSaveDebouncing();
      demoBackoffDebouncing();
    }

    console.log('5️⃣ Demo de integración completa...');
    await demoCompleteWorkflow();

    console.log('6️⃣ Demo de estadísticas...');
    demoStats();

  } catch (error) {
    console.error('❌ Error en demos:', error);
  }

  console.log('\n🎉 Demos completados. Revisar console para detalles.');
};

// Auto-ejecutar si el archivo se carga directamente
if (typeof window !== 'undefined') {
  // Esperar a que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runAllDemos);
  } else {
    runAllDemos();
  }
}

// Exportar funciones para uso manual
window.ZetaLabDemos = {
  runAllDemos,
  demoButtonLoading,
  demoAutoLoading,
  demoFieldValidation,
  demoFormValidation,
  demoSaveDebouncing,
  demoBackoffDebouncing,
  demoCompleteWorkflow,
  demoStats
};