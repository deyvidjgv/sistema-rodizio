/* ─────────────────────────────────────────────────────────────
   Rodizio · Panel de administración.

   Modelo de acceso: cualquier trabajador ACTIVO puede operar mesero,
   caja o cocina sin que el admin le asigne esos roles uno a uno — el
   panel que usa lo determina el dispositivo/URL en el que trabaja hoy
   (ver guard de sesión de cada uno de esos 3 paneles). El único rol
   que sigue viviendo en rolesPermitidos es "admin", porque da acceso
   a esta pantalla (crear, editar, activar/desactivar y eliminar
   trabajadores).

   Guard de acceso: si no hay sesión, o el trabajador no tiene el rol
   "admin", se manda de vuelta al login raíz (ver app.js:iniciar()).

   Límites conocidos (sin backend/Admin SDK, ver shared/auth.js):
   - "Eliminar" borra el perfil en /trabajadores, no la cuenta de
     Firebase Authentication — pierde el acceso igual, porque todos los
     guards exigen que exista el perfil, pero la cuenta de acceso queda
     huérfana. Borrarla de verdad requiere la consola de Firebase.
   - El usuario (y por lo tanto el email sintético de login) no se
     puede cambiar una vez creada la cuenta — al editar, ese campo
     queda bloqueado.
   ───────────────────────────────────────────────────────────── */

const $ = (id) => document.getElementById(id);

function esperarAuthListo() {
  return new Promise((resolve) => {
    (function chequear() {
      if (window.login && window.onAuthStateChanged && window.crearCuenta) resolve();
      else setTimeout(chequear, 30);
    })();
  });
}

const toast = window.mostrarToast;

let trabajadores = {};   // uid -> perfil, cache de la última carga de /trabajadores
let miUid = null;        // uid del admin con la sesión activa (para los resguardos de abajo)
let editandoUid = null;  // uid en edición, o null si el formulario está en modo "crear"

// Cuántos admins ACTIVOS hay sin contar a excluirUid — para no dejar el
// sistema sin ningún admin al desactivar/quitar-rol/eliminar (no hay
// bootstrap de recuperación: si esto llega a 0, solo queda arreglarlo
// a mano desde la consola de Firebase).
function contarAdminsActivos(excluirUid) {
  return Object.entries(trabajadores).filter(([uid, t]) =>
    uid !== excluirUid && t && t.estado === "activo" && hasRole(t, "admin")
  ).length;
}

