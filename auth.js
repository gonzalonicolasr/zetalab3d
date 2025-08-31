// Archivo ES Module (lo cargas con type="module" en el HTML)
const ensureSupabase = async () => {
  if (window.supabase && window.supabase.createClient) return window.supabase.createClient;
  const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  return mod.createClient;
};

(async () => {
  const createClient = await ensureSupabase();

  // SEGURIDAD: Centralizar configuración y evitar duplicación de credenciales
  const getSupabaseConfig = () => {
    return {
      url: window.SUPABASE_URL || localStorage.getItem('SUPABASE_URL') || "https://fwmyiovamcxvinoxnput.supabase.co",
      key: window.SUPABASE_ANON_KEY || localStorage.getItem('SUPABASE_ANON_KEY') || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3bXlpb3ZhbWN4dmlub3hucHV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzAzODksImV4cCI6MjA3MTc0NjM4OX0.x94-SZj7-BR9CGMzeujkjyk_7iItajoHKkGRgIYPUTc"
    };
  };
  const config = getSupabaseConfig();

  const supa = createClient(config.url, config.key);

  // MANEJO DE ERRORES: Añadir try-catch para getSession
  let session;
  try {
    const { data, error } = await supa.auth.getSession();
    if (error) {
      console.error('Error obteniendo sesión:', error);
      window.location.href = 'index.html';
      return;
    }
    session = data.session;
  } catch (error) {
    console.error('Error de conexión:', error);
    window.location.href = 'index.html';
    return;
  }
  
  if (!session) {
    window.location.href = 'index.html';
    return;
  }

  // Exponer global para que otras partes lo usen si hace falta luego (guardado a Supabase, etc.)
  window.supa = supa;
  window.currentUser = session.user;

  // Enhanced Auth Bar with animations
  const bar = document.createElement('div');
  bar.id = 'auth-bar';
  bar.innerHTML = `
    <span id="auth-email"></span>
    <button id="logout-btn" class="ripple">Salir</button>
  `;
  document.body.appendChild(bar);

  // Set email with typing animation
  const emailElement = document.getElementById('auth-email');
  const email = session.user?.email || 'Cuenta';
  emailElement.textContent = email;

  // Enhanced logout with confirmation and animation
  const logoutBtn = document.getElementById('logout-btn');
  logoutBtn.addEventListener('click', async (e) => {
    // Add loading state
    logoutBtn.classList.add('loading');
    logoutBtn.textContent = 'Saliendo...';
    
    try {
      // Add ripple effect position
      const rect = logoutBtn.getBoundingClientRect();
      const ripple = logoutBtn.querySelector('::after');
      
      await supa.auth.signOut();
      
      // Success animation before redirect
      logoutBtn.classList.remove('loading');
      logoutBtn.classList.add('success-flash');
      logoutBtn.textContent = '¡Hasta luego!';
      
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 800);
      
    } catch (error) {
      logoutBtn.classList.remove('loading');
      logoutBtn.classList.add('error-shake');
      logoutBtn.textContent = 'Error';
      
      setTimeout(() => {
        logoutBtn.classList.remove('error-shake');
        logoutBtn.textContent = 'Salir';
      }, 1000);
    }
  });

  // Add hover effect for email truncation on small screens
  emailElement.addEventListener('mouseenter', () => {
    emailElement.style.maxWidth = 'none';
    emailElement.style.whiteSpace = 'nowrap';
  });

  emailElement.addEventListener('mouseleave', () => {
    emailElement.style.maxWidth = '';
    emailElement.style.whiteSpace = '';
  });

  supa.auth.onAuthStateChange((_event, sess) => {
    if (!sess) window.location.href = 'index.html';
  });

  // Integrar sistema de suscripciones y trial automático
  try {
    // Solo disparar evento para inicializar sistema - sin botones de upgrade
    window.dispatchEvent(new Event('userReady'));
    console.log('✅ Sistema de autenticación cargado - solo botón Suscripciones');
    
    // Verificar si es la primera vez que el usuario se loguea y activar trial automático
    // Esto funciona tanto para usuarios OAuth como para usuarios de email/password
    setTimeout(async () => {
      if (window.subscriptionService && session.user) {
        console.log('🔍 Verificando elegibilidad para trial automático...');
        
        // Detectar si viene de OAuth basándose en los metadata del usuario
        const isOAuthUser = session.user.app_metadata?.provider && 
                           session.user.app_metadata.provider !== 'email';
        const authProvider = session.user.app_metadata?.provider || 'email';
        
        if (isOAuthUser) {
          console.log(`🔗 Usuario autenticado via OAuth (${authProvider})`);
        }
        
        try {
          const isEligible = await window.subscriptionService.isEligibleForTrial(session.user.id);
          
          if (isEligible) {
            console.log(`🎁 Usuario elegible para trial (${authProvider}), activando automáticamente...`);
            
            try {
              const trial = await window.subscriptionService.activateTrialForNewUser(session.user.id);
              
              if (trial) {
                console.log(`✅ Trial activado automáticamente para nuevo usuario (${authProvider})`);
                
                // Personalizar mensaje de bienvenida según el método de autenticación
                const welcomeTitle = isOAuthUser ? 
                  `🎉 ¡Bienvenido via ${authProvider.charAt(0).toUpperCase() + authProvider.slice(1)}!` : 
                  '🎉 ¡Bienvenido a ZETALAB!';
                
                const welcomeText = isOAuthUser ?
                  `¡Perfecto! Te conectaste exitosamente con ${authProvider.charAt(0).toUpperCase() + authProvider.slice(1)} y hemos activado automáticamente tu <strong>prueba gratuita de 7 días</strong> con acceso completo a todas las funciones premium.` :
                  '�Perfecto! Hemos activado automáticamente tu <strong>prueba gratuita de 7 días</strong> con acceso completo a todas las funciones premium.';
                
                // Mostrar popup de bienvenida con estructura de modal mejorada
                setTimeout(() => {
                  window.showWelcomePopup && window.showWelcomePopup(authProvider, true);
                }, 500);
              }
            } catch (error) {
              console.log(`ℹ️  No se pudo activar trial automático para usuario ${authProvider}, usuario puede activarlo manualmente:`, error.message);
            }
          } else {
            console.log(`ℹ️  Usuario ${authProvider} no elegible para trial automático`);
          }
        } catch (error) {
          console.log(`ℹ️  Error verificando elegibilidad para trial (${authProvider}):`, error.message);
        }
      }
    }, 2000); // Delay para asegurar que los servicios estén cargados
    
  } catch (error) {
    console.log('Sistema de suscripciones no disponible:', error);
  }
})();
