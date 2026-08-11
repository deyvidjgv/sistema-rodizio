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
    } catch (e) {}
  };
}
