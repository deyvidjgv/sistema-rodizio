/* ═══════════════════════════════════════════════════════════════
   Rodizio · Panel de cliente — página pública sin login, abierta
   escaneando el QR de la mesa. El pedido del cliente NO va directo
   a cocina: solo llena /solicitudes/{mesaId}, que el mesero revisa
   y confirma desde mesero-app antes de que entre a cocina.
   ═══════════════════════════════════════════════════════════════ */

const cop = fmtCop;
const CATS = MENU.map((g) => g.cat);
const ITEM_INDEX = {};
MENU.forEach((g) =>
  g.items.forEach((i) => {
    ITEM_INDEX[i.id] = Object.assign({ cat: g.cat }, i);
  }),
);

function sinAcentos(s) {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// Lee ?mesa=<slug>&nombre=<Nombre> de la URL del QR. mesaId se usa tal
// cual como segmento de ruta REST de Firebase (/solicitudes/{mesaId}),
// así que se valida contra el mismo charset que ya generan panel-admin
// (slugMesa) y mesero-app (mesa-N / custom_<timestamp>) — cualquier otra
// cosa (barras, puntos, etc.) se trata como enlace inválido en vez de
// dejarla pasar a la URL de Firebase.
function mesaIdValido(id) {
  return typeof id === 'string' && /^[a-z0-9_-]{1,60}$/i.test(id);
}
const params = new URLSearchParams(window.location.search);
const mesaIdCrudo = params.get('mesa');
const mesaId = mesaIdValido(mesaIdCrudo) ? mesaIdCrudo : null;
const nombreMesa = (params.get('nombre') || mesaId || '').slice(0, 60);

const state = {
  cargando: true,
  cat: CATS[0],
  busqueda: '',
  carrito: [], // [{id, qty, nota}]
  carritoAbierto: false,
  enviado: false,
};

// Timestamp de nuestra propia última escritura — para no reprocesar
// el eco que el propio SSE nos manda de vuelta tras un dbSet.
let ultimoEnviadoTs = 0;
let persistT = null;

function setState(patch) {
  Object.assign(state, patch);
  render();
}

function aviso(t, opts) {
  window.mostrarToast(t, opts);
}

function total() {
  return state.carrito.reduce(
    (s, l) => s + ITEM_INDEX[l.id].precio * l.qty,
    0,
  );
}

function lineasActuales() {
  return state.carrito.map((l) => ({
    id: l.id,
    nombre: ITEM_INDEX[l.id].nombre,
    cat: ITEM_INDEX[l.id].cat,
    qty: l.qty,
    precio: ITEM_INDEX[l.id].precio,
    nota: (l.nota || '').trim(),
  }));
}

// Reemplazo completo del carrito compartido de la mesa — nunca dbUpdate
// parcial, así el resto de celulares en la misma mesa (y mesero-app) ven
// siempre la foto completa por SSE (ver plan: aplicarEventoSSE reusado).
function persistir(inmediato) {
  clearTimeout(persistT);
  const doSet = () => {
    const actualizado = Date.now();
    ultimoEnviadoTs = actualizado;
    // "mesa" (nombre visible) viaja junto al carrito para que mesero-app
    // pueda registrar la mesa en su grilla aunque sea una mesa especial
    // (QR generado desde panel-admin) que todavía no conocía.
    dbSet(`/solicitudes/${mesaId}`, {
      lineas: lineasActuales(),
      mesa: nombreMesa,
      actualizado,
    }).catch(() => {});
  };
  if (inmediato) doSet();
  else persistT = setTimeout(doSet, 400);
}

function carritoDesdeLineas(lineas) {
  return (lineas || [])
    .filter((l) => ITEM_INDEX[l.id])
    .map((l) => ({ id: l.id, qty: l.qty, nota: l.nota || '' }));
}

function conectarSolicitud() {
  escucharSSE(`/solicitudes/${mesaId}`, (tipo, evento) => {
    const solicitud = aplicarEventoSSE({}, tipo, evento) || {};
    // Ignorar el eco de nuestra propia escritura — ya tenemos ese estado local.
    if (solicitud.actualizado && solicitud.actualizado === ultimoEnviadoTs) return;
    if (state.enviado) return;
    setState({ carrito: carritoDesdeLineas(solicitud.lineas) });
  });
}

async function cargarInicial() {
  if (!mesaId) {
    setState({ cargando: false });
    return;
  }
  try {
    const solicitud = await dbGet(`/solicitudes/${mesaId}`);
    setState({ cargando: false, carrito: carritoDesdeLineas(solicitud && solicitud.lineas) });
  } catch (e) {
    setState({ cargando: false });
  }
  conectarSolicitud();
}

/* ── Carrito ── */
function cambiar(id, delta) {
  const carrito = state.carrito.slice();
  const i = carrito.findIndex((l) => l.id === id);
  if (i === -1) {
    if (delta > 0) carrito.push({ id, qty: 1, nota: '' });
  } else {
    const q = carrito[i].qty + delta;
    if (q <= 0) carrito.splice(i, 1);
    else carrito[i] = Object.assign({}, carrito[i], { qty: q });
  }
  setState({ carrito });
  persistir();
}
function setNota(id, nota) {
  setState({
    carrito: state.carrito.map((l) =>
      l.id === id ? Object.assign({}, l, { nota }) : l,
    ),
  });
  persistir();
}

async function enviarPedido() {
  if (!state.carrito.length) return;
  const btn = document.getElementById('btnEnviarPedido');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Enviando…';
  }
  persistir(true);
  setState({ carritoAbierto: false, enviado: true });
  aviso('Pedido enviado — el mesero lo va a confirmar', { icono: 'restaurant' });
}

