/* ==============================
   Test Script for Access Control System
   Para verificar que el sistema funcione correctamente
============================== */

(function() {
  // Esperar a que el DOM esté listo
  document.addEventListener('DOMContentLoaded', () => {
    console.log('🧪 Test de Access Control iniciado');
    
    // Test 1: Verificar que el sistema esté cargado
    setTimeout(() => {
      if (window.accessControl) {
        console.log('✅ Test 1 passed: AccessControl está disponible');
      } else {
        console.error('❌ Test 1 failed: AccessControl no está disponible');
      }
      
      // Test 2: Verificar función de verificación de características
      if (typeof window.checkFeatureAccess === 'function') {
        console.log('✅ Test 2 passed: checkFeatureAccess está disponible');
      } else {
        console.error('❌ Test 2 failed: checkFeatureAccess no está disponible');
      }
      
      // Test 3: Verificar características específicas
      const features = [
        'piece-saving',
        'export-html',
        'auto-url-complete',
        'advanced-presets',
        'piece-management',
        'version-history'
      ];
      
      console.log('🔍 Verificando acceso a características:');
      features.forEach(feature => {
        const hasAccess = window.checkFeatureAccess(feature);
        console.log(`  ${feature}: ${hasAccess ? '✅ Permitido' : '❌ Requiere Premium'}`);
      });
      
      // Test 4: Verificar elementos con indicadores premium
      const premiumElements = document.querySelectorAll('.premium-indicator');
      console.log(`🏷️ Encontrados ${premiumElements.length} indicadores premium en la página`);
      
      // Test 5: Verificar botones protegidos
      const protectedButtons = [
        { id: 'btnSavePiece', feature: 'piece-saving' },
        { id: 'btnQuote', feature: 'export-html' },
        { id: 'btnAutoFromUrl', feature: 'auto-url-complete' },
        { id: 'btnSavePreset', feature: 'advanced-presets' }
      ];
      
      protectedButtons.forEach(({ id, feature }) => {
        const btn = document.getElementById(id);
        if (btn) {
          const hasAccess = window.checkFeatureAccess(feature);
          console.log(`🔘 ${id}: ${hasAccess ? 'Disponible' : 'Protegido por Premium'}`);
        }
      });
      
    }, 2000); // Esperar 2 segundos para que todo se inicialice
    
    // Test de eventos
    window.addEventListener('accessControlReady', (e) => {
      console.log('🎉 Evento accessControlReady disparado:', e.detail);
    });
    
    window.addEventListener('subscriptionChanged', () => {
      console.log('📡 Evento subscriptionChanged detectado');
    });
  });
  
  // Función helper para testear manualmente
  window.testAccessControl = {
    // Simular cambio de suscripción para testing
    simulateSubscriptionChange: (hasSubscription = true) => {
      // Mock del estado de suscripción
      const originalCheck = window.checkFeatureAccess;
      window.checkFeatureAccess = (featureId) => {
        // Si la característica no es premium, siempre permitir
        if (!window.accessControl?.premiumFeatures?.has(featureId)) {
          return true;
        }
        return hasSubscription;
      };
      
      // Disparar evento de cambio
      window.dispatchEvent(new Event('subscriptionChanged'));
      
      console.log(`🎭 Simulando usuario ${hasSubscription ? 'CON' : 'SIN'} suscripción`);
    },
    
    // Restaurar función original
    restore: () => {
      if (window.accessControl) {
        window.checkFeatureAccess = (featureId) => {
          return window.accessControl.hasFeatureAccess(featureId);
        };
      }
      console.log('🔄 Estado original restaurado');
    },
    
    // Mostrar estado actual
    showStatus: () => {
      const isInitialized = window.accessControl?.isInitialized;
      const hasSubscription = window.accessControl?.hasActiveSubscription();
      
      console.log('📊 Estado actual del Access Control:');
      console.log(`  - Inicializado: ${isInitialized ? '✅' : '❌'}`);
      console.log(`  - Suscripción activa: ${hasSubscription ? '✅' : '❌'}`);
      
      if (window.accessControl?.subscriptionStatus) {
        console.log(`  - Plan: ${window.accessControl.subscriptionStatus.planType}`);
      }
    }
  };
  
  console.log('🧪 Test utilities disponibles en window.testAccessControl');
  console.log('   - simulateSubscriptionChange(true/false)');
  console.log('   - restore()');
  console.log('   - showStatus()');
})();