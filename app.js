/* ==============================
   Config de Supabase / Edge Function
============================== */
// Centralizar configuración para evitar duplicación
const getSupabaseConfig = () => {
  return {
    url: window.SUPABASE_URL || "https://fwmyiovamcxvinoxnput.supabase.co",
    key: window.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3bXlpb3ZhbWN4dmlub3hucHV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNzAzODksImV4cCI6MjA3MTc0NjM4OX0.x94-SZj7-BR9CGMzeujkjyk_7iItajoHKkGRgIYPUTc"
  };
};
const config = getSupabaseConfig();
const OG_PROXY = `${config.url}/functions/v1/og-proxy`;

/* ==============================
   Security / Sanitization
============================== */
// HTML sanitization utility
const sanitizeHtml = (str) => {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
};

// Validate URL format
const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

/* ==============================
   Helpers / formato / estado
============================== */
// DOM utilities - with caching for performance
const DOMCache = new Map();
const $ = (id) => {
  if (!DOMCache.has(id)) {
    DOMCache.set(id, document.getElementById(id));
  }
  return DOMCache.get(id);
};

// Format currency with better error handling
const fmt = (n) => {
  try {
    return isFinite(n) && n !== null && n !== undefined
      ? n.toLocaleString("es-AR", {
          style: "currency",
          currency: "ARS",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : "—";
  } catch (error) {
    console.warn('Error formatting currency:', error);
    return "—";
  }
};

// Enhanced number parsing with validation
const number = (v, defaultValue = 0) => {
  if (v === null || v === undefined || v === '') return defaultValue;
  const x = Number(v);
  return Number.isFinite(x) && x >= 0 ? x : defaultValue;
};

/* ==============================
   Campos que persisten en localStorage
============================== */
// Implementar debounce para evitar writes excesivos
let saveStateTimeout = null;
const SAVE_DELAY = 300; // 300ms de debounce
const fields = [
  "precioKg",
  "precioKwh",
  "consumoW",
  "horasDesgaste",
  "precioRepuestos",
  "margenError",
  "horas",
  "minutos",
  "gramos",
  "insumos",
  "multiplicador",
  "mlFee",
  "pieceName",
  "pieceUrl",
  "imageUrl",
];

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem("zl_calc_form") || "{}");
    fields.forEach((k) => {
      if (s[k] !== undefined && $(k)) $(k).value = s[k];
    });
  } catch {}
}
function saveState() {
  // Usar el nuevo sistema de debouncing mejorado
  if (window.debounceManager) {
    const data = {};
    fields.forEach((k) => (data[k] = $(k)?.value ?? ""));
    
    debounceManager.debouncedSave(
      'zl_calc_form',
      (data) => localStorage.setItem("zl_calc_form", JSON.stringify(data)),
      data,
      SAVE_DELAY
    );
  } else {
    // Fallback al sistema anterior si no está disponible
    if (saveStateTimeout) {
      clearTimeout(saveStateTimeout);
    }
    
    saveStateTimeout = setTimeout(() => {
      try {
        const s = {};
        fields.forEach((k) => (s[k] = $(k)?.value ?? ""));
        localStorage.setItem("zl_calc_form", JSON.stringify(s));
      } catch (error) {
        console.error('Error guardando estado:', error);
        toast('❌ Error guardando datos localmente');
      }
    }, SAVE_DELAY);
  }
}
fields.forEach((k) => $(k)?.addEventListener("input", saveState));

/* ==============================
   Botones rápidos (multiplicador / ML fee)
============================== */
document.addEventListener("click", (e) => {
  const t = e.target;
  if (t.matches("button[data-mult]")) {
    $("multiplicador").value = t.dataset.mult;
    saveState();
  }
  if (t.matches("button[data-ml]")) {
    $("mlFee").value = t.dataset.ml;
    saveState();
  }
});

/* ==============================
   Reset
============================== */
$("btnReset")?.addEventListener("click", () => {
  localStorage.removeItem("zl_calc_form");
  fields.forEach((k) => {
    if ($(k)) $(k).value = "";
  });
  updateImagePreview("");
  render(null);
});

/* ==============================
   Cálculo core
============================== */
// Cache for expensive calculations
const calculationCache = new Map();
const getCacheKey = (inputs) => JSON.stringify(inputs);