/* ═══════════ RENDER ═══════════ */
function render() {
  const el = document.getElementById('app');
  el.innerHTML = renderApp();
  bindApp();
  if (state.toast) {
    // El toast global lo maneja shared/ui.js (mostrarToast), no hace falta acá.
  }
}

function renderApp() {
  if (!mesaId) return renderError();
  if (state.cargando) return renderCargando();
  if (state.enviado) return renderConfirmacion();
  return `
  <div class="hero">
    <div class="hero-row">
      <div class="hero-logo"><img src="../icons/icon-192.png" alt="Rodizio"></div>
      <div class="hero-text">
        <span class="brand">Rodizio Cúcuta</span>
        <span class="mesa"><span class="material-symbols-outlined">table_restaurant</span>${escapeHtml(nombreMesa)}</span>
      </div>
    </div>
    <p class="hero-sub">Elige tus platos y envíalos al mesero — él revisa y confirma tu pedido antes de mandarlo a cocina.</p>
  </div>
  <main>${renderMenu()}</main>
  ${state.carrito.length && !state.carritoAbierto ? renderCartBar() : ''}
  ${renderDrawer()}
  `;
}

function renderError() {
  return `<div class="error-wrap">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg>
    <h2 style="margin-top:14px">Enlace no válido</h2>
    <p>Este enlace no corresponde a ninguna mesa. Pide ayuda al mesero para escanear el código correcto.</p>
  </div>`;
}

function renderCargando() {
  return `
  <div class="cargando-wrap">
    <div class="cargando-logo"><img src="../icons/icon-192.png" alt="Rodizio"></div>
    <div class="spinner"></div>
    <p class="cargando-texto">Cargando el menú…</p>
  </div>`;
}

function renderConfirmacion() {
  return `<div class="confirm-wrap">
    <div class="confirm-logo"><img src="../icons/icon-192.png" alt="Rodizio"></div>
    <div class="confirm-icon"><span class="material-symbols-outlined">check_circle</span></div>
    <h2>Pedido enviado</h2>
    <p>Tu pedido fue enviado — el mesero lo va a revisar y confirmar en breve para mandarlo a cocina.</p>
  </div>`;
}

