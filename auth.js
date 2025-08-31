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
    setTimeout(async () => {
      if (window.subscriptionService && session.user) {
        console.log('🔍 Verificando elegibilidad para trial automático...');
        
        try {
          const isEligible = await window.subscriptionService.isEligibleForTrial(session.user.id);
          
          if (isEligible) {
            console.log('🎁 Usuario elegible para trial, activando automáticamente...');
            
            try {
              const trial = await window.subscriptionService.activateTrialForNewUser(session.user.id);
              
              if (trial) {
                console.log('✅ Trial activado automáticamente para nuevo usuario');
                
                // Mostrar notificación de bienvenida
                setTimeout(() => {
                  const welcomeModal = document.createElement('div');
                  welcomeModal.className = 'subscription-modal';
                  welcomeModal.innerHTML = `
                    <div class="modal-overlay"></div>
                    <div class="modal-content" style="max-width: 400px; text-align: center;">
                      <h2 style="color: var(--terminal-green); margin-bottom: 20px;">🎉 ¡Bienvenido a ZETALAB!</h2>
                      <p style="margin-bottom: 20px; line-height: 1.6;">
                        ¡Perfecto! Hemos activado automáticamente tu <strong>prueba gratuita de 7 días</strong> con acceso completo a todas las funciones premium.
                      </p>
                      <div style="background: var(--bg-tertiary); padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                        <p style="margin: 0; color: var(--terminal-green); font-weight: 600;">
                          ✅ Guardado ilimitado de piezas<br>
                          ✅ Generación de presupuestos<br>
                          ✅ Perfiles personalizados<br>
                          ✅ Autocompletado desde URLs<br>
                        </p>
                      </div>
                      <button onclick="this.closest('.subscription-modal').remove(); window.location.reload();" 
                              style="padding: 12px 24px; background: var(--terminal-green); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
                        🚀 ¡Empezar a usar ZETALAB!
                      </button>
                    </div>
                  `;
                  
                  document.body.appendChild(welcomeModal);
                  setTimeout(() => welcomeModal.classList.add('show'), 10);
                }, 1000);
              }
            } catch (error) {
              console.log('ℹ️  No se pudo activar trial automático, usuario puede activarlo manualmente:', error.message);
            }
          } else {
            console.log('ℹ️  Usuario no elegible para trial automático');
          }
        } catch (error) {
          console.log('ℹ️  Error verificando elegibilidad para trial:', error.message);
        }
      }
    }, 2000); // Delay para asegurar que los servicios estén cargados
    
  } catch (error) {
    console.log('Sistema de suscripciones no disponible:', error);
  }
})();