function calcular() {
  // Create input object for caching
  const inputs = {
    precioKg: $("precioKg").value,
    precioKwh: $("precioKwh").value,
    consumoW: $("consumoW").value,
    horasDesgaste: $("horasDesgaste").value,
    precioRepuestos: $("precioRepuestos").value,
    margenError: $("margenError").value,
    horas: $("horas").value,
    minutos: $("minutos").value,
    gramos: $("gramos").value,
    insumos: $("insumos").value,
    multiplicador: $("multiplicador").value,
    mlFee: $("mlFee").value
  };

  // Check cache first
  const cacheKey = getCacheKey(inputs);
  if (calculationCache.has(cacheKey)) {
    return calculationCache.get(cacheKey);
  }

  // Parse inputs with validation
  const precioKg = number(inputs.precioKg, 0);
  const precioKwh = number(inputs.precioKwh, 0);
  const consumoW = number(inputs.consumoW, 0);
  const horasDesgaste = number(inputs.horasDesgaste, 1);
  const precioRepuestos = number(inputs.precioRepuestos, 0);
  const margenErrorPct = number(inputs.margenError, 0) / 100;

  const horas = number(inputs.horas, 0);
  const minutos = number(inputs.minutos, 0);
  const gramos = number(inputs.gramos, 0);
  const insumos = number(inputs.insumos, 0);

  const multiplicador = number(inputs.multiplicador, 1);
  const mlFeePct = number(inputs.mlFee, 0) / 100;

  const totalHoras = horas + minutos / 60;

  // Material
  const kg = gramos / 1000;
  const material = kg * precioKg;

  // Energía
  const kwh = (consumoW * totalHoras) / 1000;
  const energia = kwh * precioKwh;

  // Desgaste (repuestos prorrateados por hora)
  // SEGURIDAD: Validar que horasDesgaste no sea 0 o negativo
  const horasDesgasteSeguro = Math.max(horasDesgaste, 1);
  if (horasDesgaste <= 0) {
    console.warn('⚠️ Horas de desgaste inválidas, usando valor por defecto de 1');
  }
  const repuestoHora = precioRepuestos / horasDesgasteSeguro;
  const desgaste = repuestoHora * totalHoras;

  // Base para margen/error (SIN insumos)
  const baseML = material + energia + desgaste;

    // VALIDACIÓN: Verificar que el margen de error esté en un rango razonable
  const margenErrorSeguro = Math.min(Math.max(margenErrorPct, 0), 2); // Máx 200%
  if (margenErrorPct > 2) {
    console.warn('⚠️ Margen de error muy alto, limitado a 200%');
  }
  const errorAmt = baseML * margenErrorSeguro;

  // Subtotal para margen (sin insumos)
  const subtotalSinInsumos = baseML + errorAmt;

  // VALIDACIÓN: Verificar que el multiplicador esté en un rango razonable
  const multiplicadorSeguro = Math.min(Math.max(multiplicador, 1), 20); // Máx 20x
  if (multiplicador > 20) {
    console.warn('⚠️ Multiplicador muy alto, limitado a 20x');
  }
  const precioSinInsumosConMargen = subtotalSinInsumos * multiplicadorSeguro;

  // Agregar insumos al final
  const totalCobrar = precioSinInsumosConMargen + insumos;

  // VALIDACIÓN: Verificar que la comisión ML esté en un rango razonable
  const mlFeePctSeguro = Math.min(Math.max(mlFeePct, 0), 0.5); // Máx 50%
  if (mlFeePct > 0.5) {
    console.warn('⚠️ Comisión ML muy alta, limitada a 50%');
  }
  const precioML = totalCobrar * (1 + mlFeePctSeguro);

  // Para resumen clásico
  const costoLyM = material + energia;

  // Base visible informativa
  const base = material + energia + desgaste + insumos;
  const subtotal = material + energia + desgaste + errorAmt + insumos;

  const result = {
    material,
    energia,
    desgaste,
    insumos,
    kg,
    kwh,
    repuestoHora,
    baseML,
    errorAmt,
    subtotalSinInsumos,
    precioSinInsumosConMargen,
    totalCobrar,
    precioML,
    base,
    subtotal,
    costoLyM,
    margenErrorPct,
    multiplicador,
    mlFeePct,
  };

  // Cache result (limit cache size to prevent memory leaks)
  if (calculationCache.size > 50) {
    const firstKey = calculationCache.keys().next().value;
    calculationCache.delete(firstKey);
  }
  calculationCache.set(cacheKey, result);

  return result;
}