function renderMenu() {
  const enCarrito = {};
  state.carrito.forEach((l) => (enCarrito[l.id] = l.qty));
  const termino = sinAcentos(state.busqueda || '').trim();
  const buscando = termino.length >= 2;

  let items = [];
  if (buscando) {
    MENU.forEach((g) =>
      g.items.forEach((it) => {
        if (
          sinAcentos(it.nombre).includes(termino) ||
          sinAcentos(it.desc).includes(termino)
        ) {
          items.push({ ...it, catLabel: g.cat });
        }
      }),
    );
  } else {
    const grupo = MENU.find((g) => g.cat === state.cat) || MENU[0];
    items = grupo.items.map((it) => ({ ...it, catLabel: null }));
  }

  return `
  <div class="menu-search-wrap">
    <svg class="menu-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
    <input class="menu-search" id="menuSearch" type="text" placeholder="Buscar producto…" value="${escapeHtml(state.busqueda)}">
    ${state.busqueda ? '<button class="menu-search-clear" id="menuSearchClear"><span class="material-symbols-outlined">close</span></button>' : ''}
  </div>
  ${!buscando ? `<div class="cats">${CATS.map((c) => `<button class="cat-pill ${c === state.cat ? 'on' : ''}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('')}</div>` : ''}
  ${items.length === 0 && buscando ? '<div class="empty-state" style="padding:30px 0"><p>No se encontraron productos con "' + escapeHtml(state.busqueda) + '"</p></div>' : ''}
  ${items
    .map((it) => {
      const q = enCarrito[it.id] || 0;
      const foto = it.img
        ? `<img class="plato-foto" src="${escapeHtml(it.img)}" alt="" loading="lazy" onerror="this.remove();this.parentElement.classList.add('sin-foto')">`
        : '';
      return `<div class="plato ${q > 0 ? 'in' : ''}">
      <div class="plato-img${it.img ? '' : ' sin-foto'}">${foto}<span class="material-symbols-outlined icon-fallback">restaurant</span></div>
      <div class="plato-info">
        ${it.catLabel ? `<span class="plato-cat">${escapeHtml(it.catLabel)}</span>` : ''}
        <b>${escapeHtml(it.nombre)}</b><small>${escapeHtml(it.desc)}</small><span class="precio">${cop(it.precio)}</span>
      </div>
      <div class="stepper">
        ${q > 0 ? `<button data-quitar="${it.id}">–</button><span class="qty">${q}</span>` : ''}
        <button class="add" data-agregar="${it.id}">+</button>
      </div>
    </div>`;
    })
    .join('')}`;
}

function renderCartBar() {
  const unidades = state.carrito.reduce((n, l) => n + l.qty, 0);
  return `<button class="cart-bar" id="btnAbrirCarrito"><b>${unidades} ítem${unidades === 1 ? '' : 's'}</b><span>${cop(total())}</span><span class="cta-mini">Ver pedido</span></button>`;
}

function renderDrawer() {
  const abierta = state.carritoAbierto;
  const lineas =
    state.carrito
      .map((l) => {
        const it = ITEM_INDEX[l.id];
        const sug = SUGERENCIAS[it.cat] || [];
        return `<div class="linea-row">
      <div class="linea-top">
        <b>${escapeHtml(it.nombre)}</b>
        <div class="stepper"><button data-quitar="${it.id}">–</button><span class="qty">${l.qty}</span><button class="add" data-agregar="${it.id}">+</button></div>
        <span class="sub">${cop(it.precio * l.qty)}</span>
      </div>
      ${sug.length ? `<div class="sug">${sug.map((t) => `<button class="${(l.nota || '').trim() === t ? 'on' : ''}" data-nota-chip="${it.id}" data-texto="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')}</div>` : ''}
      <input class="nota-input" placeholder="Nota para cocina (opcional)" data-nota="${it.id}" value="${escapeHtml(l.nota || '')}">
    </div>`;
      })
      .join('') ||
    `<p style="text-align:center;color:var(--color-neutral-500);padding:30px 0">Tu pedido está vacío</p>`;
  return `
  <div class="backdrop ${abierta ? 'show' : ''}" id="backdrop"></div>
  <div class="drawer ${abierta ? 'show' : ''}">
    <div class="drawer-head"><h3>Tu pedido · ${escapeHtml(nombreMesa)}</h3><button class="drawer-close" id="btnCerrarDrawer"><span class="material-symbols-outlined">close</span></button></div>
    <div class="drawer-body">${lineas}</div>
    <div class="drawer-foot">
      <div class="drawer-total"><span>Total</span><span>${cop(total())}</span></div>
      <div class="drawer-actions">
        <button class="btn-ghost" id="btnVaciar">Vaciar</button>
        <button class="btn-send" id="btnEnviarPedido" ${state.carrito.length ? '' : 'disabled'}>Enviar pedido al mesero</button>
      </div>
    </div>
  </div>`;
}

function bindApp() {
  const menuSearch = document.getElementById('menuSearch');
  if (menuSearch) {
    menuSearch.oninput = (e) => {
      state.busqueda = e.target.value;
      clearTimeout(window.__searchT);
      window.__searchT = setTimeout(() => render(), 200);
    };
    if (state.busqueda) {
      menuSearch.focus();
      menuSearch.setSelectionRange(menuSearch.value.length, menuSearch.value.length);
    }
  }
  const menuSearchClear = document.getElementById('menuSearchClear');
  if (menuSearchClear) menuSearchClear.onclick = () => setState({ busqueda: '' });

  document
    .querySelectorAll('[data-cat]')
    .forEach((b) => (b.onclick = () => setState({ cat: b.dataset.cat, busqueda: '' })));
  document
    .querySelectorAll('[data-agregar]')
    .forEach((b) => (b.onclick = () => cambiar(b.dataset.agregar, 1)));
  document
    .querySelectorAll('[data-quitar]')
    .forEach((b) => (b.onclick = () => cambiar(b.dataset.quitar, -1)));

  const abrir = document.getElementById('btnAbrirCarrito');
  if (abrir) abrir.onclick = () => setState({ carritoAbierto: true });
  const backdrop = document.getElementById('backdrop');
  if (backdrop) backdrop.onclick = () => setState({ carritoAbierto: false });
  const cerrarD = document.getElementById('btnCerrarDrawer');
  if (cerrarD) cerrarD.onclick = () => setState({ carritoAbierto: false });
  const vaciar = document.getElementById('btnVaciar');
  if (vaciar)
    vaciar.onclick = () => {
      setState({ carrito: [], carritoAbierto: false });
      persistir(true);
    };
  const btnEnviar = document.getElementById('btnEnviarPedido');
  if (btnEnviar) btnEnviar.onclick = enviarPedido;

  // Igual que en mesero-app: la nota se escribe sin re-renderizar en cada
  // tecla, para no perder el foco del teclado en móvil.
  document.querySelectorAll('[data-nota]').forEach(
    (inp) =>
      (inp.oninput = (e) => {
        const linea = state.carrito.find((l) => l.id === inp.dataset.nota);
        if (linea) linea.nota = e.target.value;
        persistir();
      }),
  );
  document.querySelectorAll('[data-nota-chip]').forEach(
    (b) =>
      (b.onclick = () => {
        const actual =
          (state.carrito.find((l) => l.id === b.dataset.notaChip) || {}).nota || '';
        setNota(b.dataset.notaChip, actual.trim() === b.dataset.texto ? '' : b.dataset.texto);
      }),
  );
}

render();
cargarInicial();
