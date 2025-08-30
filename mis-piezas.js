// mis-piezas.js (ESM)
// SIMPLE ACCESS CONTROL: Verificar acceso a gestión de piezas
document.addEventListener('DOMContentLoaded', async () => {
  // Esperar a que el usuario esté cargado
  if (!window.currentUser) {
    setTimeout(() => {
      document.dispatchEvent(new Event('DOMContentLoaded'));
    }, 100);
    return;
  }
  
  // Verificar suscripción premium de forma simple
  let hasAccess = false;
  try {
    if (window.subscriptionService) {
      hasAccess = await window.subscriptionService.hasActiveSubscription(window.currentUser.id);
    }
  } catch (error) {
    console.error('Error verificando acceso:', error);
  }
  
  if (!hasAccess) {
    // Mostrar mensaje simple y claro de premium requerido
    document.body.innerHTML = `
      <div class="container" style="max-width: 600px; margin: 50px auto; text-align: center;">
        <div class="card" style="padding: 40px;">
          <h1 style="color: #FFD700; margin-bottom: 20px;">⭐ Acceso Premium Requerido</h1>
          
          <div style="margin: 30px 0;">
            <h2 style="color: var(--text-primary); margin-bottom: 15px;">📁 Gestión de Piezas</h2>
            <p style="color: var(--text-secondary); font-size: 16px; line-height: 1.5;">
              Para acceder a tus piezas guardadas y gestionar tu historial de versiones, 
              necesitas una suscripción Premium activa.
            </p>
          </div>
          
          <div style="background: var(--bg-tertiary); border-radius: 12px; padding: 20px; margin: 30px 0;">
            <h3 style="color: var(--text-primary); margin-bottom: 15px;">🚀 Con Premium obtienes:</h3>
            <ul style="list-style: none; padding: 0; text-align: left; max-width: 400px; margin: 0 auto;">
              <li style="padding: 5px 0; color: var(--text-primary);">✅ Guardado ilimitado de piezas</li>
              <li style="padding: 5px 0; color: var(--text-primary);">✅ Historial completo de versiones</li>
              <li style="padding: 5px 0; color: var(--text-primary);">✅ Exportación de presupuestos HTML</li>
              <li style="padding: 5px 0; color: var(--text-primary);">✅ Perfiles de gastos fijos</li>
              <li style="padding: 5px 0; color: var(--text-primary);">✅ Autocompletado desde URLs</li>
            </ul>
          </div>
          
          <div style="margin-top: 30px;">
            <button onclick="getSubscriptionAccess()" style="
              background: linear-gradient(135deg, #4f9a65, #5a9d6b); 
              color: white; 
              border: none; 
              padding: 16px 32px; 
              border-radius: 12px; 
              font-size: 18px; 
              font-weight: 600; 
              cursor: pointer; 
              margin: 10px;
              transition: all 0.3s ease;
              box-shadow: 0 4px 15px rgba(79, 154, 101, 0.3);
            " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(79, 154, 101, 0.4)'" 
               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(79, 154, 101, 0.3)'">
              💳 Obtener Acceso Premium ($5.000/mes)
            </button>
            
            <br>
            
            <button onclick="window.location.href='calculadora.html'" style="
              background: var(--bg-tertiary); 
              color: var(--text-primary); 
              border: 1px solid var(--border-primary); 
              padding: 12px 24px; 
              border-radius: 8px; 
              font-size: 14px; 
              cursor: pointer; 
              margin: 10px;
              transition: all 0.2s ease;
            " onmouseover="this.style.background='var(--bg-hover)'" 
               onmouseout="this.style.background='var(--bg-tertiary)'">
              ← Volver a la Calculadora
            </button>
          </div>
        </div>
      </div>
      
      <script>
        // Función para obtener acceso premium
        function getSubscriptionAccess() {
          if (window.subscriptionService) {
            window.subscriptionService.showSubscriptionModal();
          } else {
            alert('Sistema de suscripciones no disponible. Por favor recarga la página.');
          }
        }
      </script>
    `;
    return; // No continuar con el resto del script
  }
});

