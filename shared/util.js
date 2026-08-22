/* Rodizio — utilidades compartidas por todas las apps.
   Sin build, sin módulos ES — funciones globales simples que cada
   index.html carga con <script src="../shared/util.js"></script>
   antes de su propio script. */

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Formato de moneda colombiana: fmtCop(12000) → "$12.000"
function fmtCop(n) {
  return "$" + Number(n || 0).toLocaleString("es-CO");
}

// Crea una función beep() independiente, cada una con su propio
// AudioContext — así cada app puede tener su propio tono (par de
// frecuencias) para distinguir el tipo de aviso, por ejemplo
// "pedido nuevo" en cocina/caja vs. "pedido listo" en la app de meseros.
// El interruptor de silencio (sonidoOn) lo controla cada app en su
// propio sitio de llamada, no aquí.
function crearBeep(frecuencias) {
  let audioCtx;
  const freqs = frecuencias || [880, 1180];
  return function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = audioCtx.currentTime;
      freqs.forEach((freq, i) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = "sine"; o.frequency.value = freq;
        g.gain.setValueAtTime(0, t0 + i * 0.16);
        g.gain.linearRampToValueAtTime(0.18, t0 + i * 0.16 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.16 + 0.22);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(t0 + i * 0.16); o.stop(t0 + i * 0.16 + 0.24);
      });
    } catch (e) { }
  };
}

// Agrupa las líneas de un pedido por ronda (1 = pedido original, 2+ = se
// agregó después durante la misma sentada — ver agregarRonda() en
// mesero-app/app.js) para que mesero-app y panel-cocina puedan mostrar en
// qué momento se tomó cada parte de la comanda. Los pedidos de antes de que
// existiera este campo no traen "ronda" en sus líneas: caen todos en el
// grupo 1, sin romper nada.
function agruparPorRonda(lineas, rondas) {
  const grupos = {};
  (lineas || []).forEach((l) => {
    const r = l.ronda || 1;
    (grupos[r] = grupos[r] || []).push(l);
  });
  return Object.keys(grupos)
    .map(Number)
    .sort((a, b) => a - b)
    .map((r) => ({
      ronda: r,
      lineas: grupos[r],
      ts: rondas && rondas[r] ? rondas[r] : null,
    }));
}

// ── Estado por ronda ──
// Cada ronda de un pedido (ver agruparPorRonda arriba) avanza por cocina y
// se sirve de forma independiente — pedir algo más en una mesa que ya tiene
// parte lista/servida no debe "resetear" esa parte a medio hacer. El estado
// de cada ronda vive en pedido.rondaEstados; pedido.estado (el campo de
// siempre) se recalcula como un resumen automático para no romper a
// panel-caja, que solo mira si el pedido completo ya es "entregado".
const ORDEN_ESTADO_RONDA = { enviado: 0, preparacion: 1, listo: 2, entregado: 3 };

// Estado de una ronda puntual. Los pedidos de antes de que existiera
// rondaEstados no lo traen: cada una de sus rondas hereda el estado global
// que tenía el pedido en ese momento, sin necesidad de migrar datos viejos.
function estadoDeRonda(p, ronda) {
  return (p.rondaEstados && p.rondaEstados[ronda]) || p.estado || "enviado";
}

// rondaEstados completo, con la misma compatibilidad hacia atrás de
// estadoDeRonda — para usar como base al construir el patch la primera vez
// que un pedido viejo (sin rondaEstados) recibe un cambio de estado.
function rondaEstadosCon(p) {
  if (p.rondaEstados) return Object.assign({}, p.rondaEstados);
  const obj = {};
  agruparPorRonda(p.lineas, p.rondas).forEach((g) => {
    obj[g.ronda] = p.estado || "enviado";
  });
  return obj;
}

// Estado "visible" de un ticket que puede tener rondas en distintos
// estados: la ronda pendiente menos avanzada (o "entregado" si ya se
// sirvieron todas). Decide en qué columna del tablero de panel-cocina
// aparece el ticket, y cuándo panel-caja puede considerarlo cobrable.
function estadoEfectivoTicket(p) {
  const estados = agruparPorRonda(p.lineas, p.rondas).map((g) => estadoDeRonda(p, g.ronda));
  const pendientes = estados.filter((e) => e !== "entregado");
  if (!pendientes.length) return "entregado";
  return pendientes.reduce((min, e) => (ORDEN_ESTADO_RONDA[e] < ORDEN_ESTADO_RONDA[min] ? e : min), pendientes[0]);
}

// Suma, por plato, cuántas unidades y cuánto dinero se vendieron dentro de
// un conjunto de pedidos ya filtrado (p. ej. cobrados de un mes). Recibe el
// mismo shape que Object.entries(pedidos): [[id, pedido], ...]. La usan
// tanto el Excel de panel-caja como el dashboard de panel-admin para no
// mantener el mismo cálculo duplicado en dos archivos.
function ventasPorPlato(pedidosFiltrados) {
  const porPlato = {};
  (pedidosFiltrados || []).forEach(([, p]) => {
    (p.lineas || []).forEach(l => {
      const acc = porPlato[l.id] || { codigo: l.id, nombre: l.nombre, cat: l.cat, cantidad: 0, total: 0 };
      acc.cantidad += l.qty || 0;
      acc.total += (l.precio || 0) * (l.qty || 0);
      porPlato[l.id] = acc;
    });
  });
  return Object.values(porPlato).sort((a, b) => a.codigo.localeCompare(b.codigo));
}

// Solución para Back-Forward Cache (bfcache):
// Obliga a recargar la página si se restaura desde el historial del navegador.
// Esto evita que las apps se queden "congeladas" en la pantalla de verificación
// de sesión si el usuario navega hacia atrás/adelante.
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    window.location.reload();
  }
});
