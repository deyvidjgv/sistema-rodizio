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
  productoAbierto: null,
  enviado: false,
  clienteNombre: '', // opcional — viaja con la solicitud para que cocina sepa a nombre de quién es
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
      cliente: state.clienteNombre.trim(),
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
    setState({
      carrito: carritoDesdeLineas(solicitud.lineas),
      clienteNombre: solicitud.cliente || state.clienteNombre,
    });
  });
}

async function cargarInicial() {
  if (!mesaId) {
    setState({ cargando: false });
    return;
  }
  try {
    const solicitud = await dbGet(`/solicitudes/${mesaId}`);
    setState({
      cargando: false,
      carrito: carritoDesdeLineas(solicitud && solicitud.lineas),
      clienteNombre: (solicitud && solicitud.cliente) || '',
    });
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

function notaPartes(nota) {
  return String(nota || '')
    .split(' · ')
    .map((parte) => parte.trim())
    .filter(Boolean);
}

function alternarSugerencia(id, sugerencia) {
  const linea = state.carrito.find((l) => l.id === id);
  if (!linea) return;
  const partes = notaPartes(linea.nota);
  const indice = partes.indexOf(sugerencia);
  if (indice === -1) partes.unshift(sugerencia);
  else partes.splice(indice, 1);
  setNota(id, partes.join(' · '));
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

/* ═══════════ Animaciones que no se pueden expresar solo con CSS ═══════════
   render() reemplaza el DOM entero (innerHTML) en cada cambio de estado, así
   que nunca hay una transición real "antes → después" sobre el mismo nodo.
   Estas dos comparan el valor anterior contra el actual y agregan la clase
   de animación a mano solo cuando de verdad cambió algo. */
let unidadesCartAnterior = null;
let drawerAbiertoPrev = false;

function flotarMasUno(btn) {
  const rect = btn.getBoundingClientRect();
  const el = document.createElement('span');
  el.className = 'float-plus';
  el.textContent = '+1';
  el.style.left = rect.left + rect.width / 2 + 'px';
  el.style.top = rect.top + 'px';
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove(), { once: true });
}

function sincronizarBumpCarrito() {
  const bar = document.getElementById('btnAbrirCarrito');
  const unidades = state.carrito.reduce((n, l) => n + l.qty, 0);
  if (bar && unidadesCartAnterior !== null && unidades !== unidadesCartAnterior) {
    bar.classList.add('bump');
  }
  unidadesCartAnterior = unidades;
}

function sincronizarAnimDrawer() {
  const drawer = document.querySelector('.drawer');
  const backdrop = document.getElementById('backdrop');
  if (drawer && backdrop) {
    if (state.carritoAbierto && !drawerAbiertoPrev) {
      drawer.classList.add('anim-in');
      backdrop.classList.add('anim-in');
    } else if (!state.carritoAbierto && drawerAbiertoPrev) {
      drawer.classList.add('anim-out');
      backdrop.classList.add('anim-out');
    }
  }
  drawerAbiertoPrev = state.carritoAbierto;
}

/* ═══════════ RENDER ═══════════ */
function render() {
  const el = document.getElementById('app');
  el.innerHTML = renderApp();
  bindApp();
  sincronizarBumpCarrito();
  sincronizarAnimDrawer();
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
  ${renderProductoDetalle()}
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
    .map((it, idx) => {
      const q = enCarrito[it.id] || 0;
      const foto = it.img
        ? `<img class="plato-foto" src="${escapeHtml(it.img)}" alt="${escapeHtml(it.nombre)}" loading="lazy" onload="this.classList.add('cargada')" onerror="this.parentElement.classList.add('sin-foto');this.remove()">`
        : '';
      const delay = Math.min(idx, 8) * 30;
      return `<div class="plato ${q > 0 ? 'in' : ''}" style="animation-delay:${delay}ms">
      <div class="plato-img${it.img ? '' : ' sin-foto'}">${foto}<span class="material-symbols-outlined icon-fallback">restaurant</span></div>
      <div class="plato-info">
        ${it.catLabel ? `<span class="plato-cat">${escapeHtml(it.catLabel)}</span>` : ''}
        <b>${escapeHtml(it.nombre)}</b><small>${escapeHtml(it.desc)}</small><span class="precio">${cop(it.precio)}</span>
        <button class="ver-detalle" data-detalle="${it.id}">Ver detalle</button>
      </div>
      <div class="stepper">
        ${q > 0 ? `<button data-quitar="${it.id}">–</button><span class="qty">${q}</span>` : ''}
        <button class="add" data-agregar="${it.id}">+</button>
      </div>
    </div>`;
    })
    .join('')}`;
}

function renderProductoDetalle() {
  const it = state.productoAbierto && ITEM_INDEX[state.productoAbierto];
  if (!it) return '';
  const linea = state.carrito.find((l) => l.id === it.id);
  const nota = linea ? linea.nota || '' : '';
  const sugerencias = sugerenciasParaItem(it);
  const foto = it.img
    ? `<img src="${escapeHtml(it.img)}" alt="${escapeHtml(it.nombre)}" onerror="this.parentElement.classList.add('sin-foto');this.remove()">`
    : '';
  return `
  <div class="detalle-backdrop" id="detalleBackdrop"></div>
  <section class="detalle-sheet" role="dialog" aria-modal="true" aria-labelledby="detalleTitulo">
    <button class="detalle-close" id="btnCerrarDetalle" aria-label="Cerrar detalle"><span class="material-symbols-outlined">close</span></button>
    <div class="detalle-img${it.img ? '' : ' sin-foto'}">${foto}<span class="material-symbols-outlined icon-fallback">restaurant</span></div>
    <span class="detalle-cat">${escapeHtml(it.cat)}</span>
    <h2 id="detalleTitulo">${escapeHtml(it.nombre)}</h2>
    <p class="detalle-desc">${escapeHtml(it.desc)}</p>
    <strong class="detalle-precio">${cop(it.precio)}</strong>
    <div class="detalle-nota">
      <h3>Personaliza tu pedido</h3>
      ${sugerencias.length ? `<div class="sug detalle-sug">${sugerencias.map((t) => `<button class="${notaPartes(nota).includes(t) ? 'on' : ''}" data-detalle-nota="${it.id}" data-texto="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')}</div>` : ''}
      <input class="nota-input" id="detalleNota" placeholder="Otra indicación (opcional)" value="${escapeHtml(nota)}">
    </div>
    <div class="detalle-actions">
      <button class="detalle-qty" data-quitar="${it.id}" ${linea ? '' : 'disabled'}>−</button>
      <span>${linea ? linea.qty : 0}</span>
      <button class="detalle-qty add" data-agregar="${it.id}">+</button>
    </div>
  </section>`;
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
        const sug = sugerenciasParaItem(it);
        return `<div class="linea-row">
      <div class="linea-top">
        <b>${escapeHtml(it.nombre)}</b>
        <div class="stepper"><button data-quitar="${it.id}">–</button><span class="qty">${l.qty}</span><button class="add" data-agregar="${it.id}">+</button></div>
        <span class="sub">${cop(it.precio * l.qty)}</span>
      </div>
      ${sug.length ? `<div class="sug">${sug.map((t) => `<button class="${notaPartes(l.nota).includes(t) ? 'on' : ''}" data-nota-chip="${it.id}" data-texto="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')}</div>` : ''}
      <input class="nota-input" placeholder="Nota para cocina (opcional)" data-nota="${it.id}" value="${escapeHtml(l.nota || '')}">
    </div>`;
      })
      .join('') ||
    `<p style="text-align:center;color:var(--color-neutral-500);padding:30px 0">Tu pedido está vacío</p>`;
  return `
  <div class="backdrop ${abierta ? 'show' : ''}" id="backdrop"></div>
  <div class="drawer ${abierta ? 'show' : ''}">
    <div class="drawer-head"><h3>Tu pedido · ${escapeHtml(nombreMesa)}</h3><button class="drawer-close" id="btnCerrarDrawer"><span class="material-symbols-outlined">close</span></button></div>
    <div class="drawer-body">
      <input class="nombre-input" id="clienteNombreInput" placeholder="Tu nombre (opcional)" value="${escapeHtml(state.clienteNombre)}">
      ${lineas}
    </div>
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
  document.querySelectorAll('[data-agregar]').forEach(
    (b) =>
      (b.onclick = () => {
        flotarMasUno(b);
        cambiar(b.dataset.agregar, 1);
      }),
  );
  document
    .querySelectorAll('[data-quitar]')
    .forEach((b) => (b.onclick = () => cambiar(b.dataset.quitar, -1)));
  document.querySelectorAll('[data-detalle]').forEach(
    (b) => (b.onclick = () => setState({ productoAbierto: b.dataset.detalle })),
  );
  const cerrarDetalle = () => setState({ productoAbierto: null });
  const btnCerrarDetalle = document.getElementById('btnCerrarDetalle');
  if (btnCerrarDetalle) btnCerrarDetalle.onclick = cerrarDetalle;
  const detalleBackdrop = document.getElementById('detalleBackdrop');
  if (detalleBackdrop) detalleBackdrop.onclick = cerrarDetalle;
  const detalleNota = document.getElementById('detalleNota');
  if (detalleNota)
    detalleNota.oninput = (e) => setNota(state.productoAbierto, e.target.value);
  document.querySelectorAll('[data-detalle-nota]').forEach(
    (b) =>
      (b.onclick = () =>
        alternarSugerencia(b.dataset.detalleNota, b.dataset.texto)),
  );

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

  // Igual que las notas: se escribe sin re-renderizar en cada tecla, para
  // no perder el foco del teclado en móvil.
  const nombreInput = document.getElementById('clienteNombreInput');
  if (nombreInput)
    nombreInput.oninput = (e) => {
      state.clienteNombre = e.target.value;
      persistir();
    };

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
        alternarSugerencia(b.dataset.notaChip, b.dataset.texto);
      }),
  );
}

