/* ─────────────────────────────────────────────────────────────
       Rodizio · Login raíz — punto de entrada único del sistema.
       Autentica con Firebase Authentication (shared/auth.js), lee el
       perfil del trabajador en /trabajadores/{uid} (shared/roles.js) y
       redirige a la app que le corresponde según su rol. Si tiene más
       de un rol permitido, deja elegir con cuál entra hoy.
       ───────────────────────────────────────────────────────────── */

    // Carpeta de cada app según el rol.
    const RUTA_POR_ROL = {
      admin: "panel-admin/",
      mesero: "mesero-app/",
      cajero: "panel-caja/",
      cocinero: "panel-cocina/"
    };
    const NOMBRE_ROL = { admin: "Administrador", mesero: "Mesero", cajero: "Caja", cocinero: "Cocina" };

    const $ = (id) => document.getElementById(id);

    // Solo true si revisarSiMostrarBootstrap() confirmó que /trabajadores
    // todavía no tiene ningún admin activo — ver esa función más abajo.
    let bootstrapPermitido = false;

    function mostrar(id) {
      ["formLogin", "vistaRoles", "vistaCargando"].forEach((otro) => $(otro).classList.toggle("hidden", otro !== id));
      $("btnMostrarRegistro").classList.toggle("hidden", id !== "formLogin" || !bootstrapPermitido);
      $("formRegistro").classList.add("hidden");
    }

    function mostrarError(msg) {
      const el = $("errLogin");
      el.textContent = msg;
      el.classList.remove("hidden");
    }
    function limpiarError() {
      $("errLogin").classList.add("hidden");
    }

    // Espera a que shared/auth.js (módulo ES) haya colgado sus funciones
    // en window antes de usarlas — se cargan casi al instante, pero por
    // las dudas en conexiones lentas.
    function esperarAuthListo() {
      return new Promise((resolve) => {
        (function chequear() {
          if (window.login && window.onAuthStateChanged) resolve();
          else setTimeout(chequear, 30);
        })();
      });
    }

    async function irARol(rol) {
      const ruta = RUTA_POR_ROL[rol];
      if (!ruta) {
        mostrarError(`El panel de "${NOMBRE_ROL[rol] || rol}" todavía no está disponible. Habla con el administrador.`);
        return;
      }
      setActiveRole(rol);
      window.location.href = ruta;
    }

    async function despuesDeLogin(user) {
      let perfil;
      try {
        perfil = await getWorkerProfile(user.uid);
      } catch (e) {
        mostrarError("No se pudo verificar tu cuenta — revisa tu conexión.");
        mostrar("formLogin");
        return;
      }

      if (!perfil) {
        mostrarError("Tu cuenta no está registrada en el sistema. Contacta al administrador.");
        await logout();
        mostrar("formLogin");
        return;
      }
      if (perfil.estado && perfil.estado !== "activo") {
        mostrarError("Tu cuenta está desactivada. Contacta al administrador.");
        await logout();
        mostrar("formLogin");
        return;
      }

      const roles = perfil.rolesPermitidos || [];
      if (roles.length === 0) {
        mostrarError("Tu cuenta no tiene ningún rol asignado todavía. Contacta al administrador.");
        await logout();
        mostrar("formLogin");
        return;
      }
      if (roles.length === 1) {
        irARol(roles[0]);
        return;
      }

      // Varios roles: dejar elegir.
      $("bienvenida").textContent = "Hola, " + (perfil.nombre ? perfil.nombre.split(" ")[0] : "de nuevo");
      $("listaRoles").innerHTML = roles.map((rol) => `
    <button class="rol-btn" data-rol="${rol}">
      ${NOMBRE_ROL[rol] || rol}
      ${RUTA_POR_ROL[rol] ? "" : '<span class="tag">Próximamente</span>'}
    </button>`).join("");
      document.querySelectorAll(".rol-btn").forEach((b) => b.onclick = () => irARol(b.dataset.rol));
      mostrar("vistaRoles");
    }

    // Mitigación de cliente para el bootstrap: solo se ofrece crear un admin
    // nuevo si todavía no hay ninguno activo en /trabajadores. No reemplaza
    // las reglas de Firebase RTDB — solo evita que se muestre el botón en el
    // caso normal (sistema ya en uso), que es cuando más daño podría hacer.
    async function revisarSiMostrarBootstrap() {
      try {
        const todos = (await dbGet("/trabajadores")) || {};
        const hayAdmin = Object.values(todos).some(
          (t) => t && t.estado === "activo" && Array.isArray(t.rolesPermitidos) && t.rolesPermitidos.includes("admin")
        );
        if (!hayAdmin) {
          bootstrapPermitido = true;
          // Si ya se está mostrando el login (caso normal: nadie con sesión
          // activa), refleja el cambio de inmediato sin esperar otro evento.
          if (!$("formLogin").classList.contains("hidden")) mostrar("formLogin");
        }
      } catch (e) {
        // Sin conexión o sin permiso de lectura: no se muestra el botón por precaución.
      }
    }

    async function iniciar() {
      await esperarAuthListo();
      mostrar("vistaCargando");
      revisarSiMostrarBootstrap();

      onAuthStateChanged(async (user) => {
        if (user) {
          await despuesDeLogin(user);
        } else {
          mostrar("formLogin");
        }
      });

      $("formLogin").addEventListener("submit", async (e) => {
        e.preventDefault();
        limpiarError();
        const usuario = $("fUsuario").value.trim();
        const password = $("fPassword").value;
        if (!usuario || !password) { mostrarError("Escribe tu usuario y contraseña."); return; }

        const btn = $("btnEntrar");
        btn.disabled = true; btn.textContent = "Entrando…";
        try {
          await login(usuario, password);
          // onAuthStateChanged se dispara solo y sigue el flujo desde ahí.
        } catch (err) {
          const code = err && err.code;
          let msg = "No se pudo iniciar sesión.";
          if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
            msg = "Usuario o contraseña incorrectos.";
          } else if (code === "auth/too-many-requests") {
            msg = "Demasiados intentos — espera un momento e intenta de nuevo.";
          } else if (code === "auth/network-request-failed") {
            msg = "Sin conexión — revisa tu internet.";
          }
          mostrarError(msg);
          btn.disabled = false; btn.textContent = "Entrar";
        }
      });

      $("btnCancelar").addEventListener("click", async () => {
        await logout();
        mostrar("formLogin");
        $("fPassword").value = "";
      });

      // BOOTSTRAP TEMPORAL — ver comentario junto al <form id="formRegistro">.
      $("btnMostrarRegistro").addEventListener("click", () => {
        $("formLogin").classList.add("hidden");
        $("btnMostrarRegistro").classList.add("hidden");
        $("formRegistro").classList.remove("hidden");
        $("errRegistro").classList.add("hidden");
        $("okRegistro").classList.add("hidden");
      });

      $("btnCancelarRegistro").addEventListener("click", () => mostrar("formLogin"));

      $("formRegistro").addEventListener("submit", async (e) => {
        e.preventDefault();
        const errEl = $("errRegistro"), okEl = $("okRegistro");
        errEl.classList.add("hidden"); okEl.classList.add("hidden");

        const nombre = $("rNombre").value.trim();
        const usuario = $("rUsuario").value.trim().toLowerCase();
        const password = $("rPassword").value;

        if (nombre.length < 3) { errEl.textContent = "Escribe el nombre completo."; errEl.classList.remove("hidden"); return; }
        if (!/^[a-z0-9_-]{3,20}$/.test(usuario)) { errEl.textContent = "Usuario: 3–20 caracteres, solo letras/números/_/-."; errEl.classList.remove("hidden"); return; }
        if (password.length < 6) { errEl.textContent = "La contraseña debe tener al menos 6 caracteres."; errEl.classList.remove("hidden"); return; }

        const btn = $("btnRegistrar");
        btn.disabled = true; btn.textContent = "Creando…";
        try {
          const uid = await crearCuenta(usuario, password, nombre);
          const ahora = Date.now();
          await dbSet(`/trabajadores/${uid}`, {
            nombre, usuario, rolesPermitidos: ["admin"],
            estado: "activo", creado: ahora, actualizado: ahora
          });
          okEl.textContent = `Cuenta creada — inicia sesión con @${usuario}.`;
          okEl.classList.remove("hidden");
          $("formRegistro").reset();
        } catch (err) {
          const code = err && err.code;
          let msg = "No se pudo crear la cuenta.";
          if (code === "auth/email-already-in-use") msg = "Ese usuario ya existe.";
          else if (code === "auth/weak-password") msg = "La contraseña es muy débil.";
          else if (code === "auth/network-request-failed") msg = "Sin conexión — revisa tu internet.";
          errEl.textContent = msg;
          errEl.classList.remove("hidden");
        }
        btn.disabled = false; btn.textContent = "Crear administrador";
      });
    }

    iniciar();