async function cargarTrabajadores() {
  const tbody = $("tbodyTrabajadores");
  try { trabajadores = (await dbGet("/trabajadores")) || {}; }
  catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-tabla">No se pudo cargar la lista — revisa tu conexión y recarga.</td></tr>`;
    return;
  }
  const filas = Object.entries(trabajadores);
  if (!filas.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="empty-tabla">Todavía no hay trabajadores registrados</td></tr>`;
    return;
  }
  filas.sort((a, b) => (a[1].nombre || "").localeCompare(b[1].nombre || ""));
  tbody.innerHTML = filas.map(([uid, t]) => {
    const esAdmin = hasRole(t, "admin");
    const esYo = uid === miUid;
    const activo = t.estado === "activo";
    return `<tr data-uid="${uid}">
      <td>${escapeHtml(t.nombre || "—")}${esYo ? ' <span class="tag-yo">(tú)</span>' : ""}</td>
      <td>@${escapeHtml(t.usuario || "—")}</td>
      <td>${esAdmin ? '<span class="rol-tag">Admin</span>' : '<span class="rol-tag rol-tag-op">Operativo</span>'}</td>
      <td><span class="badge-estado ${activo ? "activo" : "inactivo"}">${activo ? "Activo" : "Inactivo"}</span></td>
      <td class="acciones">
        <button class="link-btn" data-editar="${uid}">Editar</button>
        <button class="link-btn" data-toggle="${uid}"${esYo ? ' disabled title="No puedes desactivar tu propia cuenta"' : ""}>${activo ? "Desactivar" : "Activar"}</button>
        <button class="link-btn link-btn-danger" data-eliminar="${uid}"${esYo ? ' disabled title="No puedes eliminar tu propia cuenta"' : ""}>Eliminar</button>
      </td>
    </tr>`;
  }).join("");

  tbody.querySelectorAll("[data-editar]").forEach((b) => b.onclick = () => entrarModoEdicion(b.dataset.editar));
  tbody.querySelectorAll("[data-toggle]:not(:disabled)").forEach((b) => b.onclick = () => alternarEstado(b.dataset.toggle));
  tbody.querySelectorAll("[data-eliminar]:not(:disabled)").forEach((b) => b.onclick = () => eliminarTrabajador(b.dataset.eliminar));
}

/* ── Formulario: modo creación / modo edición ── */

function entrarModoEdicion(uid) {
  const t = trabajadores[uid];
  if (!t) return;
  editandoUid = uid;
  $("formTitulo").textContent = "Editar trabajador";
  $("formSub").textContent = `Editando a @${t.usuario || "—"} — el usuario no se puede cambiar una vez creada la cuenta.`;
  $("fNombre").value = t.nombre || "";
  $("fUsuario").value = t.usuario || "";
  $("fUsuario").disabled = true;
  $("campoPassword").classList.add("hidden");
  $("fEsAdmin").checked = hasRole(t, "admin");
  $("fActivo").checked = t.estado === "activo";
  $("errCrear").classList.add("hidden");
  $("okCrear").classList.add("hidden");
  $("btnCrear").textContent = "Guardar cambios";
  $("btnCancelarEdicion").classList.remove("hidden");
  $("formCrear").scrollIntoView({ behavior: "smooth", block: "start" });
}

function salirModoEdicion() {
  editandoUid = null;
  $("formTitulo").textContent = "Crear trabajador";
  $("formSub").textContent = "Se crea la cuenta en Firebase Authentication y su perfil en /trabajadores. Cualquier trabajador activo puede operar mesero, caja o cocina — el panel que use depende del dispositivo, no hace falta asignárselo aquí.";
  $("formCrear").reset();
  $("fActivo").checked = true;
  $("fUsuario").disabled = false;
  $("campoPassword").classList.remove("hidden");
  $("btnCrear").textContent = "Crear trabajador";
  $("btnCancelarEdicion").classList.add("hidden");
}

async function crearTrabajador(nombre, roles, activo) {
  const errEl = $("errCrear"), okEl = $("okCrear");
  const usuario = $("fUsuario").value.trim().toLowerCase();
  const password = $("fPassword").value;

  if (!/^[a-z0-9_-]{3,20}$/.test(usuario)) { errEl.textContent = "Usuario: 3–20 caracteres, solo letras/números/_/-."; errEl.classList.remove("hidden"); return; }
  if (password.length < 6) { errEl.textContent = "La contraseña debe tener al menos 6 caracteres."; errEl.classList.remove("hidden"); return; }

  const btn = $("btnCrear");
  btn.disabled = true; btn.textContent = "Creando…";
  try {
    const uid = await crearCuenta(usuario, password, nombre);
    const ahora = Date.now();
    await dbSet(`/trabajadores/${uid}`, {
      nombre, usuario, rolesPermitidos: roles,
      estado: activo ? "activo" : "inactivo",
      creado: ahora, actualizado: ahora
    });
    okEl.textContent = `Cuenta creada — @${usuario} ya puede entrar por el login principal.`;
    okEl.classList.remove("hidden");
    toast("Trabajador creado: " + nombre);
    salirModoEdicion();
    await cargarTrabajadores();
  } catch (err) {
    const code = err && err.code;
    let msg = "No se pudo crear la cuenta.";
    if (code === "auth/email-already-in-use") msg = "Ese usuario ya existe.";
    else if (code === "auth/weak-password") msg = "La contraseña es muy débil.";
    else if (code === "auth/network-request-failed") msg = "Sin conexión — revisa tu internet.";
    errEl.textContent = msg;
    errEl.classList.remove("hidden");
  }
  btn.disabled = false; btn.textContent = editandoUid ? "Guardar cambios" : "Crear trabajador";
}

async function guardarEdicion(uid, nombre, roles, activo) {
  const errEl = $("errCrear");
  const original = trabajadores[uid];
  const eraAdminActivo = original && original.estado === "activo" && hasRole(original, "admin");
  const seguiraSiendoAdminActivo = roles.includes("admin") && activo;
  if (eraAdminActivo && !seguiraSiendoAdminActivo && contarAdminsActivos(uid) === 0) {
    errEl.textContent = "No puedes quitarle el rol admin (ni desactivarlo) siendo el último administrador activo.";
    errEl.classList.remove("hidden");
    return;
  }

  const btn = $("btnCrear");
  btn.disabled = true; btn.textContent = "Guardando…";
  try {
    await dbUpdate(`/trabajadores/${uid}`, {
      nombre, rolesPermitidos: roles,
      estado: activo ? "activo" : "inactivo",
      actualizado: Date.now()
    });
    toast("Cambios guardados: " + nombre);
    salirModoEdicion();
    await cargarTrabajadores();
  } catch (e) {
    errEl.textContent = "No se pudo guardar — revisa tu conexión.";
    errEl.classList.remove("hidden");
  }
  btn.disabled = false; btn.textContent = "Guardar cambios";
}

async function onSubmitFormulario(e) {
  e.preventDefault();
  const errEl = $("errCrear"), okEl = $("okCrear");
  errEl.classList.add("hidden"); okEl.classList.add("hidden");

  const nombre = $("fNombre").value.trim();
  const roles = $("fEsAdmin").checked ? ["admin"] : [];
  const activo = $("fActivo").checked;
  if (nombre.length < 3) { errEl.textContent = "Escribe el nombre completo."; errEl.classList.remove("hidden"); return; }

  if (editandoUid) await guardarEdicion(editandoUid, nombre, roles, activo);
  else await crearTrabajador(nombre, roles, activo);
}

/* ── Acciones rápidas por fila: activar/desactivar, eliminar ── */

async function alternarEstado(uid) {
  const t = trabajadores[uid];
  if (!t) return;
  const activarA = t.estado !== "activo";
  if (!activarA && hasRole(t, "admin") && contarAdminsActivos(uid) === 0) {
    toast("No puedes desactivar al último administrador activo.");
    return;
  }
  try {
    await dbUpdate(`/trabajadores/${uid}`, { estado: activarA ? "activo" : "inactivo", actualizado: Date.now() });
    toast(activarA ? "Trabajador activado" : "Trabajador desactivado");
    await cargarTrabajadores();
  } catch (e) {
    toast("No se pudo actualizar — revisa la conexión");
  }
}

async function eliminarTrabajador(uid) {
  const t = trabajadores[uid];
  if (!t) return;
  if (t.estado === "activo" && hasRole(t, "admin") && contarAdminsActivos(uid) === 0) {
    toast("No puedes eliminar al último administrador activo.");
    return;
  }
  const ok = confirm(
    `¿Eliminar a ${t.nombre || t.usuario}?\n\nSu perfil se borra de /trabajadores y pierde el acceso de inmediato. ` +
    `Su cuenta de acceso (usuario/contraseña) queda registrada en Firebase Authentication — esta pantalla no puede borrarla, ` +
    `solo se puede hacer desde la consola de Firebase.`
  );
  if (!ok) return;
  try {
    await dbDelete(`/trabajadores/${uid}`);
    toast("Trabajador eliminado: " + (t.nombre || t.usuario));
    if (editandoUid === uid) salirModoEdicion();
    await cargarTrabajadores();
  } catch (e) {
    toast("No se pudo eliminar — revisa la conexión");
  }
}

async function iniciar() {
  await esperarAuthListo();

  onAuthStateChanged(async (user) => {
    if (!user) { window.location.href = "../index.html"; return; }

    let perfil;
    try { perfil = await getWorkerProfile(user.uid); }
    catch (e) { window.location.href = "../index.html"; return; }

    // Cuenta inexistente o inactiva: no hay sesión legítima que preservar.
    if (!perfil || perfil.estado !== "activo") {
      await logout();
      window.location.href = "../index.html";
      return;
    }

    // Sesión válida pero sin el rol "admin" (ej. un cajero que llegó acá por
    // error, o cambiando de pestaña): NO cerrar sesión — solo mandarlo de
    // vuelta al login raíz, que lo reconoce y lo enruta a su panel operativo
    // sin pedirle usuario/contraseña de nuevo.
    if (!hasRole(perfil, "admin")) {
      window.location.href = "../index.html";
      return;
    }

    miUid = user.uid;
    $("vistaCargando").style.display = "none";
    $("app").style.display = "block";
    cargarTrabajadores();
  });

  $("formCrear").addEventListener("submit", onSubmitFormulario);
  $("btnCancelarEdicion").addEventListener("click", salirModoEdicion);
  $("btnLogout").addEventListener("click", async () => {
    await logout();
    window.location.href = "../index.html";
  });
}

iniciar();
