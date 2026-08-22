/* ─────────────────────────────────────────────────────────────
   Rodizio Admin · Reportes — app de Vue 3 (build global por CDN,
   sin build/npm) montada en #vistaDashboard.

   Vive separada del resto de panel-admin (app.js, imperativo con
   getElementById) para no mezclar dos estilos de código en el mismo
   archivo — ver plan "Dashboard de reportes en panel-admin".

   Depende de shared/firebase.js (escucharSSE/aplicarEventoSSE) y
   shared/util.js (fmtCop/ventasPorPlato), cargados como <script>
   normales antes que este (que es "defer", así que corre después de
   que el documento terminó de parsear esos dos, sin importar el
   orden de las etiquetas en el <head>).

   El mismo filtro de "cobrados" (estado entregado + pagado) y el
   mismo cálculo de ventas por plato que usa el Excel de panel-caja
   — ver ventasPorPlato() en shared/util.js — para que los números
   siempre coincidan entre el Excel y este dashboard.

   Filtros: el selector de mes es global (afecta todo). "Top platos"
   y "Efectivo/Tarjeta" tienen ADEMÁS sus propios filtros puntuales
   (categoría/mesero, cajero) porque no tiene sentido el mismo filtro
   para ambos — cada gráfico se filtra por lo que a esa vista le
   importa, no hay un filtro global único para todo el dashboard. ── */
