/* ─────────────────────────────────────────────────────────────
   Rodizio · Panel de cocina — vanilla JS, sin build, un solo archivo.
   Igual que el panel de caja, se conecta directo a Firebase Realtime
   Database por REST + SSE (sin SDK ni apiKey), así que ambos paneles
   ven exactamente los mismos pedidos y se actualizan solos en cuanto
   uno de los dos —o el mesero desde su celular— cambia un estado.
   Este panel se queda solo con lo esencial para cocinar: el tablero
   y la franja de confirmación de entregados, sin reportes ni estadísticas.
   Sesión: guard de Firebase Authentication + rol "cocinero" (o "admin",
   que pasa el guard de cualquier panel) — ver shared/auth.js y
   shared/roles.js. El login ocurre en el login raíz
   (/index.html); este panel solo verifica y, si falla, redirige ahí.
   ───────────────────────────────────────────────────────────── */
// DB_URL / dbUrl / dbUpdate / escucharSSE / aplicarEventoSSE / escapeHtml /
// fmtCop / crearBeep vienen de ../shared/firebase.js y ../shared/util.js

let pedidos = {};
let marcasVistas = {}; // id -> última "marca" (tsUltimaRonda||ts) ya procesada
let avisosVistos = {}; // id -> ts del último avisoCambio ya alertado
let primeraCarga = true;
let sonidoOn = true;
let marcandoEstado = new Set(); // ids con un cambio de estado (Empezar/Listo) en curso
const beep = crearBeep([880, 1180]);
// Tono distinto (descendente) para no confundir "pedido nuevo" con
// "el mesero avisa un cambio en algo que ya se está cocinando".
const beepAviso = crearBeep([740, 494]);

// "Marca" de un pedido: cambia tanto si es un ticket recién creado como si
// se le agregó una ronda nueva (ver agregarRonda() en mesero-app/app.js) —
// une ambos casos bajo una sola detección de "hay algo nuevo para cocina",
// sin importar en qué columna del tablero caiga el ticket.
function marcaDe(p) {
  return p.tsUltimaRonda || p.ts;
}

function minsDesde(ts){ return Math.max(0, Math.round((Date.now() - ts) / 60000)); }

function conectar() {
  const es = escucharSSE("/pedidos", (tipo, evento) => {
    pedidos = aplicarEventoSSE(pedidos, tipo, evento);
    setStatus(true);
    render();
  });
  es.onopen = () => setStatus(true);
  es.onerror = () => { setStatus(false); };
  return es;
}

function setStatus(ok) {
  document.getElementById("dot").className = "dot " + (ok ? "live" : "off");
  document.getElementById("statusTxt").textContent = ok ? "En vivo" : "Conectando…";
  document.getElementById("banner").classList.toggle("show", !ok);
}

document.getElementById("soundBtn").addEventListener("click", () => {
  sonidoOn = !sonidoOn;
  const btn = document.getElementById("soundBtn");
  btn.dataset.on = sonidoOn ? "1" : "0";
  document.getElementById("soundIcon").innerHTML = sonidoOn
    ? '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>'
    : '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M23 9l-6 6"/><path d="M17 9l6 6"/>';
});

async function marcar(id, estado) {
  // Un doble toque (o una conexión lenta) no debe disparar dos peticiones
  // para el mismo pedido — el botón que lo originó desaparece solo en el
  // próximo render (el ticket cambia de columna), esto cubre el instante
  // entre el toque y ese re-render.
  if (marcandoEstado.has(id)) return;
  marcandoEstado.add(id);
  try {
    await dbUpdate(`/pedidos/${id}`, { estado, tsCambio: Date.now() });
  } catch (e) {
    alert("No se pudo actualizar el pedido — revisa la conexión e intenta de nuevo.");
  } finally {
    marcandoEstado.delete(id);
  }
}