// PERFORMANCE: Evitar redefinición de funciones duplicadas
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const fmt = n => isFinite(n) ? n.toLocaleString('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:2,maximumFractionDigits:2}) : '—';
const fmtDate = iso => {
  const d = new Date(iso);
  const pad2 = n => String(n).padStart(2,'0');
  return `${pad2(d.getDate())}/${pad2(d.getMonth()+1)}/${d.getFullYear()}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};

// Pequeño toast
function notify(msg){
  const n = document.createElement('div');
  n.textContent = msg;
  Object.assign(n.style, {
    position:'fixed', bottom:'16px', right:'16px',
    background:'#0f201b', color:'#e8efe9', border:'1px solid rgba(255,255,255,.08)',
    padding:'10px 12px', borderRadius:'10px', zIndex:10000, boxShadow:'0 10px 30px rgba(0,0,0,.25)'
  });
  document.body.appendChild(n);
  setTimeout(()=> n.remove(), 2500);
}

// Extrae/inyecta URL desde/para notes (si tu tabla no tiene columna URL)
function readUrlFromNotes(notes){
  if(!notes) return '';
  const m = String(notes).match(/URL:\s*(\S+)/i);
  return m ? m[1] : '';
}
function writeUrlIntoNotes(existingNotes, url){
  const clean = (existingNotes || '').split('\n').filter(l=>!/^URL:/i.test(l)).join('\n').trim();
  const line = url ? `URL: ${url}` : '';
  return [line, clean].filter(Boolean).join('\n');
}

// Render de una tarjeta de pieza
function renderPieceCard(piece){
  const card = document.createElement('section');
  card.className = 'card';
  card.style.paddingTop = '12px';

  const urlFromNotes = readUrlFromNotes(piece.notes);

  card.innerHTML = `
    <div class="row" style="align-items:flex-start; gap:12px">
      <img src="${piece.image_url || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='}"
           alt="" style="width:96px;height:96px;object-fit:cover;border-radius:12px;border:1px solid rgba(255,255,255,.08)">

      <div style="flex:1 1 auto; min-width:260px">
        <div class="row">
          <div class="col">
            <label>Nombre</label>
            <input type="text" value="${piece.title || ''}" data-field="title">
          </div>
          <div class="col">
            <label>Precio a cobrar (último)</label>
            <input type="number" value="${piece.est_price_ars ?? ''}" data-field="est_price_ars" step="0.01">
          </div>
        </div>

        <div class="row">
          <div class="col">
            <label>URL</label>
            <input type="text" value="${urlFromNotes}" data-field="url">
          </div>
        </div>

        <div class="row">
          <div class="col">
            <label>Imagen (URL)</label>
            <input type="text" value="${piece.image_url || ''}" data-field="image_url">
          </div>
        </div>

        <div class="row" style="gap:8px; margin-top:8px">
          <button data-action="open-url">Abrir URL</button>
          <button data-action="open-calc">Abrir en calculadora</button>
          <button data-action="save">Guardar cambios</button>
          <button data-action="delete">Eliminar</button>
        </div>

        <details style="margin-top:10px" data-versions>
          <summary>Historial de versiones (<span data-count>0</span>)</summary>
          <div style="margin-top:8px" data-versions-body></div>
        </details>

        <div class="small" style="margin-top:8px">Última actualización: ${piece.updated_at ? fmtDate(piece.updated_at) : '—'}</div>
      </div>
    </div>
  `;

  // Handlers botones
  card.addEventListener('click', async (e)=>{
    const btn = e.target.closest('button');
    if(!btn) return;

    const action = btn.dataset.action;
    const getVal = name => card.querySelector(`[data-field="${name}"]`)?.value ?? '';
    const payload = {
      title: getVal('title').trim(),
      est_price_ars: parseFloat(getVal('est_price_ars')) || null,
      image_url: getVal('image_url').trim() || null,
      url: getVal('url').trim()
    };

    if(action === 'open-url'){
      const u = payload.url;
      if(u) window.open(u, '_blank');
      else notify('No hay URL');
    }

    if(action === 'open-calc'){
      try {
        // Cargar últimos parámetros de la versión más reciente, si existen
        const { data: ver, error } = await window.supa
        .from('piece_versions')
        .select('params, created_at')
        .eq('piece_id', piece.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

        if (error) {
          console.error('Error cargando versión:', error);
          notify('⚠️ Error cargando datos de la pieza');
        }

        // Preparar datos para la calculadora
        const calcData = {};
        
        // Si hay una versión guardada, usar sus parámetros
        if (ver?.params?.inputs) {
          const p = ver.params.inputs;
          Object.assign(calcData, {
            precioKg: p.precioKg || '',
            precioKwh: p.precioKwh || '',
            consumoW: p.consumoW || '',
            horasDesgaste: p.horasDesgaste || '',
            precioRepuestos: p.precioRepuestos || '',
            margenError: p.margenError || '',
            horas: p.horas || '',
            minutos: p.minutos || '',
            gramos: p.gramos || '',
            insumos: p.insumos || '',
            multiplicador: p.multiplicador || '',
            mlFee: p.mlFee || '',
            pieceName: payload.title || piece.title || '',
            pieceUrl: p.url || payload.url || '',
            imageUrl: p.image || payload.image_url || ''
          });
          
          notify('✅ Cargando pieza con datos guardados');
        } else {
          // Si no hay versión guardada, usar datos básicos de la pieza
          Object.assign(calcData, {
            pieceName: payload.title || piece.title || '',
            pieceUrl: payload.url || '',
            imageUrl: payload.image_url || '',
            gramos: piece.est_weight_grams || '',
            horas: Math.floor((piece.est_print_time_min || 0) / 60) || '',
            minutos: (piece.est_print_time_min || 0) % 60 || ''
          });
          
          notify('📝 Cargando pieza con datos básicos');
        }

        // Guardar en localStorage para pre-cargar en la calculadora
        localStorage.setItem('zl_calc_form', JSON.stringify(calcData));
        
        // Indicador para mostrar un mensaje en la calculadora
        localStorage.setItem('zl_opened_from_pieces', 'true');

        window.location.href = 'calculadora.html';
      } catch (err) {
        console.error('Error en open-calc:', err);
        notify('❌ Error abriendo pieza en calculadora');
      }
    }

    if(action === 'save'){
      try{
        // SEGURIDAD: Validar entrada antes de procesar
        if (!payload.title || payload.title.length > 200) {
          notify('❌ Nombre de pieza inválido (máx 200 caracteres)');
          return;
        }
        
        if (payload.est_price_ars && (payload.est_price_ars < 0 || payload.est_price_ars > 999999999)) {
          notify('❌ Precio fuera de rango válido');
          return;
        }
        
        const notes = writeUrlIntoNotes(piece.notes || '', payload.url);
        const { error } = await window.supa
        .from('pieces')
        .update({
          title: payload.title || null,
          est_price_ars: payload.est_price_ars,
          image_url: payload.image_url,
          notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', piece.id)
        .eq('user_id', window.currentUser.id);
        if(error) throw error;
        notify('✅ Cambios guardados');
      }catch(err){
        console.error('Error guardando pieza:', err);
        notify('❌ Error al guardar: ' + (err?.message || 'Error desconocido'));
      }
    }

    if(action === 'delete'){
      if(!confirm('¿Eliminar esta pieza? Se conservarán versiones sólo si tu RLS lo permite.')) return;
      try{
        // TRANSACCIÓN: Primero borro versiones (si tus políticas lo permiten)
        const { error: versionsError } = await window.supa.from('piece_versions').delete().eq('piece_id', piece.id).eq('user_id', window.currentUser.id);
        if (versionsError) {
          console.warn('Error eliminando versiones:', versionsError);
        }
        
        // Luego la pieza
        const { error } = await window.supa.from('pieces').delete().eq('id', piece.id).eq('user_id', window.currentUser.id);
        if(error) throw error;
        
        card.remove();
        notify('🗑️ Pieza eliminada');
        updateEmptyState();
      }catch(err){
        console.error('Error eliminando pieza:', err);
        notify('❌ No se pudo eliminar: ' + (err?.message || 'Error desconocido'));
      }
    }
  });

  // Cargar versiones al abrir <details>
  const details = $('[data-versions]', card);
  details.addEventListener('toggle', async ()=>{
    if(!details.open) return;
    const body = $('[data-versions-body]', details);
    body.innerHTML = 'Cargando historial…';

    const { data: versions, error } = await window.supa
    .from('piece_versions')
    .select('id, total, ml_price, params, created_at')
    .eq('piece_id', piece.id)
    .eq('user_id', window.currentUser.id)
    .order('created_at', { ascending: false });

    if(error){
      console.error(error);
      body.textContent = 'Error al cargar el historial';
      return;
    }

    $('[data-count]', details).textContent = versions.length;

    body.innerHTML = versions.map(v=>{
      const p = v.params?.inputs || {};
      const chips = [
        p.precioKg ? `KG: ${p.precioKg}` : '',
        p.precioKwh ? `KWh: ${p.precioKwh}` : '',
        p.consumoW ? `W: ${p.consumoW}` : '',
        p.horasDesgaste ? `Vida(h): ${p.horasDesgaste}` : '',
        p.precioRepuestos ? `Repuestos: ${p.precioRepuestos}` : '',
        p.margenError ? `Err%: ${p.margenError}` : '',
        p.horas ? `H: ${p.horas}` : '',
        p.minutos ? `Min: ${p.minutos}` : '',
        p.gramos ? `g: ${p.gramos}` : '',
        p.insumos ? `Insumos: ${p.insumos}` : '',
        p.multiplicador ? `x: ${p.multiplicador}` : ''
      ].filter(Boolean).map(t=>`<span class="pill" style="padding:2px 8px">${t}</span>`).join(' ');

      return `
        <div class="card" style="background:#0f1f1a; border-color:#1a2f26; margin-bottom:8px">
          <div class="row" style="justify-content:space-between; align-items:center">
            <div><strong>${fmtDate(v.created_at)}</strong> — Total: <strong>${fmt(v.total)}</strong></div>
            <div class="small">ML: ${fmt(v.ml_price)}</div>
          </div>
          <div style="margin-top:6px">${chips || '<span class="small muted">Sin detalles</span>'}</div>
          <div class="row" style="margin-top:8px">
            <button data-restore="${v.id}">Restaurar esta versión</button>
          </div>
        </div>
      `;
    }).join('');

    // Restaurar versión → setear formulario en localStorage y abrir calculadora
    $$('button[data-restore]', body).forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const id = btn.getAttribute('data-restore');
        const v = versions.find(x=>String(x.id)===String(id));
        if(!v?.params?.inputs){
          notify('No hay parámetros guardados en esta versión');
          return;
        }
        
        try {
          const p = v.params.inputs;
          const state = {
            precioKg: p.precioKg || '',
            precioKwh: p.precioKwh || '',
            consumoW: p.consumoW || '',
            horasDesgaste: p.horasDesgaste || '',
            precioRepuestos: p.precioRepuestos || '',
            margenError: p.margenError || '',
            horas: p.horas || '',
            minutos: p.minutos || '',
            gramos: p.gramos || '',
            insumos: p.insumos || '',
            multiplicador: p.multiplicador || '',
            mlFee: p.mlFee || '',
            pieceName: piece.title || '',
            pieceUrl: p.url || '',
            imageUrl: p.image || piece.image_url || ''
          };
          
          localStorage.setItem('zl_calc_form', JSON.stringify(state));
          localStorage.setItem('zl_opened_from_pieces', 'version_restored');
          localStorage.setItem('zl_restored_version_date', fmtDate(v.created_at));
          
          notify(`✅ Restaurando versión del ${fmtDate(v.created_at)}`);
          
          setTimeout(() => {
            window.location.href = 'calculadora.html';
          }, 800);
        } catch (err) {
          console.error('Error restaurando versión:', err);
          notify('❌ Error restaurando versión');
        }
      });
    });
  });

  return card;
}

function updateEmptyState(){
  const list = $('#list');
  const empty = $('#empty');
  empty.style.display = list.children.length ? 'none' : '';
}

// Carga inicial
async function loadPieces(){
  // espera a que auth.js exponga supa/user
  if(!window.supa || !window.currentUser){
    setTimeout(loadPieces, 50);
    return;
  }

  const list = $('#list');
  list.innerHTML = '';

  const { data, error } = await window.supa
  .from('pieces')
  .select('id, title, est_price_ars, image_url, notes, updated_at')
  .eq('user_id', window.currentUser.id)
  .order('updated_at', { ascending: false });

  if(error){
    console.error(error);
    notify('❌ No se pudieron cargar tus piezas');
    return;
  }

  if(!data || !data.length){
    updateEmptyState();
    return;
  }

  data.forEach(p => list.appendChild(renderPieceCard(p)));
  updateEmptyState();
}

loadPieces();