/* ── Aviso de tratamiento de datos (Ley 1581 de 2012 / Decreto 1377 de
   2013, Colombia) ── panel-cliente es la única app del sistema sin login,
   así que es la única que le pide un dato personal a alguien que no es
   empleado (el nombre opcional del cliente, ver clienteNombreInput arriba).
   Vive FUERA de #app (que render() reemplaza entero en cada cambio de
   estado) para no desmontarse/remontarse con cada re-render — mismo patrón
   que el toast de shared/ui.js. Es solo informativo: nunca bloquea el
   pedido por QR, que debe seguir funcionando sin fricción. */
function mostrarAvisoDatos() {
  if (localStorage.getItem('rz_aviso_datos_visto')) return;
  const el = document.createElement('div');
  el.className = 'aviso-datos';
  el.innerHTML = `
    <p>Si escribes tu nombre, lo usamos solo para identificar tu pedido en cocina — no se comparte con terceros. <a href="privacidad.html" target="_blank" rel="noopener">Más información</a></p>
    <button id="btnAvisoDatosOk" aria-label="Entendido">Entendido</button>
  `;
  document.body.appendChild(el);
  document.getElementById('btnAvisoDatosOk').onclick = () => {
    localStorage.setItem('rz_aviso_datos_visto', '1');
    el.remove();
  };
}

render();
cargarInicial();
mostrarAvisoDatos();
