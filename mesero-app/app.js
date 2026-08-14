/* ═══════════════════════════════════════════════════════════════
   Rodizio · Meseros — vanilla JS, un solo archivo, sin build.
   Los pedidos viven en Firebase Realtime Database (REST + SSE),
   así que se sincronizan al instante con el Panel de cocina.
   Sesión: guard de Firebase Authentication + rol "mesero" (ver
   shared/auth.js y shared/roles.js) — el login en sí ocurre en el
   login raíz (/index.html); esta app solo verifica y, si falla,
   redirige de vuelta ahí.
   ═══════════════════════════════════════════════════════════════ */

      // MENU/SUGERENCIAS vienen de shared/menu.js (compartido con panel-cliente).
      const CATS = MENU.map((g) => g.cat);
      const ITEM_INDEX = {};
      MENU.forEach((g) =>
        g.items.forEach((i) => {
          ITEM_INDEX[i.id] = Object.assign({ cat: g.cat }, i);
        }),
      );
      const ETIQUETA = {
        enviado: 'Enviado',
        preparacion: 'En preparación',
        listo: 'Listo para servir',
        entregado: 'Servido',
      };
      const ESTADOS = ['enviado', 'preparacion', 'listo', 'entregado'];

      /* ── Firebase Realtime Database — REST + SSE, sin SDK ni apiKey ──
   DB_URL / dbUrl / dbGet / dbPush / dbUpdate / escucharSSE /
   aplicarEventoSSE / siguienteCodigo vienen de ../shared/firebase.js ── */

      // escapeHtml viene de ../shared/util.js. "cop" es solo un alias local
      // hacia fmtCop (mismo shared/util.js) para no tocar los usos de cop(...)
      // repartidos por el resto de este archivo.
      const cop = fmtCop;

      /* ── Estado de la app ──
   mesaId es solo la mesa que ELEGISTE en esta pantalla ahora mismo —
   una selección local, sin dueño ni reserva. Cualquier mesero puede
   elegir cualquier mesa en cualquier momento, esté o no ocupada, para
   agregarle una comanda nueva.
   Las mesas NO viven en Firebase: arrancan como Mesa 1..20 acá abajo,
   se les puede agregar otra con nombre libre desde "+ Abrir otra", y
   se reconstruyen solas para los demás meseros a partir de los pedidos
   sin pagar que llegan por SSE (ver conectarPedidos). Ver CLAUDE.md,
   sección "Mesas". ── */
      const defaultMesas = {};
      for (let i = 1; i <= 20; i++) {
        defaultMesas[`mesa-${i}`] = { nombre: `Mesa ${i}`, activa: true };
      }
      const state = {
        cargandoSesion: true,
        perfil: null,
        uid: null,
        mesero: '',
        mesaId: null,
        mesas: defaultMesas,
        tab: 'mesas',
        cat: CATS[0],
        carrito: [],
        comandaAbierta: false,
        pedidos: {},
        solicitudes: {},
        conectado: false,
        toast: '',
        editandoPedidoId: null,
        busqueda: '',
        // Bandera en el state (no solo un atributo DOM transitorio) para
        // que un re-render de por medio (ej. cerrar y reabrir el drawer
        // mientras la comanda anterior sigue en vuelo) no vuelva a crear
        // un botón "Enviar" habilitado y permita mandar el pedido 2 veces.
        enviando: false,
      };

      /* ── Persistencia del carrito por mesa ──
   carritosPorMesa guarda el carrito de cada mesa para que no se pierda
   al cambiar de pestaña o seleccionar otra mesa. */
      const carritosPorMesa = {};

      function guardarCarritoMesa() {
        if (state.mesaId) {
          carritosPorMesa[state.mesaId] = {
            carrito: state.carrito.map((l) => Object.assign({}, l)),
            editandoPedidoId: state.editandoPedidoId,
          };
        }
      }

      function restaurarCarritoMesa(mesaId) {
        const guardado = carritosPorMesa[mesaId];
        if (guardado && guardado.carrito.length > 0) {
          return {
            carrito: guardado.carrito.map((l) => Object.assign({}, l)),
            editandoPedidoId: guardado.editandoPedidoId,
          };
        }
        return { carrito: [], editandoPedidoId: null };
      }

      function limpiarCarritoMesa(mesaId) {
        delete carritosPorMesa[mesaId];
      }

      // La mesa elegida ahora mismo (objeto de state.mesas), o null.
      function mesaActual() {
        return state.mesaId ? state.mesas[state.mesaId] : null;
      }
      function nombreMesaActual() {
        const m = mesaActual();
        return m ? m.nombre : null;
      }

      // Ocupada = tiene al menos un pedido sin pagar — se calcula al vuelo
      // desde /pedidos (ya lo tenemos en memoria por el SSE de conectarPedidos),
      // no se guarda como bandera aparte. Así nunca puede quedar desincronizada.
      function mesaOcupada(id) {
        return Object.values(state.pedidos).some(
          (p) => p && p.mesaId === id && !p.pagado,
        );
      }

      function setState(patch) {
        Object.assign(state, patch);
        render();
      }
      function aviso(t, opts) {
        window.mostrarToast(t, opts);
      }

      /* ── Escucha en vivo de /pedidos (solo los del mesero en turno se muestran) ── */
      let primeraCargaPedidos = true;
      let prevEstados = {}; // id -> estado, para detectar cuándo un pedido pasa a "listo"

      function conectarPedidos() {
        const es = escucharSSE('/pedidos', (tipo, evento) => {
          state.pedidos = aplicarEventoSSE(state.pedidos, tipo, evento);
          Object.values(state.pedidos).forEach((p) => {
            if (p && p.mesa && !p.pagado) {
              let raw = String(p.mesa).trim();
              let numMatch = raw.match(/\d+/);
              let id = p.mesaId || (numMatch ? `mesa-${numMatch[0]}` : raw);
              let nombre = raw.toLowerCase().startsWith('mesa') ? raw : (numMatch ? `Mesa ${numMatch[0]}` : raw);
              if (!state.mesas[id]) {
                state.mesas[id] = { nombre, activa: true };
              }
            }
          });
          detectarPedidosListos();
          setState({ conectado: true });
        });
        es.onopen = () => setState({ conectado: true });
        es.onerror = () => setState({ conectado: false });
      }

      /* ── Escucha en vivo de /solicitudes (carritos pendientes de panel-cliente) ──
   Cada mesaId con solicitud es una mesa donde un cliente ya armó (y
   mandó) su pedido desde el QR, pendiente de que el mesero lo revise
   y confirme — ver panel-cliente/app.js y CLAUDE.md. ── */
      let primeraCargaSolicitudes = true;
      let prevSolicitudes = {}; // mesaId -> tenía líneas o no, para detectar solicitudes nuevas

      function solicitudPendiente(id) {
        const s = state.solicitudes[id];
        return s && (s.lineas || []).length > 0 ? s : null;
      }

      function conectarSolicitudes() {
        escucharSSE('/solicitudes', (tipo, evento) => {
          state.solicitudes = aplicarEventoSSE(state.solicitudes, tipo, evento);
          Object.entries(state.solicitudes).forEach(([id, s]) => {
            const tieneAhora = !!solicitudPendiente(id);
            // Una mesa especial generada por QR (no en Mesa 1..20) puede
            // llegar acá antes que en /pedidos — registrarla igual que
            // conectarPedidos() hace para pedidos de mesas desconocidas.
            if (tieneAhora && !state.mesas[id]) {
              state.mesas[id] = { nombre: (s && s.mesa) || id, activa: true };
            }
            if (tieneAhora && !prevSolicitudes[id] && !primeraCargaSolicitudes) {
              avisarSolicitud(id);
            }
            prevSolicitudes[id] = tieneAhora;
          });
          primeraCargaSolicitudes = false;
          render();
        });
      }

      // Tono propio (distinto al de "pedido listo") para distinguir un
      // pedido nuevo del cliente de un pedido propio que ya está listo.
      const beepSolicitud = crearBeep([523, 659, 784]);

      function avisarSolicitud(mesaId) {
        beepSolicitud();
        const nombre = state.mesas[mesaId] ? state.mesas[mesaId].nombre : mesaId;
        aviso(nombre + ' hizo un pedido desde su mesa', { icono: 'restaurant' });
      }

      function confirmarSolicitud(mesaId) {
        const solicitud = solicitudPendiente(mesaId);
        if (!solicitud) return;
        if (
          state.carrito.length > 0 &&
          !confirm(
            'Ya tienes ítems sin enviar en la comanda de esta mesa — ¿reemplazarlos con el pedido del cliente?',
          )
        ) {
          return;
        }
        const carrito = solicitud.lineas.map((l) => ({
          id: l.id,
          qty: l.qty,
          nota: l.nota || '',
        }));
        setState({ carrito, comandaAbierta: true });
      }

      async function descartarSolicitud(mesaId) {
        try {
          await dbDelete(`/solicitudes/${mesaId}`);
        } catch (e) {
          aviso('No se pudo descartar — revisa la conexión');
        }
      }

      /* ── Mesas: generadas automáticamente (1 al 20) o agregadas localmente ── */

      // Elegir mesa es una selección local, nada más — no escribe en Firebase.
      // Cualquier mesero puede elegir cualquier mesa activa, esté libre u
      // ocupada. Al elegir una mesa ocupada, el carrito empieza VACÍO para
      // crear un pedido NUEVO (no se edita el existente automáticamente).
      // El carrito previo de la mesa actual se guarda antes de cambiar.
      function elegirMesa(id) {
        if (!state.mesas[id]) return;
        // Guardar carrito de la mesa actual antes de cambiar
        guardarCarritoMesa();
        // Restaurar carrito guardado de la mesa destino (si tenía algo pendiente)
        const restaurado = restaurarCarritoMesa(id);
        setState({
          mesaId: id,
          tab: 'menu',
          carrito: restaurado.carrito,
          editandoPedidoId: restaurado.editandoPedidoId,
          busqueda: '',
        });
      }

      // Editar pedido: solo para pedidos en estado "enviado", activado
      // explícitamente desde la vista de pedidos.
      function editarPedido(pedidoId) {
        const p = state.pedidos[pedidoId];
        if (!p || p.estado !== 'enviado') {
          aviso(
            'Solo se pueden editar pedidos que no han sido tomados por cocina',
          );
          return;
        }
        // Guardar carrito actual antes de entrar en modo edición
        guardarCarritoMesa();
        const carrito = (p.lineas || []).map((l) => Object.assign({}, l));
        const mesaId =
          p.mesaId ||
          Object.keys(state.mesas).find(
            (k) => state.mesas[k].nombre === p.mesa,
          );
        setState({
          mesaId: mesaId || state.mesaId,
          tab: 'menu',
          carrito,
          editandoPedidoId: pedidoId,
          busqueda: '',
        });
        aviso('Editando pedido ' + (p.codigo || pedidoId));
      }

      // Cancelar (borrar por completo) un pedido — solo mientras sigue en
      // "enviado", igual que editar. A diferencia de vaciar el carrito en
      // modo edición (eso solo deshabilita "Enviar", el pedido original
      // queda intacto en Firebase y la mesa sigue viéndose ocupada), esto
      // borra el pedido de /pedidos de verdad, así mesaOcupada() lo deja
      // de contar y la mesa vuelve a quedar libre si no tiene otros.
      async function cancelarPedido(pedidoId) {
        const p = state.pedidos[pedidoId];
        if (!p || p.estado !== 'enviado') {
          aviso(
            'Solo se pueden cancelar pedidos que no han sido tomados por cocina',
          );
          return;
        }
        const ok = confirm(
          `¿Cancelar el pedido ${p.codigo || ''} de ${p.mesa || 'esta mesa'}?\n\nSe borra por completo — no se puede deshacer.`,
        );
        if (!ok) return;
        try {
          await dbDelete(`/pedidos/${pedidoId}`);
          if (state.editandoPedidoId === pedidoId) {
            limpiarCarritoMesa(state.mesaId);
            setState({ carrito: [], editandoPedidoId: null, comandaAbierta: false });
          } else {
            render();
          }
          aviso('Pedido cancelado · ' + (p.mesa || ''));
        } catch (e) {
          aviso('No se pudo cancelar — revisa la conexión');
        }
      }

      // Aviso de cambio a cocina — para cuando el cliente pide modificar o
      // quitar algo DESPUÉS de que cocina ya tomó el pedido (estado
      // "preparacion"/"listo"), donde ya no se puede editar/cancelar en
      // silencio desde acá. En vez de reescribir "lineas" sin que cocina se
      // entere, esto solo cuelga un aviso visible+sonoro en panel-cocina
      // para que se coordinen de viva voz — el pedido real no se toca.
      async function avisarCambioCocina(pedidoId) {
        const p = state.pedidos[pedidoId];
        if (!p) return;
        const nota = prompt(
          '¿Qué quiere cambiar o quitar el cliente? (esto solo avisa a cocina, no modifica el pedido)',
          '',
        );
        if (nota === null) return;
        try {
          await dbUpdate(`/pedidos/${pedidoId}`, {
            avisoCambio: { mensaje: nota.trim(), mesero: state.mesero, ts: Date.now() },
          });
          aviso('Aviso enviado a cocina · ' + (p.mesa || ''));
        } catch (e) {
          aviso('No se pudo avisar — revisa la conexión');
        }
      }

      // Avisa (sonido + notificación del sistema) apenas un pedido del mesero
      // actual pasa a "listo" — sin importar en qué mesa o pestaña esté parado,
      // así no tiene que ir hasta la otra mesa a comprobar.
      function detectarPedidosListos() {
        Object.entries(state.pedidos).forEach(([id, p]) => {
          if (!p || p.mesero !== state.mesero) {
            prevEstados[id] = p ? p.estado : undefined;
            return;
          }
          const antes = prevEstados[id];
          if (
            p.estado === 'listo' &&
            antes !== 'listo' &&
            !primeraCargaPedidos
          ) {
            avisarListo(p);
          }
          prevEstados[id] = p.estado;
        });
        primeraCargaPedidos = false;
      }

      function pedirPermisoNotificaciones() {
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }
      }

      // Tono propio de "pedido listo" (distinto al de aviso de cocina/caja),
      // generado con la fábrica compartida crearBeep() de ../shared/util.js.
      const beepListo = crearBeep([740, 1040]);

      function avisarListo(p) {
        beepListo();
        aviso(p.mesa + ' lista · ' + (p.codigo || ''), { icono: 'notifications' });
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(p.mesa + ' lista para servir', {
              body: (p.codigo || 'Pedido') + ' · toca para ver el detalle',
              icon: '../icons/icon-192.png',
              tag: 'rodizio-listo',
            });
          } catch (e) {}
        }
      }

      /* ── Auth — sesión de Firebase Authentication verificada contra el rol
   "mesero" en /trabajadores/{uid} (ver shared/auth.js y shared/roles.js).
   "admin" también pasa el guard de cualquier panel, para poder
   supervisar/probar sin necesitar cada rol asignado por separado.
   El login en sí ocurre en el login raíz (/index.html); esta app solo
   valida en cada carga y expulsa si no hay sesión, el perfil no existe,
   está inactivo, o no tiene el rol "mesero" (ni "admin"). ── */
      function esperarAuthListo() {
        return new Promise((resolve) => {
          (function chequear() {
            if (window.onAuthStateChanged && window.logout) resolve();
            else setTimeout(chequear, 30);
          })();
        });
      }

      async function salir() {
        await logout();
        window.location.href = '../index.html';
      }

      async function iniciarSesion() {
        await esperarAuthListo();
        onAuthStateChanged(async (user) => {
          if (!user) {
            window.location.href = '../index.html';
            return;
          }
          let perfil;
          try {
            perfil = await getWorkerProfile(user.uid);
          } catch (e) {
            window.location.href = '../index.html';
            return;
          }
          // Cualquier trabajador activo puede operar como mesero — ya no
          // depende de que el admin le asigne el rol "mesero" puntualmente
          // (los turnos rotan). Solo se cierra sesión de verdad si la cuenta
          // no existe o está inactiva; si el perfil es válido no hay que
          // sacarlo de Firebase Authentication.
          if (!perfil || perfil.estado !== 'activo') {
            await logout();
            window.location.href = '../index.html';
            return;
          }
          setState({
            cargandoSesion: false,
            perfil,
            uid: user.uid,
            mesero: perfil.nombre || perfil.usuario || 'Mesero',
          });
          conectarPedidos();
          conectarSolicitudes();
          pedirPermisoNotificaciones();
        });
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
      }
      function setNota(id, nota) {
        setState({
          carrito: state.carrito.map((l) =>
            l.id === id ? Object.assign({}, l, { nota }) : l,
          ),
        });
      }
      function total() {
        return state.carrito.reduce(
          (s, l) => s + ITEM_INDEX[l.id].precio * l.qty,
          0,
        );
      }

      /* ── Enviar comanda a Firebase ── */
      async function enviar() {
        // Guardado en state (no solo deshabilitando el botón en el DOM):
        // así, si de por medio se cierra/reabre el drawer mientras la
        // petición sigue en vuelo, el nuevo botón "Enviar" que se rendericé
        // también nace deshabilitado — sin esto, una conexión lenta permitía
        // reabrir el drawer y mandar la misma comanda dos veces.
        if (state.enviando) return;
        setState({ enviando: true });
        const btn = document.getElementById('btnEnviar');
        if (btn) {
          btn.disabled = true;
          btn.textContent = 'Enviando…';
        }
        const lineas = state.carrito.map((l) => ({
          id: l.id,
          nombre: ITEM_INDEX[l.id].nombre,
          cat: ITEM_INDEX[l.id].cat,
          qty: l.qty,
          precio: ITEM_INDEX[l.id].precio,
          nota: (l.nota || '').trim(),
        }));
        const totalPedido = lineas.reduce((s, l) => s + l.precio * l.qty, 0);
        const nombreMesa = nombreMesaActual();

        try {
          if (state.editandoPedidoId) {
            // Verificar que el pedido sigue en estado "enviado" (pudo haber avanzado
            // mientras el mesero editaba) — si ya no está en "enviado", crear uno nuevo.
            const pedidoExistente = state.pedidos[state.editandoPedidoId];
            if (pedidoExistente && pedidoExistente.estado === 'enviado') {
              try {
                await dbUpdate(`/pedidos/${state.editandoPedidoId}`, {
                  lineas,
                  total: totalPedido,
                  tsModificado: Date.now(),
                });
                limpiarCarritoMesa(state.mesaId);
                setState({
                  carrito: [],
                  comandaAbierta: false,
                  tab: 'pedidos',
                  editandoPedidoId: null,
                });
                aviso('Comanda actualizada · ' + nombreMesa);
              } catch (e) {
                aviso('No se pudo actualizar — revisa la conexión');
              }
            } else {
              // Pedido ya fue tomado por cocina, crear uno nuevo en vez de sobreescribir
              aviso('Cocina ya tomó ese pedido — se creará uno nuevo');
              state.editandoPedidoId = null;
              await enviarNuevo(lineas, totalPedido, nombreMesa);
            }
          } else {
            await enviarNuevo(lineas, totalPedido, nombreMesa);
          }
        } finally {
          // Se resetea siempre (éxito o error) y vía setState — así, aunque
          // el drawer se haya cerrado y reabierto de por medio (creando un
          // botón nuevo en el DOM), el próximo render ya sabe que se puede
          // volver a enviar en vez de quedar bloqueado o duplicar el envío.
          setState({ enviando: false });
          const btnActual = document.getElementById('btnEnviar');
          if (btnActual) {
            btnActual.disabled = state.carrito.length === 0;
            btnActual.textContent = 'Enviar a cocina';
          }
        }
      }

      async function enviarNuevo(lineas, totalPedido, nombreMesa) {
        const codigo = await siguienteCodigo();
        const pedido = {
          // "mesa" guarda el NOMBRE (lo que muestran cocina y caja tal cual);
          // "mesaId" es la referencia a /mesas, usada solo para calcular si la
          // mesa sigue ocupada (mesaOcupada() en base a pedidos sin pagar).
          codigo,
          mesa: nombreMesa,
          mesaId: state.mesaId,
          mesero: state.mesero,
          meseroUsuario: state.perfil ? state.perfil.usuario : '',
          lineas,
          total: totalPedido,
          estado: 'enviado',
          ts: Date.now(),
        };
        try {
          await dbPush('/pedidos', pedido);
          limpiarCarritoMesa(state.mesaId);
          // Si esta mesa tenía un pedido de cliente pendiente, ya se cargó
          // (o se descartó) — no volver a ofrecerlo una vez enviado a cocina.
          if (solicitudPendiente(state.mesaId)) {
            dbDelete(`/solicitudes/${state.mesaId}`).catch(() => {});
          }
          setState({
            carrito: [],
            comandaAbierta: false,
            tab: 'pedidos',
            editandoPedidoId: null,
          });
          aviso('Comanda ' + codigo + ' enviada a cocina · ' + nombreMesa);
        } catch (e) {
          aviso('No se pudo enviar — revisa la conexión');
        }
      }

      async function marcarServido(id) {
        try {
          await dbUpdate(`/pedidos/${id}`, {
            estado: 'entregado',
            tsCambio: Date.now(),
          });
        } catch (e) {
          aviso('No se pudo marcar como servido — revisa la conexión');
        }
      }

      /* ═══════════ RENDER ═══════════ */
      function render() {
        const el = document.getElementById('app');
        if (state.cargandoSesion) {
          el.innerHTML = renderCargando();
          return;
        }
        el.innerHTML = renderApp();
        bindApp();
        if (window.actualizarBotonInstalarPWA) window.actualizarBotonInstalarPWA();
        if (state.toast) {
          const t = document.createElement('div');
          t.className = 'toast';
          t.textContent = state.toast;
          document.body.appendChild(t);
          setTimeout(() => t.remove(), 2600);
        }
      }

      function renderCargando() {
        return `
  <div class="auth-wrap">
    <div class="auth-logo"><img src="../icons/icon-192.png" alt="Rodizio"></div>
    <h1 class="auth-title">Rodizio</h1>
    <div class="spinner"></div>
    <p class="auth-sub">Verificando sesión…</p>
  </div>`;
      }

      function renderApp() {
        const activos = Object.values(state.pedidos).filter(
          (p) => p && p.mesero === state.mesero && p.estado !== 'entregado',
        );
        const listos = Object.values(state.pedidos).filter(
          (p) => p && p.mesero === state.mesero && p.estado === 'listo',
        );
        const nombreMesa = nombreMesaActual();
        return `
  <div class="topbar">
    <div class="avatar">${escapeHtml((state.mesero || '?').trim().charAt(0).toUpperCase())}</div>
    <div class="who"><b>${escapeHtml(state.mesero)}</b><span>${nombreMesa ? escapeHtml(nombreMesa) : 'Sin mesa'} · @${escapeHtml(state.perfil.usuario || '')}</span></div>
    <button class="btn-instalar-pwa" id="btnInstalarApp"><svg class="icon-download" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>Instalar</button>
    <button class="logout" id="btnSalir">Salir</button>
  </div>
  <div class="tabs">
    <button class="tab ${state.tab === 'mesas' ? 'on' : ''}" id="tabMesas">Mesas</button>
    <button class="tab ${state.tab === 'pedidos' ? 'on' : ''}" id="tabPedidos">Pedidos ${activos.length ? '· ' + activos.length : ''}</button>
  </div>
  <p class="connbar">${state.conectado ? '● Conectado con cocina' : '○ Conectando con cocina…'}</p>
  ${listos.length ? `<button class="listos-banner" id="btnVerListos"><span class="material-symbols-outlined">notifications</span> ${listos.length === 1 ? '1 pedido listo' : listos.length + ' pedidos listos'} · ${listos.map((p) => p.mesa).join(', ')} — toca para ver</button>` : ''}
  <main>${state.tab === 'mesas' ? renderMesas() : state.tab === 'menu' ? (nombreMesa ? renderMenu() : renderSinMesa()) : renderPedidos()}</main>
  ${state.tab === 'menu' && nombreMesa && state.carrito.length && !state.comandaAbierta ? renderCartBar() : ''}
  ${renderDrawer()}
  `;
      }
      function renderSinMesa() {
        return `<div class="empty-state">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9"/></svg>
    <p>Elige una mesa en la pestaña "Mesas" para empezar a tomar el pedido</p>
    <button class="cta" id="btnIrAMesas" style="margin-top:16px">Ver mesas</button>
  </div>`;
      }
      function renderMesas() {
        const mesasOrdenadas = Object.entries(state.mesas)
          .filter(([, m]) => m && m.activa !== false)
          .sort((a, b) => {
            const nomA = String(a[1].nombre || '');
            const nomB = String(b[1].nombre || '');
            const numA = parseInt(nomA.replace(/\D/g, ''));
            const numB = parseInt(nomB.replace(/\D/g, ''));
            if (!isNaN(numA) && !isNaN(numB) && numA !== numB)
              return numA - numB;
            return nomA.localeCompare(nomB, 'es', { numeric: true });
          });

        return `<div class="mesas-grid">
    ${mesasOrdenadas
      .map(([id, m]) => {
        const ocupada = mesaOcupada(id);
        const pendiente = solicitudPendiente(id);
        return `<button class="mesa-card ${id === state.mesaId ? 'elegida' : ''} ${ocupada ? 'ocupada' : ''} ${pendiente ? 'con-solicitud' : ''}" data-id="${id}">
        ${pendiente ? '<span class="mesa-solicitud-badge material-symbols-outlined">restaurant</span>' : ''}
        <b>${escapeHtml(m.nombre)}</b>
        <small>${pendiente ? 'Pedido del cliente' : ocupada ? 'Ocupada' : 'Libre'}</small>
      </button>`;
      })
      .join('')}
    <button class="mesa-card" style="border:1.5px dashed var(--color-divider);background:transparent" id="btnNuevaMesa">
      <b style="font-size:20px;line-height:1;margin-bottom:2px">+</b>
      <small>Abrir otra</small>
    </button>
  </div>`;
      }
      // Quita acentos para búsqueda flexible
      function sinAcentos(s) {
        return s
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
      }

      function renderMenu() {
        const enCarrito = {};
        state.carrito.forEach((l) => (enCarrito[l.id] = l.qty));
        const termino = sinAcentos(state.busqueda || '').trim();
        const buscando = termino.length >= 2;

        // Si está buscando, mostrar resultados de TODAS las categorías
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

        const editandoLabel = state.editandoPedidoId
          ? `<div style="background:var(--color-accent-100);border:1px solid var(--color-accent-300);border-radius:12px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:var(--color-accent-700)">
        <div style="font-weight:700;display:inline-flex;align-items:center;gap:5px"><span class="material-symbols-outlined">edit</span>Editando pedido</div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button id="btnCancelarEdicion" style="border:1px solid var(--color-accent-300);background:transparent;border-radius:999px;padding:5px 12px;font-size:12px;font-weight:600;color:var(--color-accent-700);cursor:pointer">Cancelar edición</button>
          <button id="btnCancelarPedidoEdicion" style="border:1px solid #c2410c;background:transparent;border-radius:999px;padding:5px 12px;font-size:12px;font-weight:600;color:#c2410c;cursor:pointer">Eliminar pedido</button>
        </div>
      </div>`
          : '';

        const solicitud = solicitudPendiente(state.mesaId);
        const solicitudBanner = solicitud
          ? `<div style="background:var(--color-accent-2-100);border:1px solid var(--color-accent-2-500);border-radius:14px;padding:14px;margin-bottom:12px">
        <div style="font-weight:700;color:var(--color-accent-2-700);display:flex;align-items:center;gap:6px;margin-bottom:8px"><span class="material-symbols-outlined">restaurant</span>Pedido del cliente esperando confirmación</div>
        <div style="font-size:12.5px;color:var(--color-neutral-700);display:flex;flex-direction:column;gap:2px">
          ${solicitud.lineas.map((l) => `<span>${l.qty}× ${escapeHtml(l.nombre)}${l.nota ? ' — ' + escapeHtml(l.nota) : ''}</span>`).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="btn-ghost" id="btnDescartarSolicitud" style="flex:1">Descartar</button>
          <button class="btn-send" id="btnConfirmarSolicitud" style="flex:2">Confirmar pedido</button>
        </div>
      </div>`
          : '';

        return `
  ${editandoLabel}
  ${solicitudBanner}
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
      return `<div class="plato ${q > 0 ? 'in' : ''}">
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
        return `<button class="cart-bar" id="btnAbrirComanda"><b>${unidades} ítem${unidades === 1 ? '' : 's'}</b><span>${cop(total())}</span><span class="cta-mini">Ver comanda</span></button>`;
      }
      function renderDrawer() {
        const abierta = state.comandaAbierta;
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
          `<p style="text-align:center;color:var(--color-neutral-500);padding:30px 0">Tu comanda está vacía</p>`;
        return `
  <div class="backdrop ${abierta ? 'show' : ''}" id="backdrop"></div>
  <div class="drawer ${abierta ? 'show' : ''}">
    <div class="drawer-head"><h3>Comanda · ${escapeHtml(nombreMesaActual() || '')}</h3><button class="drawer-close" id="btnCerrarDrawer"><span class="material-symbols-outlined">close</span></button></div>
    <div class="drawer-body">${lineas}</div>
    <div class="drawer-foot">
      <div class="drawer-total"><span>Total</span><span>${cop(total())}</span></div>
      <div class="drawer-actions">
        <button class="btn-ghost" id="btnVaciar">Vaciar</button>
        <button class="btn-send" id="btnEnviar" ${state.carrito.length && !state.enviando ? '' : 'disabled'}>${state.enviando ? 'Enviando…' : 'Enviar a cocina'}</button>
      </div>
    </div>
  </div>`;
      }
      function renderPedidos() {
        const mios = Object.entries(state.pedidos)
          .filter(([, p]) => p && p.mesero === state.mesero)
          .sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0));
        if (!mios.length) {
          return `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="7" width="16" height="13" rx="2"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/></svg><p>Aún no has enviado comandas en este turno</p></div>`;
        }
        return mios
          .map(([id, p]) => {
            const idx = ESTADOS.indexOf(p.estado);
            const min = Math.max(0, Math.round((Date.now() - p.ts) / 60000));
            const color =
              p.estado === 'listo'
                ? 'var(--color-accent-2-600)'
                : p.estado === 'entregado'
                  ? 'var(--color-neutral-500)'
                  : 'var(--color-accent)';
            const pasos = ['Enviado', 'En preparación', 'Listo', 'Servido'];
            // Editar/cancelar solo para pedidos en estado "enviado" — una vez
            // que cocina lo toma ("preparacion" en adelante) ya no se puede
            // deshacer desde acá.
            const btnEditar =
              p.estado === 'enviado'
                ? `<div style="display:flex;gap:8px;margin-top:12px">
              <button class="btn-servir" style="background:var(--color-accent);flex:2;margin-top:0" data-editar="${id}"><span class="material-symbols-outlined">edit</span>Editar pedido</button>
              <button class="btn-servir" style="background:transparent;border:1px solid var(--color-divider);color:#c2410c;flex:1;margin-top:0" data-cancelar="${id}"><span class="material-symbols-outlined">delete</span>Cancelar</button>
            </div>`
                : '';
            // Ya en "preparacion"/"listo" no se puede editar/cancelar en
            // silencio — solo avisar a cocina para coordinar en persona.
            const btnAviso =
              p.estado === 'preparacion' || p.estado === 'listo'
                ? p.avisoCambio
                  ? `<p style="font-size:11.5px;color:var(--color-neutral-500);margin-top:10px;text-align:center">Aviso enviado — esperando a cocina</p>`
                  : `<button class="btn-servir" style="background:transparent;border:1px solid var(--color-divider);color:var(--color-neutral-700);margin-top:12px" data-avisar="${id}"><span class="material-symbols-outlined">campaign</span>Avisar cambio a cocina</button>`
                : '';
            return `<div class="pedido-card ${p.estado === 'listo' ? 'listo' : ''}">
      <div class="p-top"><span class="p-mesa">${escapeHtml(String(p.mesa ?? '—'))}</span><span class="p-badge" style="background:${color}">${escapeHtml(ETIQUETA[p.estado] || p.estado)}</span></div>
      <p class="p-meta">${escapeHtml(p.codigo || id)} · hace ${min} min · ${(p.lineas || []).reduce((n, l) => n + l.qty, 0)} ítems</p>
      <div class="pasos">${pasos.map((nombre, i) => `<div><div class="paso-bar" style="background:${i <= idx ? color : 'var(--color-neutral-300)'}"></div><div class="paso-label" style="color:${i <= idx ? 'var(--color-neutral-800)' : 'var(--color-neutral-500)'}">${nombre}</div></div>`).join('')}</div>
      <div class="p-lineas">${(p.lineas || []).map((l) => `<div class="p-linea"><span class="desc">${l.qty}× ${escapeHtml(l.nombre)}${l.nota ? `<span class="nota">${escapeHtml(l.nota)}</span>` : ''}</span><span>${cop(l.precio * l.qty)}</span></div>`).join('')}</div>
      <div class="p-total"><span>Total</span><span>${cop(p.total)}</span></div>
      ${p.estado === 'listo' ? `<button class="btn-servir" data-servir="${id}">Marcar servido</button>` : ''}
      ${btnEditar}
      ${btnAviso}
    </div>`;
          })
          .join('');
      }

      function bindApp() {
        // Guardar carrito antes de cambiar de pestaña
        document.getElementById('tabMesas').onclick = () => {
          guardarCarritoMesa();
          setState({ tab: 'mesas' });
        };
        document.getElementById('tabPedidos').onclick = () => {
          guardarCarritoMesa();
          setState({ tab: 'pedidos' });
        };
        const btnVerListos = document.getElementById('btnVerListos');
        if (btnVerListos)
          btnVerListos.onclick = () => {
            guardarCarritoMesa();
            setState({ tab: 'pedidos' });
          };
        const btnIrAMesas = document.getElementById('btnIrAMesas');
        if (btnIrAMesas)
          btnIrAMesas.onclick = () => {
            guardarCarritoMesa();
            setState({ tab: 'mesas' });
          };

        document
          .querySelectorAll('.mesa-card[data-id]')
          .forEach((b) => (b.onclick = () => elegirMesa(b.dataset.id)));
        const btnNueva = document.getElementById('btnNuevaMesa');
        if (btnNueva) {
          btnNueva.onclick = () => {
            const nom = prompt(
              'Nombre o número para la nueva mesa (Ej: Mesa 21, Terraza, etc):',
            );
            if (nom && nom.trim()) {
              const id = 'custom_' + Date.now();
              state.mesas[id] = { nombre: nom.trim(), activa: true };
              elegirMesa(id);
            }
          };
        }

        document.getElementById('btnSalir').onclick = salir;

        // Buscador de menú — actualiza sin re-renderizar en cada tecla
        // para no perder foco del teclado en móvil
        const menuSearch = document.getElementById('menuSearch');
        if (menuSearch) {
          menuSearch.oninput = (e) => {
            state.busqueda = e.target.value;
            // Debounce: solo re-renderizar después de parar de escribir
            clearTimeout(window.__searchT);
            window.__searchT = setTimeout(() => render(), 200);
          };
          // Enfocar el campo si ya tenía texto (post re-render)
          if (state.busqueda) {
            menuSearch.focus();
            menuSearch.setSelectionRange(
              menuSearch.value.length,
              menuSearch.value.length,
            );
          }
        }
        const menuSearchClear = document.getElementById('menuSearchClear');
        if (menuSearchClear)
          menuSearchClear.onclick = () => setState({ busqueda: '' });

        // Cancelar edición
        const btnCancelarEdicion =
          document.getElementById('btnCancelarEdicion');
        if (btnCancelarEdicion)
          btnCancelarEdicion.onclick = () => {
            limpiarCarritoMesa(state.mesaId);
            setState({ carrito: [], editandoPedidoId: null });
          };

        const btnConfirmarSolicitud = document.getElementById(
          'btnConfirmarSolicitud',
        );
        if (btnConfirmarSolicitud)
          btnConfirmarSolicitud.onclick = () => confirmarSolicitud(state.mesaId);
        const btnDescartarSolicitud = document.getElementById(
          'btnDescartarSolicitud',
        );
        if (btnDescartarSolicitud)
          btnDescartarSolicitud.onclick = () => descartarSolicitud(state.mesaId);

        document
          .querySelectorAll('[data-cat]')
          .forEach(
            (b) =>
              (b.onclick = () =>
                setState({ cat: b.dataset.cat, busqueda: '' })),
          );
        document
          .querySelectorAll('[data-agregar]')
          .forEach((b) => (b.onclick = () => cambiar(b.dataset.agregar, 1)));
        document
          .querySelectorAll('[data-quitar]')
          .forEach((b) => (b.onclick = () => cambiar(b.dataset.quitar, -1)));

        const abrir = document.getElementById('btnAbrirComanda');
        if (abrir) abrir.onclick = () => setState({ comandaAbierta: true });
        const backdrop = document.getElementById('backdrop');
        if (backdrop)
          backdrop.onclick = () => setState({ comandaAbierta: false });
        const cerrarD = document.getElementById('btnCerrarDrawer');
        if (cerrarD)
          cerrarD.onclick = () => setState({ comandaAbierta: false });
        const vaciar = document.getElementById('btnVaciar');
        if (vaciar)
          vaciar.onclick = () => {
            limpiarCarritoMesa(state.mesaId);
            setState({
              carrito: [],
              comandaAbierta: false,
              editandoPedidoId: null,
            });
          };
        const btnEnviar = document.getElementById('btnEnviar');
        if (btnEnviar) btnEnviar.onclick = enviar;

        // Igual que en los campos de auth: la nota se escribe sin re-renderizar
        // en cada tecla, para no perder el foco del teclado en móvil.
        document.querySelectorAll('[data-nota]').forEach(
          (inp) =>
            (inp.oninput = (e) => {
              const linea = state.carrito.find(
                (l) => l.id === inp.dataset.nota,
              );
              if (linea) linea.nota = e.target.value;
            }),
        );
        document.querySelectorAll('[data-nota-chip]').forEach(
          (b) =>
            (b.onclick = () => {
              const actual =
                (state.carrito.find((l) => l.id === b.dataset.notaChip) || {})
                  .nota || '';
              setNota(
                b.dataset.notaChip,
                actual.trim() === b.dataset.texto ? '' : b.dataset.texto,
              );
            }),
        );
        document
          .querySelectorAll('[data-servir]')
          .forEach((b) => (b.onclick = () => marcarServido(b.dataset.servir)));
        // Editar/cancelar pedido desde la vista de pedidos
        document
          .querySelectorAll('[data-editar]')
          .forEach((b) => (b.onclick = () => editarPedido(b.dataset.editar)));
        document
          .querySelectorAll('[data-cancelar]')
          .forEach((b) => (b.onclick = () => cancelarPedido(b.dataset.cancelar)));
        document
          .querySelectorAll('[data-avisar]')
          .forEach((b) => (b.onclick = () => avisarCambioCocina(b.dataset.avisar)));
        const btnCancelarPedidoEdicion = document.getElementById(
          'btnCancelarPedidoEdicion',
        );
        if (btnCancelarPedidoEdicion)
          btnCancelarPedidoEdicion.onclick = () =>
            cancelarPedido(state.editandoPedidoId);
      }

      render();
      iniciarSesion();