(function () {
  const { createApp, ref, computed, watch, onMounted } = Vue;

  let barChart = null;
  let pieChart = null;
  let mesaChart = null;

  function sumTotal(cobrados) { return cobrados.reduce((s, [, p]) => s + (p.total || 0), 0); }
  function mesAnteriorDe(mes) {
    const [y, m] = mes.split("-").map(Number);
    return new Date(y, m - 2, 1).toISOString().slice(0, 7);
  }
  function delta(actual, anterior) {
    if (!anterior) return null;
    return Math.round((actual - anterior) / anterior * 100);
  }
  function valoresUnicos(arr) {
    return Array.from(new Set(arr.filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }

  const app = createApp({
    setup() {
      const pedidos = ref({});
      const mesElegido = ref(new Date().toISOString().slice(0, 7));
      const filtroCategoria = ref("");
      const filtroMesero = ref("");
      const filtroCajero = ref("");
      const filtroCodigo = ref("");

      escucharSSE("/pedidos", (tipo, evento) => {
        pedidos.value = aplicarEventoSSE(pedidos.value, tipo, evento);
      });

      // Los filtros de sección dependen de qué opciones existen en el mes
      // elegido — si se cambia de mes, un mesero/categoría/cajero elegido
      // puede dejar de existir, así que se resetean para no quedar en un
      // filtro "fantasma" que no matchea nada.
      watch(mesElegido, () => { filtroCategoria.value = ""; filtroMesero.value = ""; filtroCajero.value = ""; filtroCodigo.value = ""; });

      function cobradosDe(mes) {
        return Object.entries(pedidos.value).filter(([, p]) =>
          p && p.estado === "entregado" && p.pagado &&
          new Date(p.ts || 0).toISOString().slice(0, 7) === mes
        );
      }

      // Mismo filtro que exportarExcel() en panel-caja/app.js: cobrados
      // del mes elegido, entregados y pagados. Es el universo del mes —
      // los filtros de categoría/mesero/cajero de abajo recortan A PARTIR
      // de acá, nunca reemplazan este filtro base.
      const cobrados = computed(() => cobradosDe(mesElegido.value));
      const cobradosAnterior = computed(() => cobradosDe(mesAnteriorDe(mesElegido.value)));

      const pedidosCobrados = computed(() => cobrados.value.length);
      const totalVendido = computed(() => sumTotal(cobrados.value));
      const totalUnidades = computed(() => cobrados.value.reduce((s, [, p]) => s + (p.lineas || []).reduce((s2, l) => s2 + (l.qty || 0), 0), 0));
      const ticketPromedio = computed(() => pedidosCobrados.value ? Math.round(totalVendido.value / pedidosCobrados.value) : 0);

      const totalVendidoAnt = computed(() => sumTotal(cobradosAnterior.value));
      const pedidosCobradosAnt = computed(() => cobradosAnterior.value.length);
      const totalUnidadesAnt = computed(() => cobradosAnterior.value.reduce((s, [, p]) => s + (p.lineas || []).reduce((s2, l) => s2 + (l.qty || 0), 0), 0));
      const ticketPromedioAnt = computed(() => pedidosCobradosAnt.value ? Math.round(totalVendidoAnt.value / pedidosCobradosAnt.value) : 0);

      const deltaVendido = computed(() => delta(totalVendido.value, totalVendidoAnt.value));
      const deltaPedidos = computed(() => delta(pedidosCobrados.value, pedidosCobradosAnt.value));
      const deltaTicket = computed(() => delta(ticketPromedio.value, ticketPromedioAnt.value));
      const deltaUnidades = computed(() => delta(totalUnidades.value, totalUnidadesAnt.value));

      // ── Top platos: filtrable por categoría y por mesero ──
      const categoriasDisponibles = computed(() =>
        valoresUnicos(cobrados.value.flatMap(([, p]) => (p.lineas || []).map(l => l.cat)))
      );
      const merosDisponibles = computed(() => valoresUnicos(cobrados.value.map(([, p]) => p.mesero)));

      const cobradosRanking = computed(() =>
        cobrados.value
          .filter(([, p]) => !filtroMesero.value || p.mesero === filtroMesero.value)
          .map(([id, p]) => filtroCategoria.value
            ? [id, Object.assign({}, p, { lineas: (p.lineas || []).filter(l => l.cat === filtroCategoria.value) })]
            : [id, p]
          )
      );
      // Buscador por código — filtro propio de esta sección, no un select de
      // opciones fijas. Mientras hay texto se quita el tope de 10: si no,
      // no se podría encontrar un plato que no esté entre los más vendidos.
      const topPlatos = computed(() => {
        const todas = ventasPorPlato(cobradosRanking.value).sort((a, b) => b.cantidad - a.cantidad);
        const termino = filtroCodigo.value.trim().toLowerCase();
        if (!termino) return todas.slice(0, 10);
        return todas.filter((f) => f.codigo.toLowerCase().includes(termino));
      });
      const maxCantidad = computed(() => topPlatos.value.reduce((m, f) => Math.max(m, f.cantidad), 0) || 1);

      // ── Efectivo/Tarjeta: filtrable por cajero ──
      const cajerosDisponibles = computed(() => valoresUnicos(cobrados.value.map(([, p]) => p.cajero)));
      const cobradosPago = computed(() =>
        cobrados.value.filter(([, p]) => !filtroCajero.value || p.cajero === filtroCajero.value)
      );
      const totalEfectivo = computed(() => sumTotal(cobradosPago.value.filter(([, p]) => p.metodoPago === "efectivo")));
      const totalTarjeta = computed(() => sumTotal(cobradosPago.value.filter(([, p]) => p.metodoPago === "tarjeta")));

      // ── Ventas por mesa — dónde se sienta más la gente / qué mesas rotan
      // más, agrupando por "mesa" (el nombre visible, el mismo campo que ya
      // usan cocina y caja) — no hay nodo /mesas en Firebase (ver CLAUDE.md),
      // así que agrupar por nombre es lo mismo que hace el resto del sistema.
      const ventasPorMesa = computed(() => {
        const porMesa = {};
        cobrados.value.forEach(([, p]) => {
          const mesa = p.mesa || "—";
          const acc = porMesa[mesa] || { mesa, total: 0, pedidos: 0 };
          acc.total += p.total || 0;
          acc.pedidos += 1;
          porMesa[mesa] = acc;
        });
        return Object.values(porMesa).sort((a, b) => b.total - a.total);
      });

      const barCanvas = ref(null);
      const pieCanvas = ref(null);
      const mesaCanvas = ref(null);

      function dibujarBarras() {
        if (!barCanvas.value) return;
        const datos = topPlatos.value;
        const data = {
          labels: datos.map(d => d.nombre),
          datasets: [{ label: "Unidades vendidas", data: datos.map(d => d.cantidad), backgroundColor: "#C67139", borderRadius: 6 }]
        };
        if (barChart) { barChart.data = data; barChart.update(); return; }
        barChart = new Chart(barCanvas.value, {
          type: "bar",
          data,
          options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { beginAtZero: true, ticks: { precision: 0 } } }
          }
        });
      }

      function dibujarTorta() {
        if (!pieCanvas.value) return;
        const data = {
          labels: ["Efectivo", "Tarjeta"],
          datasets: [{ data: [totalEfectivo.value, totalTarjeta.value], backgroundColor: ["#4C8C6B", "#C67139"] }]
        };
        if (pieChart) { pieChart.data = data; pieChart.update(); return; }
        pieChart = new Chart(pieCanvas.value, {
          type: "doughnut",
          data,
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }
        });
      }

      function dibujarMesas() {
        if (!mesaCanvas.value) return;
        const datos = ventasPorMesa.value;
        const data = {
          labels: datos.map((d) => d.mesa),
          datasets: [{ label: "Total vendido", data: datos.map((d) => d.total), backgroundColor: "#4C8C6B", borderRadius: 6 }]
        };
        if (mesaChart) { mesaChart.data = data; mesaChart.update(); return; }
        mesaChart = new Chart(mesaCanvas.value, {
          type: "bar",
          data,
          options: {
            indexAxis: "y",
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: (ctx) => fmtCop(ctx.parsed.x) + " · " + datos[ctx.dataIndex].pedidos + " pedido(s)" } }
            },
            scales: { x: { beginAtZero: true, ticks: { callback: (v) => fmtCop(v) } } }
          }
        });
      }

      onMounted(() => { dibujarBarras(); dibujarTorta(); dibujarMesas(); });
      watch(topPlatos, dibujarBarras);
      watch([totalEfectivo, totalTarjeta], dibujarTorta);
      watch(ventasPorMesa, dibujarMesas);

      // panel-admin/app.js llama a esto al mostrar la pestaña "Reportes"
      // (el div arranca con display:none — Chart.js no calcula bien el
      // tamaño del canvas mientras su contenedor está oculto, así que
      // hay que forzar un resize la primera vez que se hace visible).
      window.__dashboardOnShow = () => {
        if (barChart) barChart.resize(); else dibujarBarras();
        if (pieChart) pieChart.resize(); else dibujarTorta();
        if (mesaChart) mesaChart.resize(); else dibujarMesas();
      };

      return {
        mesElegido, pedidosCobrados, totalVendido, totalEfectivo, totalTarjeta,
        totalUnidades, ticketPromedio, topPlatos, maxCantidad, barCanvas, pieCanvas, fmtCop,
        deltaVendido, deltaPedidos, deltaTicket, deltaUnidades,
        filtroCategoria, filtroMesero, filtroCajero, filtroCodigo,
        categoriasDisponibles, merosDisponibles, cajerosDisponibles,
        ventasPorMesa, mesaCanvas
      };
    },
    template: `
      <section class="card">
        <div class="dash-toolbar">
          <h2>Reportes</h2>
          <input type="month" class="mes-exportar" v-model="mesElegido" title="Mes a mostrar">
        </div>

        <div class="dash-kpis">
          <div class="kpi-card">
            <div class="kpi-value">{{ fmtCop(totalVendido) }}</div>
            <div class="kpi-label">Total vendido</div>
            <div class="kpi-delta" v-if="deltaVendido !== null" :class="deltaVendido >= 0 ? 'up' : 'down'">{{ deltaVendido >= 0 ? '▲' : '▼' }} {{ Math.abs(deltaVendido) }}% vs. mes anterior</div>
            <div class="kpi-delta muted" v-else>Sin datos del mes anterior</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">{{ pedidosCobrados }}</div>
            <div class="kpi-label">Pedidos cobrados</div>
            <div class="kpi-delta" v-if="deltaPedidos !== null" :class="deltaPedidos >= 0 ? 'up' : 'down'">{{ deltaPedidos >= 0 ? '▲' : '▼' }} {{ Math.abs(deltaPedidos) }}% vs. mes anterior</div>
            <div class="kpi-delta muted" v-else>Sin datos del mes anterior</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">{{ fmtCop(ticketPromedio) }}</div>
            <div class="kpi-label">Ticket promedio</div>
            <div class="kpi-delta" v-if="deltaTicket !== null" :class="deltaTicket >= 0 ? 'up' : 'down'">{{ deltaTicket >= 0 ? '▲' : '▼' }} {{ Math.abs(deltaTicket) }}% vs. mes anterior</div>
            <div class="kpi-delta muted" v-else>Sin datos del mes anterior</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-value">{{ totalUnidades.toLocaleString('es-CO') }}</div>
            <div class="kpi-label">Unidades vendidas</div>
            <div class="kpi-delta" v-if="deltaUnidades !== null" :class="deltaUnidades >= 0 ? 'up' : 'down'">{{ deltaUnidades >= 0 ? '▲' : '▼' }} {{ Math.abs(deltaUnidades) }}% vs. mes anterior</div>
            <div class="kpi-delta muted" v-else>Sin datos del mes anterior</div>
          </div>
        </div>

        <div class="dash-charts">
          <div>
            <div class="dash-filtros">
              <select v-model="filtroCategoria" title="Filtrar por categoría">
                <option value="">Todas las categorías</option>
                <option v-for="c in categoriasDisponibles" :key="c" :value="c">{{ c }}</option>
              </select>
              <select v-model="filtroMesero" title="Filtrar por mesero">
                <option value="">Todos los meseros</option>
                <option v-for="m in merosDisponibles" :key="m" :value="m">{{ m }}</option>
              </select>
              <input type="text" class="filtro-codigo" v-model="filtroCodigo" placeholder="Buscar por código…" title="Buscar plato por código">
            </div>
            <div class="chart-box"><canvas ref="barCanvas"></canvas></div>
          </div>
          <div>
            <div class="dash-filtros">
              <select v-model="filtroCajero" title="Filtrar por cajero">
                <option value="">Todos los cajeros</option>
                <option v-for="c in cajerosDisponibles" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>
            <div class="chart-box chart-box-pie"><canvas ref="pieCanvas"></canvas></div>
          </div>
        </div>

        <div class="dash-mesas">
          <h3>Ventas por mesa</h3>
          <div class="chart-box chart-box-mesas"><canvas ref="mesaCanvas"></canvas></div>
          <p class="sub" v-if="!ventasPorMesa.length">No hay pedidos cobrados en el mes elegido.</p>
        </div>

        <div class="dash-ranking" v-if="topPlatos.length">
          <table>
            <thead><tr><th>Código</th><th>Plato</th><th>Unidades</th><th>Total</th></tr></thead>
            <tbody>
              <tr v-for="f in topPlatos" :key="f.codigo">
                <td>{{ f.codigo }}</td>
                <td>
                  {{ f.nombre }}
                  <div class="barra-wrap"><div class="barra-fill" :style="{ width: (f.cantidad / maxCantidad * 100) + '%' }"></div></div>
                </td>
                <td class="num">{{ f.cantidad }}</td>
                <td class="num">{{ fmtCop(f.total) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="sub" v-else>No hay pedidos cobrados con esos filtros en el mes elegido.</p>
      </section>
    `
  });

  app.mount("#vistaDashboard");
})();
