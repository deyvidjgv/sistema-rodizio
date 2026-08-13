/* ─────────────────────────────────────────────────────────────
   Rodizio · Panel de caja — vanilla JS, sin build, un solo archivo.
   Conectado directamente a Firebase Realtime Database por REST + SSE
   (Server-Sent Events), así que no necesita apiKey ni el SDK de Firebase:
   solo la URL de la base de datos.
   Alcance a propósito reducido: SOLO cobrar. Avanzar el pedido por
   "enviado"/"preparación"/"listo" es trabajo de panel-cocina — caja
   únicamente ve los pedidos ya "entregado" al mesero y confirma el
   pago (campos pagado/tsPago, no un estado nuevo del pedido).
   Sesión: guard de Firebase Authentication + rol "cajero" (o "admin",
   que pasa el guard de cualquier panel) — ver shared/auth.js y
   shared/roles.js. El login ocurre en el login raíz
   (/index.html); este panel solo verifica y, si falla, redirige ahí.
   ───────────────────────────────────────────────────────────── */
// DB_URL / dbUrl / dbUpdate / escucharSSE / aplicarEventoSSE / escapeHtml /
// fmtCop / crearBeep vienen de ../shared/firebase.js y ../shared/util.js

let pedidos = {};      // { pushId: {codigo, mesa, mesero, lineas, total, estado, ts, pagado, tsPago} }
let vistos = new Set(); // ids ya vistos en "por cobrar", para detectar nuevos y sonar aviso
let primeraCarga = true;
let sonidoOn = true;
const beep = crearBeep([880, 1180]);

function minsDesde(ts){ return Math.max(0, Math.round((Date.now() - ts) / 60000)); }

/* ── Server-Sent Events: escucha /pedidos en tiempo real ── */
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

/* ── Cobro: el único cambio que hace caja sobre un pedido. La mesa no
   se toca acá — en mesero-app, "ocupada" se calcula al vuelo mirando
   si queda algún pedido de esa mesa sin pagar, así que en cuanto se
   confirma el último pago, la mesa se ve libre sola. ── */
async function confirmarPago(id) {
  try {
    await dbUpdate(`/pedidos/${id}`, { pagado: true, tsPago: Date.now() });
  } catch (e) {
    alert("No se pudo confirmar el pago — revisa la conexión e intenta de nuevo.");
  }
}

/* ── Render ── */
function linea(l) {
  return `<div class="t-linea">
    <span class="t-qty">${l.qty}×</span>
    <span class="t-nombre">${escapeHtml(l.nombre)}${l.nota ? `<span class="t-nota">${escapeHtml(l.nota)}</span>` : ""}</span>
  </div>`;
}

function ticket(id, p) {
  const min = minsDesde(p.tsCambio || p.ts);
  const nueva = !vistos.has(id) && !primeraCarga;
  const lineasHtml = (p.lineas || []).map(linea).join("");

  return `<div class="ticket ${p.estado}${nueva ? " nueva" : ""}" data-id="${id}">
    <div class="t-top">
      <div><div class="t-codigo">${escapeHtml(p.codigo || id)}</div><span class="t-mesa">${escapeHtml(String(p.mesa ?? "—"))}</span></div>
      <div class="t-time ${min >= 15 ? "warn" : ""}">hace ${min} min</div>
    </div>
    <div class="t-mesero">${escapeHtml(p.mesero || "Mesero")}</div>
    <div class="t-lineas">${lineasHtml}</div>
    <div class="t-foot"><span class="t-total">${fmtCop(p.total)}</span><button class="t-action a-pago" onclick="confirmarPago('${id}')">Confirmar pago</button></div>
  </div>`;
}

function render() {
  const entries = Object.entries(pedidos).filter(([, p]) => p && p.estado);
  entries.sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0));

  const entregados = entries.filter(([, p]) => p.estado === "entregado");
  const porCobrar = entregados.filter(([, p]) => !p.pagado);
  const cobrados = entregados.filter(([, p]) => p.pagado);

  fillPorCobrar(porCobrar);
  fillCobrados(cobrados);

  document.getElementById("statHoy").textContent = entries.length;
  document.getElementById("statPorCobrar").textContent = porCobrar.length;
  document.getElementById("statCobradas").textContent = cobrados.filter(([, p]) => esHoy(p.tsPago)).length;

  const nuevosSinVer = porCobrar.some(([id]) => !vistos.has(id));
  if (nuevosSinVer && !primeraCarga && sonidoOn) beep();

  entries.forEach(([id]) => vistos.add(id));
  primeraCarga = false;
}

function fillPorCobrar(porCobrar) {
  const col = document.getElementById("colPorCobrar");
  document.getElementById("cPorCobrar").textContent = porCobrar.length;
  col.innerHTML = porCobrar.length
    ? porCobrar.map(([id, p]) => ticket(id, p)).join("")
    : `<div class="empty">No hay pedidos pendientes de cobro</div>`;
}