function render(r) {
  const set = (id, val) => ($(id).textContent = val);
  if (!r) {
    [
      "precioSugerido",
      "outMaterial",
      "outEnergia",
      "outDesgaste",
      "outInsumos",
      "outSubtotal",
      "matDetalle",
      "enerDetalle",
      "desgDetalle",
      "errorDetalle",
      "classicMaterial",
      "classicLuz",
      "classicDesgaste",
      "classicError",
      "classicInsumos",
      "classicLyM",
      "classicCostoTotal",
      "classicTotalCobrar",
      "classicML",
      "mlDetalle",
    ].forEach((id) => set(id, "—"));
    return;
  }
  set("precioSugerido", fmt(r.totalCobrar));
  set("outMaterial", fmt(r.material));
  set("outEnergia", fmt(r.energia));
  set("outDesgaste", fmt(r.desgaste));
  set("outInsumos", fmt(r.insumos));
  set("outSubtotal", fmt(r.subtotal));
  $("matDetalle").textContent = `${r.kg.toFixed(3)} kg × ${fmt(
      r.material / Math.max(r.kg, 1e-9)
  )}`;
  $("enerDetalle").textContent = `${r.kwh.toFixed(3)} kWh`;
  $("desgDetalle").textContent = `${fmt(r.repuestoHora)}/h × ${(
      r.desgaste / Math.max(r.repuestoHora, 1e-9)
  ).toFixed(2)} h`;
  $("errorDetalle").textContent = `+${(r.margenErrorPct * 100).toFixed(
      0
  )}%  × multiplicador ${r.multiplicador}`;

  set("classicMaterial", fmt(r.material));
  set("classicLuz", fmt(r.energia));
  set("classicDesgaste", fmt(r.desgaste));
  set("classicError", fmt(r.errorAmt));
  set("classicInsumos", fmt(r.insumos));
  set("classicLyM", fmt(r.costoLyM));
  set("classicCostoTotal", fmt(r.subtotal));
  set("classicTotalCobrar", fmt(r.totalCobrar));
  set("classicML", fmt(r.precioML));
  $("mlDetalle").textContent = `(+${(r.mlFeePct * 100).toFixed(
      2
  )}% sobre total)`;
}

$("btnCalc")?.addEventListener("click", () => {
  const r = calcular();
  render(r);
  saveState();
});

/* ==============================
   Presets de Gastos Fijos - Enhanced with Supabase
============================== */
let profilesCache = [];

// Leer datos actuales del formulario para crear/actualizar preset
function readFixedFromForm() {
  return {
    name: ($("presetName").value || "").trim(),
    precio_kg: Number($("precioKg").value) || 0,
    precio_kwh: Number($("precioKwh").value) || 0,
    consumo_w: Number($("consumoW").value) || 0,
    horas_desgaste: Number($("horasDesgaste").value) || 1,
    precio_repuestos: Number($("precioRepuestos").value) || 0,
    margen_error: Number($("margenError").value) || 0,
    multiplicador: Number($("multiplicador").value) || 1,
    ml_fee: Number($("mlFee").value) || 0
  };
}

// Aplicar preset al formulario
function applyFixedToForm(profile) {
  if (!profile) return;
  
  // Si es del formato legacy (localStorage), convertir
  if (profile.precioKg !== undefined) {
    $("precioKg").value = profile.precioKg || "";
    $("precioKwh").value = profile.precioKwh || "";
    $("consumoW").value = profile.consumoW || "";
    $("horasDesgaste").value = profile.horasDesgaste || "";
    $("precioRepuestos").value = profile.precioRepuestos || "";
    $("margenError").value = profile.margenError || "";
  } else {
    // Formato Supabase
    $("precioKg").value = profile.precio_kg || "";
    $("precioKwh").value = profile.precio_kwh || "";
    $("consumoW").value = profile.consumo_w || "";
    $("horasDesgaste").value = profile.horas_desgaste || "";
    $("precioRepuestos").value = profile.precio_repuestos || "";
    $("margenError").value = profile.margen_error || "";
    
    // También aplicar multiplicador y ML fee si están disponibles
    if (profile.multiplicador) $("multiplicador").value = profile.multiplicador;
    if (profile.ml_fee) $("mlFee").value = profile.ml_fee;
  }
  
  saveState();
}

// Cargar y renderizar lista de presets
async function renderPresetList() {
  const sel = $("presetList");
  if (!sel) return;
  
  try {
    // Mostrar estado de carga
    sel.innerHTML = '<option value="">⏳ Cargando perfiles...</option>';
    
    // Obtener perfiles
    let profiles = [];
    
    if (window.configProfilesService) {
      profiles = await window.configProfilesService.getProfiles();
      profilesCache = profiles; // Guardar en cache
    } else {
      // Fallback a localStorage
      const presets = JSON.parse(localStorage.getItem("zl_calc_fixed_presets") || "{}");
      profiles = Object.entries(presets).map(([name, data]) => ({
        id: `legacy_${name}`,
        name,
        precio_kg: Number(data.precioKg) || 0,
        precio_kwh: Number(data.precioKwh) || 0,
        consumo_w: Number(data.consumoW) || 0,
        horas_desgaste: Number(data.horasDesgaste) || 1,
        precio_repuestos: Number(data.precioRepuestos) || 0,
        margen_error: Number(data.margenError) || 0,
        is_legacy: true
      }));
    }
    
    // Limpiar select y agregar opción por defecto
    sel.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "— elegir perfil —";
    sel.appendChild(opt0);
    
    // Agregar perfiles al select
    profiles.forEach(profile => {
      const option = document.createElement("option");
      option.value = profile.id;
      
      // Formatear texto del option
      let text = profile.name;
      if (profile.is_default) text += " ⭐";
      if (profile.is_public) text += " 🌐";
      else if (profile.is_legacy) text += " 💾";
      
      option.textContent = text;
      option.dataset.profile = JSON.stringify(profile);
      sel.appendChild(option);
    });
    
    console.log(`📋 ${profiles.length} perfiles cargados en el selector`);
    
  } catch (error) {
    console.error('Error cargando perfiles:', error);
    sel.innerHTML = '<option value="">❌ Error cargando perfiles</option>';
    toast('❌ Error cargando perfiles de configuración');
  }
}