// El mesero avisó un cambio (ver mesero-app: avisarCambioCocina) sin tocar
// el pedido real — cocina confirma que ya habló con el mesero en persona
// y esto solo limpia la alerta, no cambia "lineas" ni "estado".
async function marcarAvisoVisto(id) {
  try {
    await dbUpdate(`/pedidos/${id}`, { avisoCambio: null });
  } catch (e) {
    alert("No se pudo confirmar — revisa la conexión e intenta de nuevo.");
  }
}

function linea(l) {
  return `<div class="t-linea">
    <span class="t-qty">${l.qty}×</span>
    <span class="t-nombre">${escapeHtml(l.nombre)}${l.nota ? `<span class="t-nota">${escapeHtml(l.nota)}</span>` : ""}</span>
  </div>`;
}

function ticket(id, p, accion, esNueva) {
  const min = minsDesde(p.ts);
  // Ronda 1 = pedido original; 2+ = se agregó después durante la misma
  // sentada (ver agregarRonda() en mesero-app/app.js) — se separa en
  // secciones con encabezado para que cocina entienda qué es qué y cuándo
  // se pidió, en vez de ver todo mezclado en una sola lista.
  const grupos = agruparPorRonda(p.lineas, p.rondas);
  const lineasHtml = grupos
    .map((g) => {
      const header =
        grupos.length > 1
          ? `<div class="t-ronda-header${g.ronda > 1 ? " ronda-sep" : ""}">${g.ronda === 1 ? "Pedido inicial" : "Ronda " + g.ronda}${g.ts ? " · hace " + minsDesde(g.ts) + " min" : ""}</div>`
          : "";
      return header + g.lineas.map(linea).join("");
    })
    .join("");
  let foot = "";
  if (accion === "prep") foot = `<button class="t-action a-prep" onclick="marcar('${id}','preparacion')">Empezar</button>`;
  else if (accion === "listo") foot = `<button class="t-action a-listo" onclick="marcar('${id}','listo')">Marcar listo</button>`;
  else if (accion === "espera") foot = `<span class="t-badge-listo"><span class="b"></span>Esperando mesero</span>`;

  // El pedido en sí no se toca — solo un aviso visible de que el mesero
  // quiere coordinar un cambio en persona (ver marcarAvisoVisto arriba).
  const avisoHtml = p.avisoCambio
    ? `<div class="t-aviso">
      <span class="material-symbols-outlined">priority_high</span>
      <div class="t-aviso-texto"><b>El mesero avisa un cambio</b>${p.avisoCambio.mensaje ? `<br>${escapeHtml(p.avisoCambio.mensaje)}` : ""}<br><small>${escapeHtml(p.avisoCambio.mesero || "")}</small></div>
      <button onclick="marcarAvisoVisto('${id}')">Entendido</button>
    </div>`
    : "";

  return `<div class="ticket ${p.estado}${esNueva ? " nueva" : ""}" data-id="${id}">
    <div class="t-top">
      <div><div class="t-codigo">${escapeHtml(p.codigo || id)}</div><span class="t-mesa">${escapeHtml(String(p.mesa ?? "—"))}</span></div>
      <div class="t-time ${min >= 15 ? "warn" : ""}">hace ${min} min</div>
    </div>
    <div class="t-mesero">${escapeHtml(p.mesero || "Mesero")}</div>
    ${avisoHtml}
    <div class="t-lineas">${lineasHtml}</div>
    <div class="t-foot">${foot}</div>
  </div>`;
}