/* ── Historial de cobrados: solo los de hoy, más reciente primero ── */
function esHoy(ts) {
  if (!ts) return false;
  const a = new Date(ts), b = new Date();
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function cobradoRow(id, p) {
  const hora = new Date(p.tsPago || p.tsCambio || p.ts).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  return `<div class="entregado-row" data-id="${id}">
    <span class="e-codigo">${escapeHtml(p.codigo || id)}</span>
    <span class="e-mesa">${escapeHtml(String(p.mesa ?? "—"))}</span>
    <span class="e-mesero">${escapeHtml(p.mesero || "Mesero")}</span>
    <span class="e-hora">${hora}</span>
    <span class="e-total">${fmtCop(p.total)}</span>
  </div>`;
}
function fillCobrados(cobrados) {
  const hoy = cobrados.filter(([, p]) => esHoy(p.tsPago)).sort((a, b) => (b[1].tsPago || 0) - (a[1].tsPago || 0));
  document.getElementById("cCobrados").textContent = hoy.length;
  const list = document.getElementById("entregadosList");
  list.innerHTML = hoy.length
    ? hoy.map(([id, p]) => cobradoRow(id, p)).join("")
    : `<div class="entregados-empty">Aún no se ha cobrado ningún pedido hoy</div>`;
}

/* ── Exportar a Excel — todos los pedidos entregados que este panel
   tiene cargados en memoria (historial completo recibido por streaming
   desde Firebase, no solo los de hoy), con formato legible: encabezado
   de color, columnas centradas, ancho cómodo y moneda formateada. ── */
async function exportarExcel() {
  const btn = document.getElementById("btnExportar");
  const cobrados = Object.entries(pedidos)
    .filter(([, p]) => p && p.estado === "entregado" && p.pagado)
    .sort((a, b) => (a[1].tsPago || 0) - (b[1].tsPago || 0));

  if (!cobrados.length) { alert("Todavía no hay pedidos cobrados para exportar."); return; }
  if (typeof ExcelJS === "undefined") { alert("No se pudo cargar el generador de Excel — revisa tu conexión e intenta de nuevo."); return; }

  btn.disabled = true; const textoOriginal = btn.textContent; btn.textContent = "Generando…";
  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = "Rodizio";
    wb.created = new Date();
    const ws = wb.addWorksheet("Cobrados", { views: [{ state: "frozen", ySplit: 1 }] });

    ws.columns = [
      { header: "Código", key: "codigo", width: 12 },
      { header: "Mesa", key: "mesa", width: 9 },
      { header: "Mesero", key: "mesero", width: 20 },
      { header: "Fecha", key: "fecha", width: 13 },
      { header: "Hora entregado", key: "horaEntregado", width: 15 },
      { header: "Hora pago", key: "horaPago", width: 13 },
      { header: "Ítems", key: "items", width: 55 },
      { header: "Total", key: "total", width: 15 }
    ];

    cobrados.forEach(([id, p]) => {
      const enviado = new Date(p.ts || Date.now());
      const items = (p.lineas || []).map(l => `${l.qty}× ${l.nombre}${l.nota ? " (" + l.nota + ")" : ""}`).join("\n");
      ws.addRow({
        codigo: p.codigo || id,
        mesa: p.mesa ?? "—",
        mesero: p.mesero || "—",
        fecha: enviado.toLocaleDateString("es-CO"),
        horaEntregado: p.tsCambio ? new Date(p.tsCambio).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) : "—",
        horaPago: p.tsPago ? new Date(p.tsPago).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) : "—",
        items,
        total: p.total || 0
      });
    });

    const totalGeneral = cobrados.reduce((s, [, p]) => s + (p.total || 0), 0);
    const filaTotal = ws.addRow({ items: "TOTAL DEL PERIODO", total: totalGeneral });
    filaTotal.font = { bold: true };
    filaTotal.eachCell({ includeEmpty: true }, cell => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEEE7DB" } };
    });

    // Encabezado: fondo terracota, texto blanco, centrado y en negrita.
    const header = ws.getRow(1);
    header.height = 24;
    header.eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FFF9F4ED" }, size: 11 };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC67139" } };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    });

    // Todas las celdas de datos, centradas y con bordes suaves; la
    // columna de ítems queda alineada a la izquierda por ser texto largo,
    // pero centrada verticalmente para que se vea prolija igual.
    ws.eachRow((row, rowNumber) => {
      row.height = Math.max(row.height || 0, 20);
      row.eachCell({ includeEmpty: true }, cell => {
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE0D8C8" } },
          left: { style: "thin", color: { argb: "FFE0D8C8" } },
          bottom: { style: "thin", color: { argb: "FFE0D8C8" } },
          right: { style: "thin", color: { argb: "FFE0D8C8" } }
        };
      });
      if (rowNumber > 1) row.getCell("items").alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    });

    ws.getColumn("total").numFmt = '"$"#,##0';

    // Filas alternadas para que se lea fácil de un vistazo.
    cobrados.forEach((_, i) => {
      if (i % 2 === 1) {
        ws.getRow(i + 2).eachCell({ includeEmpty: true }, cell => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFBF3E8" } };
        });
      }
    });

    ws.autoFilter = { from: "A1", to: "H1" };

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rodizio-cobrados-" + new Date().toISOString().slice(0, 10) + ".xlsx";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch (e) {
    alert("No se pudo generar el Excel. Intenta de nuevo.");
  }
  btn.disabled = false; btn.textContent = textoOriginal;
}
document.getElementById("btnExportar").addEventListener("click", exportarExcel);

/* ── Reloj + repintado del tiempo transcurrido ── */
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
    // Cualquier trabajador activo puede operar caja — ya no depende de que
    // el admin le asigne el rol "cajero" puntualmente (los turnos rotan).
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