// Guardar nuevo preset
async function savePreset() {
  try {
    const formData = readFixedFromForm();
    
    if (!formData.name) {
      toast("❌ Poné un nombre para el perfil");
      return;
    }
    
    if (formData.name.length > 200) {
      toast("❌ El nombre es demasiado largo (máx 200 caracteres)");
      return;
    }
    
    // Intentar guardar con el servicio de Supabase
    if (window.configProfilesService) {
      const profile = await window.configProfilesService.createProfile({
        ...formData,
        description: `Perfil creado desde calculadora`
      });
      
      await renderPresetList();
      $("presetList").value = profile.id;
      $("presetName").value = "";
      
    } else {
      // Fallback a localStorage
      const presets = JSON.parse(localStorage.getItem("zl_calc_fixed_presets") || "{}");
      if (presets[formData.name]) {
        toast("❌ Ya existe un perfil con ese nombre");
        return;
      }
      
      presets[formData.name] = {
        precioKg: formData.precio_kg?.toString() || "0",
        precioKwh: formData.precio_kwh?.toString() || "0",
        consumoW: formData.consumo_w?.toString() || "0",
        horasDesgaste: formData.horas_desgaste?.toString() || "1",
        precioRepuestos: formData.precio_repuestos?.toString() || "0",
        margenError: formData.margen_error?.toString() || "0"
      };
      
      localStorage.setItem("zl_calc_fixed_presets", JSON.stringify(presets));
      await renderPresetList();
      $("presetList").value = `legacy_${formData.name}`;
      $("presetName").value = "";
      
      toast(`✅ Perfil "${formData.name}" guardado localmente`);
    }
    
  } catch (error) {
    console.error('Error guardando preset:', error);
    toast(`❌ Error: ${error.message || 'No se pudo guardar el perfil'}`);
  }
}

// Aplicar preset seleccionado
async function applySelectedPreset() {
  const sel = $("presetList");
  if (!sel || !sel.value) return;
  
  try {
    let profile = null;
    
    // Buscar perfil en cache primero
    if (profilesCache.length > 0) {
      profile = profilesCache.find(p => p.id === sel.value);
    }
    
    // Si no está en cache, obtener desde el dataset del option
    if (!profile) {
      const selectedOption = sel.options[sel.selectedIndex];
      if (selectedOption?.dataset.profile) {
        profile = JSON.parse(selectedOption.dataset.profile);
      }
    }
    
    if (profile) {
      applyFixedToForm(profile);
      toast(`✅ Perfil "${profile.name}" aplicado`);
    } else {
      toast("❌ No se pudo cargar el perfil");
    }
    
  } catch (error) {
    console.error('Error aplicando preset:', error);
    toast("❌ Error aplicando perfil");
  }
}

// Eliminar preset seleccionado
async function deleteSelectedPreset() {
  const sel = $("presetList");
  if (!sel || !sel.value) return;
  
  try {
    const selectedOption = sel.options[sel.selectedIndex];
    if (!selectedOption?.dataset.profile) {
      toast("❌ No se pudo encontrar el perfil");
      return;
    }
    
    const profile = JSON.parse(selectedOption.dataset.profile);
    
    if (!confirm(`¿Eliminar el perfil "${profile.name}"?`)) return;
    
    if (window.configProfilesService && !profile.is_legacy) {
      await window.configProfilesService.deleteProfile(profile.id);
      await renderPresetList();
      $("presetName").value = "";
      
    } else {
      // Legacy localStorage
      const presets = JSON.parse(localStorage.getItem("zl_calc_fixed_presets") || "{}");
      delete presets[profile.name];
      localStorage.setItem("zl_calc_fixed_presets", JSON.stringify(presets));
      await renderPresetList();
      $("presetName").value = "";
      
      toast(`🗑️ Perfil "${profile.name}" eliminado`);
    }
    
  } catch (error) {
    console.error('Error eliminando preset:', error);
    toast(`❌ Error: ${error.message || 'No se pudo eliminar el perfil'}`);
  }
}

