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
let vistos = new Set();
let primeraCarga = true;
let sonidoOn = true;
const beep = crearBeep([880, 1180]);

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
  try {
    await dbUpdate(`/pedidos/${id}`, { estado, tsCambio: Date.now() });
  } catch (e) {
    alert("No se pudo actualizar el pedido — revisa la conexión e intenta de nuevo.");
  }
}

function linea(l) {
  return `<div class="t-linea">
    <span class="t-qty">${l.qty}×</span>
    <span class="t-nombre">${escapeHtml(l.nombre)}${l.nota ? `<span class="t-nota">${escapeHtml(l.nota)}</span>` : ""}</span>
  </div>`;
}

function ticket(id, p, accion) {
  const min = minsDesde(p.ts);
  const nueva = !vistos.has(id) && !primeraCarga && p.estado === "enviado";
  const lineasHtml = (p.lineas || []).map(linea).join("");
  let foot = "";
  if (accion === "prep") foot = `<button class="t-action a-prep" onclick="marcar('${id}','preparacion')">Empezar</button>`;
  else if (accion === "listo") foot = `<button class="t-action a-listo" onclick="marcar('${id}','listo')">Marcar listo</button>`;
  else if (accion === "espera") foot = `<span class="t-badge-listo"><span class="b"></span>Esperando mesero</span>`;

  return `<div class="ticket ${p.estado}${nueva ? " nueva" : ""}" data-id="${id}">
    <div class="t-top">
      <div><div class="t-codigo">${escapeHtml(p.codigo || id)}</div><span class="t-mesa">${escapeHtml(String(p.mesa ?? "—"))}</span></div>
      <div class="t-time ${min >= 15 ? "warn" : ""}">hace ${min} min</div>
    </div>
    <div class="t-mesero">${escapeHtml(p.mesero || "Mesero")}</div>
    <div class="t-lineas">${lineasHtml}</div>
    <div class="t-foot">${foot}</div>
  </div>`;
}

function render() {
  const entries = Object.entries(pedidos).filter(([, p]) => p && p.estado);
  entries.sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0));

  const enviados = entries.filter(([, p]) => p.estado === "enviado");
  const prep = entries.filter(([, p]) => p.estado === "preparacion");
  const listos = entries.filter(([, p]) => p.estado === "listo");
  const entregados = entries.filter(([, p]) => p.estado === "entregado");

  fill("colEnviado", "cEnviado", enviados, "prep");
  fill("colPrep", "cPrep", prep, "listo");
  fill("colListo", "cListo", listos, "espera");
  fillEntregados(entregados);
  if (window.actualizarBotonInstalarPWA) window.actualizarBotonInstalarPWA();

  const nuevosSinVer = enviados.some(([id]) => !vistos.has(id));
  if (nuevosSinVer && !primeraCarga && sonidoOn) beep();

  entries.forEach(([id]) => vistos.add(id));
  primeraCarga = false;
}

function fill(colId, countId, list, accion) {
  const col = document.getElementById(colId);
  document.getElementById(countId).textContent = list.length;
  col.innerHTML = list.length
    ? list.map(([id, p]) => ticket(id, p, accion)).join("")
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