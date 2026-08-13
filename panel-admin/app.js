/* ─────────────────────────────────────────────────────────────
   Rodizio · Panel de administración — versión mínima.
   Alcance a propósito reducido: SOLO crear trabajadores + verlos
   en una lista de solo lectura. Editar, desactivar/activar, quitar
   roles y restablecer contraseña de otro trabajador quedan para más
   adelante (ver claude.md, sección "Pendientes").

   Guard de acceso: si no hay sesión, o el trabajador no tiene el rol
   "admin" entre sus rolesPermitidos, se manda de vuelta al login raíz.
   ───────────────────────────────────────────────────────────── */

const ROLES_DISPONIBLES = ["admin", "mesero", "cajero", "cocinero"];
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

function pintarRolesGrid() {
  $("rolesGrid").innerHTML = ROLES_DISPONIBLES.map((r) => `
    <label class="role-chip" data-rol="${r}">
      <input type="checkbox" value="${r}"> ${r[0].toUpperCase() + r.slice(1)}
    </label>`).join("");
  document.querySelectorAll(".role-chip").forEach((chip) => {
    const input = chip.querySelector("input");
    chip.addEventListener("click", (e) => {
      if (e.target !== input) input.checked = !input.checked;
      chip.classList.toggle("on", input.checked);
    });
  });
}

function rolesSeleccionados() {
  return Array.from(document.querySelectorAll(".role-chip input:checked")).map((i) => i.value);
}

async function cargarTrabajadores() {
  const tbody = $("tbodyTrabajadores");
  let todos;
  try { todos = (await dbGet("/trabajadores")) || {}; }
  catch (e) { tbody.innerHTML = `<tr><td colspan="4" class="empty-tabla">No se pudo cargar la lista — revisa tu conexión y recarga.</td></tr>`; return; }
  const filas = Object.values(todos);
  if (!filas.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-tabla">Todavía no hay trabajadores registrados</td></tr>`;
    return;
  }
  filas.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
  tbody.innerHTML = filas.map((t) => `
    <tr>
      <td>${escapeHtml(t.nombre || "—")}</td>
      <td>@${escapeHtml(t.usuario || "—")}</td>
      <td>${(t.rolesPermitidos || []).map((r) => `<span class="rol-tag">${escapeHtml(r)}</span>`).join("") || "—"}</td>
      <td><span class="badge-estado ${t.estado === "activo" ? "activo" : "inactivo"}">${escapeHtml(t.estado || "—")}</span></td>
    </tr>`).join("");
}

async function crearTrabajador(e) {
  e.preventDefault();
  const errEl = $("errCrear"), okEl = $("okCrear");
  errEl.classList.add("hidden"); okEl.classList.add("hidden");

  const nombre = $("fNombre").value.trim();
  const usuario = $("fUsuario").value.trim().toLowerCase();
  const password = $("fPassword").value;
  const roles = rolesSeleccionados();
  const activo = $("fActivo").checked;

  if (nombre.length < 3) { errEl.textContent = "Escribe el nombre completo."; errEl.classList.remove("hidden"); return; }
  if (!/^[a-z0-9_-]{3,20}$/.test(usuario)) { errEl.textContent = "Usuario: 3–20 caracteres, solo letras/números/_/-."; errEl.classList.remove("hidden"); return; }
  if (password.length < 6) { errEl.textContent = "La contraseña debe tener al menos 6 caracteres."; errEl.classList.remove("hidden"); return; }
  if (roles.length === 0) { errEl.textContent = "Selecciona al menos un rol."; errEl.classList.remove("hidden"); return; }

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
    $("formCrear").reset();
    document.querySelectorAll(".role-chip").forEach((c) => c.classList.remove("on"));
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
  btn.disabled = false; btn.textContent = "Crear trabajador";
}


async function iniciar() {
  await esperarAuthListo();
  pintarRolesGrid();

  onAuthStateChanged(async (user) => {
    if (!user) { window.location.href = "../index.html"; return; }

    let perfil;
    try { perfil = await getWorkerProfile(user.uid); }
    catch (e) { window.location.href = "../index.html"; return; }

    if (!perfil || perfil.estado !== "activo" || !hasRole(perfil, "admin")) {
      await logout();
      window.location.href = "../index.html";
      return;
    }

    $("vistaCargando").style.display = "none";
    $("app").style.display = "block";
    cargarTrabajadores();
  });

  $("formCrear").addEventListener("submit", crearTrabajador);
  $("btnLogout").addEventListener("click", async () => {
    await logout();
    window.location.href = "../index.html";
  });
}

iniciar();