function render() {
  const entries = Object.entries(pedidos).filter(([, p]) => p && p.estado);
  entries.sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0));

  // Qué tickets tienen algo nuevo para preparar desde el último render —
  // un pedido recién creado O una ronda nueva agregada a uno que cocina ya
  // tenía (ver marcaDe arriba). Cubre las dos formas en las que puede
  // aparecer "algo nuevo", sin importar en qué columna caiga el ticket.
  const nuevos = new Set();
  entries.forEach(([id, p]) => {
    if (!primeraCarga && marcasVistas[id] !== marcaDe(p)) nuevos.add(id);
  });

  const enviados = entries.filter(([, p]) => p.estado === "enviado");
  const prep = entries.filter(([, p]) => p.estado === "preparacion");
  const listos = entries.filter(([, p]) => p.estado === "listo");
  const entregados = entries.filter(([, p]) => p.estado === "entregado");

  fill("colEnviado", "cEnviado", enviados, "prep", nuevos);
  fill("colPrep", "cPrep", prep, "listo", nuevos);
  fill("colListo", "cListo", listos, "espera", nuevos);
  fillEntregados(entregados);
  if (window.actualizarBotonInstalarPWA) window.actualizarBotonInstalarPWA();

  if (nuevos.size && !primeraCarga && sonidoOn) beep();

  // Un aviso "nuevo" es uno cuyo ts no coincide con el último que ya
  // sonamos para ese pedido — así no se repite el sonido en cada re-render
  // mientras el aviso sigue pendiente, pero si cocina lo marca "Entendido"
  // y el mesero avisa de nuevo (otro ts), vuelve a sonar.
  entries.forEach(([id, p]) => {
    if (p.avisoCambio && avisosVistos[id] !== p.avisoCambio.ts) {
      if (!primeraCarga && sonidoOn) beepAviso();
      avisosVistos[id] = p.avisoCambio.ts;
    }
  });

  entries.forEach(([id, p]) => { marcasVistas[id] = marcaDe(p); });
  primeraCarga = false;
}

function fill(colId, countId, list, accion, nuevos) {
  const col = document.getElementById(colId);
  document.getElementById(countId).textContent = list.length;
  col.innerHTML = list.length
    ? list.map(([id, p]) => ticket(id, p, accion, nuevos.has(id))).join("")
    : `<div class="empty">Sin comandas aquí por ahora</div>`;
}

// Solo una franja de confirmación — los últimos 8 pedidos entregados,
// sin historial completo ni reportes (eso vive en el panel de caja).
function fillEntregados(entregados) {
  const ultimos = entregados
    .sort((a, b) => (b[1].tsCambio || b[1].ts || 0) - (a[1].tsCambio || a[1].ts || 0))
    .slice(0, 8);
  const cont = document.getElementById("entregadosChips");
  cont.innerHTML = ultimos.length
    ? ultimos.map(([id, p]) => `<span class="entregado-chip"><span class="material-symbols-outlined ok">check_circle</span>${escapeHtml(p.codigo || id)} · ${escapeHtml(String(p.mesa ?? "—"))}</span>`).join("")
    : `<span class="entregado-chip">Todavía no se ha entregado ningún pedido</span>`;
}

function tickClock() {
  const d = new Date();
  document.getElementById("clock").textContent = d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}
setInterval(() => { tickClock(); render(); }, 20000);

/* ── Guard de sesión ── */
function esperarAuthListo() {
  return new Promise((resolve) => {
    (function chequear() {
      if (window.onAuthStateChanged && window.logout) resolve();
      else setTimeout(chequear, 30);
    })();
  });
}

async function iniciar() {
  await esperarAuthListo();
  onAuthStateChanged(async (user) => {
    if (!user) { window.location.href = "../index.html"; return; }
    let perfil;
    try { perfil = await getWorkerProfile(user.uid); }
    catch (e) { window.location.href = "../index.html"; return; }
    // Cualquier trabajador activo puede operar cocina — ya no depende de que
    // el admin le asigne el rol "cocinero" puntualmente (los turnos rotan).
    // Solo se cierra sesión de verdad si la cuenta no existe o está inactiva;
    // si el perfil es válido no hay que sacarlo de Firebase Authentication.
    if (!perfil || perfil.estado !== "activo") {
      await logout();
      window.location.href = "../index.html";
      return;
    }
    document.getElementById("vistaCargando").style.display = "none";
    document.getElementById("app").style.display = "block";
    tickClock();
    conectar();
  });
}

document.getElementById("btnLogout").addEventListener("click", async () => {
  await logout();
  window.location.href = "../index.html";
});

iniciar();