// Event listeners
document.addEventListener("click", (e) => {
  if (e.target.id === "btnSavePreset") savePreset();
  if (e.target.id === "btnApplyPreset") applySelectedPreset();
  if (e.target.id === "btnDeletePreset") deleteSelectedPreset();
});

$("presetList")?.addEventListener("change", applySelectedPreset);

/* ==============================
   Presupuesto (HTML descargable)
============================== */
function buildClientHtml(r) {
  const now = new Date();
  const pad2 = (n) => n.toString().padStart(2, "0");
  const fecha = `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()}`;
  const name = ($("pieceName")?.value || "").trim() || "Pieza 3D";
  const horas = number($("horas").value, 0);
  const minutos = number($("minutos").value, 0);
  const gramos = number($("gramos").value, 0);
  const usarDiscreto = $("discreetDetail")?.checked ?? true;

  const style = `
    body{font-family: system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Arial; color:#122018; margin:0; background:#f5f7f6}
    .wrap{max-width:900px; margin:28px auto; background:#fff; border:1px solid #e6ede9; border-radius:14px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,.06)}
    header{display:flex; gap:12px; align-items:center; padding:16px 20px; background:#0e1b17; color:#e8efe9}
    header img{height:32px; border-radius:8px}
    h1{font-size:18px; margin:0}
    .content{padding:20px}
    .grid{display:grid; grid-template-columns:1fr 1fr; gap:12px}
    @media (max-width:700px){ .grid{grid-template-columns:1fr} }
    .card{border:1px solid #e6ede9; border-radius:12px; padding:14px; background:#fbfdfa}
    .card h3{margin:0 0 8px; font-size:14px; color:#385f4d}
    table{width:100%; border-collapse:collapse; margin-top:8px}
    th,td{padding:10px 8px; border-top:1px solid #e6ede9; text-align:left; font-size:14px}
    tfoot td{font-weight:800; font-size:18px}
    .muted{color:#6a7a73; font-size:12px}
    .right{text-align:right}
  `;

  const total = r.totalCobrar;
  let rows = [];
  let notas = "Incluye: calibración, preparación de archivo (slicing), operación y supervisión, mantenimiento y amortización de equipos.";
  let subtitulo = usarDiscreto ? "" : '<div class="muted" style="margin-top:-4px">Este total incluye:</div>';

  if (!usarDiscreto) {
    const labels = [
      "Materiales (filamento y consumibles)",
      "Energía eléctrica",
      "Calibración y preparación (setup/slicing)",
      "Mano de obra (operación y supervisión)",
      "Mantenimiento y amortización de equipos",
    ];
    rows = labels.map((t) => [t, null]);
    notas = "Detalle informativo de rubros. El total incluye todos los conceptos.";
  } else {
    const minMat = r.material + r.insumos;
    const minEner = r.energia;
    const matTarget = Math.max(minMat, total * 0.22);
    const enerTarget = Math.max(minEner, total * 0.12);
    let restante = Math.max(total - matTarget - enerTarget, 0);

    let calibracionPrep = Math.max(restante * 0.36, 0);
    let manoDeObra     = Math.max(restante * 0.32, 0);
    let mantenimiento  = Math.max(restante - calibracionPrep - manoDeObra, 0);

    rows = [
      ["Materiales (filamento y consumibles)", matTarget],
      ["Energía eléctrica", enerTarget],
      ["Calibración y preparación (setup/slicing)", calibracionPrep],
      ["Mano de obra (operación y supervisión)", manoDeObra],
      ["Mantenimiento y amortización de equipos", mantenimiento],
    ];
  }

  const sumRows = rows.reduce((a, [_t, v]) => a + (v || 0), 0);
  const diff = total - sumRows;
  if (Math.abs(diff) > 0.005) rows[rows.length - 1][1] = (rows[rows.length - 1][1] || 0) + diff;

  const bodyRows = rows
  .map(([t, v]) => `<tr><td>${t}</td><td class="right">${v == null ? "—" : fmt(v)}</td></tr>`)
  .join("");

  return `<!DOCTYPE html>
<html lang="es"><head>
<meta charset="utf-8" />
<title>Presupuesto ZetaLab - ${name}</title>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>${style}</style>
</head>
<body>
  <div class="wrap">
    <header>
      <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 60 60'%3E%3Crect width='60' height='60' rx='10' fill='%2313251f'/%3E%3Ctext x='30' y='38' text-anchor='middle' font-size='26' fill='%23c9b28a' font-family='Arial,Helvetica,sans-serif'%3EZL%3C/text%3E%3C/svg%3E" alt="ZETALAB" />
      <h1>Presupuesto ZetaLab</h1>
    </header>
    <div class="content">
      <div class="grid">
        <div class="card">
          <h3>Detalle</h3>
          <div><strong>Pieza:</strong> ${name}</div>
          <div><strong>Fecha:</strong> ${fecha}</div>
          <div class="muted">Tiempo estimado: ${horas} h ${minutos} m · Material: ${gramos} g</div>
        </div>
        <div class="card">
          <h3>Resumen</h3>
          ${subtitulo}
          <table>
            <tbody>${bodyRows}</tbody>
            <tfoot><tr><td>Total</td><td class="right">${fmt(total)}</td></tr></tfoot>
          </table>
          <div class="muted">${notas}</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function downloadClientHtml() {
  const r = calcular();
  render(r);
  const html = buildClientHtml(r);
  const name = ($("pieceName")?.value || "").trim() || "pieza-3d";
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Presupuesto-ZetaLab-${name.replace(/[^a-z0-9-_ ]/gi, "_")}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
$("btnQuote")?.addEventListener("click", downloadClientHtml);

/* ==============================
   Enhanced Toast System with Types
============================== */
function toast(msg, type = 'info', duration = 2500) {
  const n = document.createElement("div");
  n.textContent = msg;
  
  const colors = {
    info: { bg: "#0f201b", border: "rgba(255,255,255,.08)" },
    success: { bg: "#064e3b", border: "rgba(16, 185, 129, .3)" },
    error: { bg: "#7f1d1d", border: "rgba(239, 68, 68, .3)" },
    warning: { bg: "#78350f", border: "rgba(245, 158, 11, .3)" }
  };
  
  Object.assign(n.style, {
    position: "fixed",
    bottom: "16px",
    right: "16px",
    background: colors[type].bg,
    color: "#e8efe9",
    border: `1px solid ${colors[type].border}`,
    padding: "10px 12px",
    borderRadius: "10px",
    zIndex: 10000,
    boxShadow: "0 10px 30px rgba(0,0,0,.25)",
    animation: "slideIn 0.3s ease-out",
    cursor: "pointer"
  });
  
  // Add dismiss on click
  n.addEventListener('click', () => n.remove());
  
  document.body.appendChild(n);
  setTimeout(() => {
    n.style.animation = "slideOut 0.3s ease-in";
    setTimeout(() => n.remove(), 300);
  }, duration);
}

// Add CSS animations for toasts
if (!document.querySelector('#toast-animations')) {
  const style = document.createElement('style');
  style.id = 'toast-animations';
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

/* ==============================
   Cargar datos si venís de "Mis piezas"
============================== */
(function loadFromMyPieces() {
  try {
    // Verificar si venimos de "mis piezas"
    const openedFromPieces = localStorage.getItem("zl_opened_from_pieces");
    const restoredVersionDate = localStorage.getItem("zl_restored_version_date");
    
    // Limpiar flags temporales
    localStorage.removeItem("zl_opened_from_pieces");
    localStorage.removeItem("zl_restored_version_date");
    
    // Mostrar mensaje apropiado
    if (openedFromPieces) {
      setTimeout(() => {
        if (openedFromPieces === 'version_restored' && restoredVersionDate) {
          toast(`🔄 Versión restaurada del ${restoredVersionDate}`, 'success', 3000);
        } else {
          toast('📂 Pieza cargada desde "Mis piezas"', 'success', 2500);
        }
      }, 500);
    }
    
    // Cargar datos básicos (compatibilidad hacia atrás)
    const name = localStorage.getItem("zl_piece_name");
    const url = localStorage.getItem("zl_piece_url");
    const img = localStorage.getItem("zl_piece_img");
    if (name && $("pieceName") && !$("pieceName").value) $("pieceName").value = name;
    if (url && $("pieceUrl") && !$("pieceUrl").value) $("pieceUrl").value = url;
    if (img && $("imageUrl") && !$("imageUrl").value) {
      $("imageUrl").value = img;
      updateImagePreview(img);
    }
    
    // Limpiar datos temporales
    localStorage.removeItem("zl_piece_name");
    localStorage.removeItem("zl_piece_url");
    localStorage.removeItem("zl_piece_img");
  } catch (err) {
    console.error('Error cargando desde mis piezas:', err);
  }
})();

/* ==============================
   Preview de imagen (en vivo)
============================== */
function updateImagePreview(src) {
  const tag = $("pieceImgTag");
  if (!tag) return;
  if (src) {
    tag.src = src;
    tag.style.display = "block";
  } else {
    tag.removeAttribute("src");
    tag.style.display = "none";
  }
}
$("imageUrl")?.addEventListener("input", (e) =>
    updateImagePreview(e.target.value)
);

/* ==============================
   Autocompletar título + imagen desde URL (Edge Function: og-proxy)
============================== */
async function autoCompleteFromUrl() {
  try {
    const url = ($("pieceUrl")?.value || "").trim();
    if (!url) {
      alert("Pegá una URL de MakerWorld (o similar).");
      return;
    }

    const headers = { "Content-Type": "application/json" };
    if (config.key)
      headers["Authorization"] = `Bearer ${config.key}`;

    // SEGURIDAD: Añadir timeout para evitar requests colgados
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos timeout
    
    try {
      const res = await fetch(OG_PROXY, {
        method: "POST",
        headers,
        body: JSON.stringify({ url }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const og = await res.json(); // {title, image, canonical, url}
      
      // VALIDACIÓN: Verificar estructura de respuesta
      if (typeof og !== 'object' || og === null) {
        throw new Error('Respuesta inválida del servidor');
      }

    // Título
    if (og?.title) $("pieceName").value = og.title;

    // Imagen + preview
    if (og?.image) {
      $("imageUrl").value = og.image;
      updateImagePreview(og.image);
    }

    // persistir en localStorage
    saveState();
    toast("✔ Datos cargados desde la URL");
    } catch (e) {
      clearTimeout(timeoutId);
      console.error('Error en autoCompleteFromUrl:', e);
      if (e.name === 'AbortError') {
        toast("⏱️ Timeout: La página tardó mucho en responder");
      } else if (e.message.includes('HTTP')) {
        toast(`❌ Error del servidor: ${e.message}`);
      } else {
        toast("❌ No pude leer la página. Probá con otra URL.");
      }
    }
  } catch (e) {
    console.error('Error general en autoCompleteFromUrl:', e);
    toast("❌ Error inesperado. Intentá de nuevo.");
  }
}
$("btnAutoFromUrl")?.addEventListener("click", autoCompleteFromUrl);

/* ==============================
   Guardar pieza en Supabase
============================== */
// Rate limiting simple para evitar spam
let lastSaveTime = 0;
const SAVE_COOLDOWN = 2000; // 2 segundos entre guardados

async function savePiece() {
  // RATE LIMITING: Prevenir spam de guardados
  const now = Date.now();
  if (now - lastSaveTime < SAVE_COOLDOWN) {
    toast(`⏱️ Espera ${Math.ceil((SAVE_COOLDOWN - (now - lastSaveTime)) / 1000)} segundos`);
    return;
  }
  lastSaveTime = now;
  
  try {
    if (!window.supa || !window.currentUser) {
      alert("No hay sesión activa. Iniciá sesión e intentá nuevamente.");
      return;
    }
    const title = ($("pieceName")?.value || "").trim();
    // VALIDACIÓN: Mejorar validación de entrada
    if (!title || title.length < 2) {
      toast('❌ El nombre de la pieza debe tener al menos 2 caracteres');
      return;
    }
    if (title.length > 200) {
      toast('❌ El nombre de la pieza es demasiado largo (máx 200 caracteres)');
      return;
    }

    // Cálculo al día
    const r = calcular();
    render(r);

    // Datos de formulario
    const userId   = window.currentUser.id;
    const horas    = number($("horas").value, 0);
    const minutos  = number($("minutos").value, 0);
    const gramos   = number($("gramos").value, 0);
    const pageUrl  = ($("pieceUrl")?.value || "").trim();
    const imageUrl = ($("imageUrl")?.value || "").trim();
    const nowIso   = new Date().toISOString();

    // ¿Existe la pieza?
    const { data: existing, error: findErr } = await window.supa
    .from("pieces")
    .select("id")
    .eq("user_id", userId)
    .eq("title", title)
    .maybeSingle();
    if (findErr) throw findErr;

    // Base para update/insert (sin page_url por compat)
    const basePiece = {
      user_id: userId,
      title,
      category: null,
      filament_id: null,
      color_override: null,
      est_weight_grams: gramos,
      est_print_time_min: Math.round(horas * 60 + minutos),
      est_price_ars: Number(r.totalCobrar.toFixed(2)),
      image_url: imageUrl || null,
      notes: null,
    };

    let pieceId;

    if (existing?.id) {
      // UPDATE con intento de page_url
      try {
        const { error: upErr1 } = await window.supa
        .from("pieces")
        .update({ ...basePiece, page_url: pageUrl || null, updated_at: nowIso })
        .eq("id", existing.id)
        .eq("user_id", userId);
        if (upErr1) throw upErr1;
      } catch {
        // Fallback sin page_url si la columna no existe
        const { error: upErr2 } = await window.supa
        .from("pieces")
        .update({ ...basePiece, updated_at: nowIso })
        .eq("id", existing.id)
        .eq("user_id", userId);
        if (upErr2) throw upErr2;
      }
      pieceId = existing.id;
    } else {
      // INSERT con intento de page_url
      try {
        const { data: ins1, error: insErr1 } = await window.supa
        .from("pieces")
        .insert({ ...basePiece, page_url: pageUrl || null, created_at: nowIso, updated_at: nowIso })
        .select("id")
        .single();
        if (insErr1) throw insErr1;
        pieceId = ins1.id;
      } catch {
        const { data: ins2, error: insErr2 } = await window.supa
        .from("pieces")
        .insert({ ...basePiece, created_at: nowIso, updated_at: nowIso })
        .select("id")
        .single();
        if (insErr2) throw insErr2;
        pieceId = ins2.id;
      }
    }

    // Snapshot en "piece_versions"
    const paramsJson = {
      inputs: {
        precioKg: $("precioKg")?.value ?? null,
        precioKwh: $("precioKwh")?.value ?? null,
        consumoW: $("consumoW")?.value ?? null,
        horasDesgaste: $("horasDesgaste")?.value ?? null,
        precioRepuestos: $("precioRepuestos")?.value ?? null,
        margenError: $("margenError")?.value ?? null,
        horas,
        minutos,
        gramos,
        insumos: $("insumos")?.value ?? null,
        multiplicador: $("multiplicador")?.value ?? null,
        mlFee: $("mlFee")?.value ?? null,
        url: pageUrl || null,
        image: imageUrl || null,
      },
      breakdown: {
        material: r.material,
        energia: r.energia,
        desgaste: r.desgaste,
        insumos: r.insumos,
        error: r.errorAmt,
        subtotal: r.subtotal,
        total: r.totalCobrar,
        precio_mercadolibre: r.precioML,
      },
    };

    const { error: verErr } = await window.supa.from("piece_versions").insert({
      piece_id: pieceId,
      user_id: userId,
      total: Number(r.totalCobrar.toFixed(2)),
      ml_price: Number(r.precioML.toFixed(2)),
      params: paramsJson,
      created_at: nowIso,
    });
    if (verErr) throw verErr;

    // Guardar en localStorage para “Abrir en calculadora”
    localStorage.setItem("zl_piece_name", title);
    if (pageUrl) localStorage.setItem("zl_piece_url", pageUrl);
    if (imageUrl) localStorage.setItem("zl_piece_img", imageUrl);

    toast("✅ Pieza guardada");
  } catch (e) {
    console.error(e);
    toast("❌ Error al guardar: " + (e?.message || e));
  }
}
$("btnSavePiece")?.addEventListener("click", savePiece);

/* ==============================
   Keyboard Shortcuts
============================== */
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + Enter to calculate
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    $("btnCalc")?.click();
    toast('Cálculo ejecutado', 'success', 1500);
  }
  
  // Ctrl/Cmd + S to save piece
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    $("btnSavePiece")?.click();
  }
  
  // Ctrl/Cmd + G to generate quote
  if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
    e.preventDefault();
    $("btnQuote")?.click();
  }
  
  // Ctrl/Cmd + R to reset (with confirmation)
  if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
    e.preventDefault();
    if (confirm('¿Resetear todos los campos?')) {
      $("btnReset")?.click();
    }
  }
  
  // ESC to close any open details/modals
  if (e.key === 'Escape') {
    document.querySelectorAll('details[open]').forEach(d => d.open = false);
  }
});

// Show keyboard shortcuts help
function showKeyboardHelp() {
  const shortcuts = [
    'Ctrl/Cmd + Enter: Calcular',
    'Ctrl/Cmd + S: Guardar pieza', 
    'Ctrl/Cmd + G: Generar presupuesto',
    'Ctrl/Cmd + R: Resetear campos',
    'Shift + Ctrl + H: Ver esta ayuda',
    'ESC: Cerrar paneles'
  ];
  toast(`Atajos de teclado:\n${shortcuts.join('\n')}`, 'info', 5000);
}

// Add help button or shortcut
document.addEventListener('keydown', (e) => {
  if (e.shiftKey && (e.ctrlKey || e.metaKey) && e.key === 'H') {
    e.preventDefault();
    showKeyboardHelp();
  }
});

/* ==============================
   Init
============================== */
loadState();

// Inicializar presets de manera asíncrona
(async function initializePresets() {
  try {
    // Esperar un poco para que se cargue la autenticación si está disponible
    await new Promise(resolve => setTimeout(resolve, 800));
    
    await renderPresetList();
    console.log('✅ Sistema de presets inicializado');
  } catch (error) {
    console.error('Error inicializando presets:', error);
    // Intentar con localStorage como fallback
    try {
      await renderPresetList();
    } catch (fallbackError) {
      console.error('Error en fallback de presets:', fallbackError);
    }
  }
})();

// Preview si había imagen en el form cargado
updateImagePreview($("imageUrl")?.value || "");

// Show welcome message with shortcuts
setTimeout(() => {
  toast('💡 Presiona Shift+Ctrl+H para ver atajos de teclado', 'info', 4000);
}, 1000);
