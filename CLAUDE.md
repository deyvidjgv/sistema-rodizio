# Rodizio Cúcuta — Sistema de pedidos

4 PWAs vanilla (HTML/CSS/JS — sin build, sin framework) que comparten **una sola** Firebase Realtime Database. Cada una se instala por separado, en el dispositivo que le corresponde, en PC y en celular.

| App | Carpeta | Para quién | Dispositivo típico | Estado |
|---|---|---|---|---|
| Meseros | `mesero-app/` | Toman el pedido | Celular | ✅ Funcionando |
| Panel de caja | `panel-caja/` | Cobro, historial, exportar Excel | Tablet/PC | ✅ Funcionando |
| Panel de cocina | `panel-cocina/` | Cocineros, avanzar estado | Tablet | ✅ Funcionando |
| Panel cliente | `panel-cliente/` | Por definir | Por definir | ⏳ Alcance sin definir |

## Arquitectura de datos: REST + SSE, sin SDK

Firebase Realtime Database, **sin el SDK de Firebase y sin apiKey**. Todo por la REST API pública y `EventSource` (Server-Sent Events).

- **Por qué:** al empezar el proyecto no había `apiKey`/`appId`/`messagingSenderId`. La REST API de RTDB (`GET/PUT/PATCH/POST/DELETE {DB_URL}{path}.json`) y el streaming vía `new EventSource("{DB_URL}{path}.json")` funcionan solo con la URL de la base — cero dependencias, cero build.
- **Límite real:** no hay autenticación. Las reglas están abiertas (`.read/.write: true`) — cualquiera con la URL puede leer/escribir en cualquier ruta. Ver "Limitaciones".

## Esquema de Firebase

```
/pedidos/{pushId}
  codigo        "P-014"                          # correlativo diario, ver siguienteCodigo()
  mesa          7
  mesero        "Juan Pérez"
  meseroUsuario "juanp"
  lineas        [{id, nombre, cat, qty, precio, nota}]
  total         123400
  estado        "enviado" | "preparacion" | "listo" | "entregado"
  ts            1690000000000   # creación
  tsCambio      1690000000000   # último cambio de estado (lo pone panel-cocina)
  pagado        true                             # opcional — lo pone panel-caja al cobrar
  tsPago        1690000000000                    # opcional — timestamp del cobro

/contadores/{YYYY-MM-DD}
  <number>       # último correlativo del día, escritura con ETag condicional (evita choques)

/trabajadores/{uid}          # uid = UID de Firebase Authentication
  nombre
  usuario                    # sin "@rodizio.local" — ver usuarioAEmail() en shared/auth.js
  rolesPermitidos             # ["admin" | "mesero" | "cajero" | "cocinero", ...]
  estado                     # "activo" | "inactivo" — inactivo o ausente = fuera, en cualquier app
  creado

/meseros/{usuario}            # LEGACY — login por PIN ya reemplazado por Firebase Authentication
  nombre                      # (ver Fase 1 / Pendientes). Nadie lee ni escribe aquí; el nodo se
  pinHash                     # deja tal cual, sin migrar ni borrar, no estorba.
  creado
```

**Flujo de un pedido:** mesero envía (`enviado`) → cocina pasa a `preparacion` → `listo` → mesero marca `entregado` → caja confirma el cobro (`pagado: true`, no cambia `estado`). Las 3 apps escuchan `/pedidos` en vivo por SSE, así que un cambio se ve al instante en todas las pantallas sin refrescar.

**División de responsabilidades por panel** (a propósito, no se pisan):
- `mesero-app`: crea el pedido (`enviado`) y lo marca `entregado` cuando lo sirve en la mesa.
- `panel-cocina`: avanza `enviado` → `preparacion` → `listo`. No toca cobros.
- `panel-caja`: solo ve pedidos ya `entregado` y confirma el pago (`pagado`/`tsPago`). No avanza el estado del pedido — eso es trabajo de cocina.

## Convenciones de código

- Vanilla JS, sin frameworks, sin bundler.
- IDs del menú: prefijo por categoría + número (`en1`, `pa3`, `ab2`…) — ver `menu.js`.
- Sesión: **una sola vez**, en el login raíz (`/index.html`), con Firebase Authentication. Cada app (`mesero-app`, `panel-caja`, `panel-cocina`, `panel-admin`) solo trae un *guard* (`onAuthStateChanged()` + `getWorkerProfile()` + `hasRole()`) que verifica sesión + rol correcto + `estado === "activo"` en cada carga, y redirige a `/` si algo falla — nunca tienen su propio formulario de login. Así, desactivar o borrar un trabajador en `/trabajadores` lo saca de todas las apps en la siguiente carga, sin importar si ya había iniciado sesión antes.
- Registro de cuenta **no** inicia sesión automáticamente — el flujo intencional es: registrar → volver a login → la persona entra ella misma con su usuario y contraseña.
- Service worker por app: cachea el cascarón (HTML/CSS/JS/iconos) para offline + instalable. Las peticiones a `firebaseio.com` **nunca** se cachean — siempre deben ir en vivo.

## Estructura de carpetas — ✅ ya aplicada

```
rodizio/
├── shared/
│   ├── theme.css        tokens de diseño (colores, fuentes, radios, sombras) + reset base
│   ├── firebase.js      dbUrl / dbGet / dbPush / dbSet / dbUpdate / dbDelete / escucharSSE / aplicarEventoSSE / siguienteCodigo
│   └── util.js          escapeHtml, fmtCop (formato COP), crearBeep() (fábrica de tonos Web Audio)
├── mesero-app/
│   ├── index.html       login, mesa, menú, comanda, pedidos del turno
│   ├── menu.js           159 platos/bebidas + SUGERENCIAS por categoría
│   ├── manifest.webmanifest, sw.js, icon-192.png, icon-512.png, icon-512-maskable.png
├── panel-caja/            tablero + "Entregados hoy" + exportar Excel (ExcelJS vía CDN)
├── panel-cocina/          tablero simple (Nuevos/Preparación/Listos) + franja "Recién entregados"
└── panel-cliente/         (sin definir — ver pendientes)
```

**Notas del refactor ya hecho:**
- Cada `sw.js` ya precachea `theme.css`, `firebase.js`, `util.js` y `roles.js` de `shared/` (rutas relativas `../shared/...`) además de su propio cascarón, así que el offline sigue funcionando. `auth.js` (módulo ES, importa el SDK desde CDN) **no** se precachea a propósito, igual que en `panel-admin` — el login en sí siempre necesita red.
- Condición para que esto siga funcionando: **las apps deben seguir sirviéndose desde el mismo dominio/hosting**, con `shared/` como carpeta hermana de cada app. Confirmado: se despliega todo junto vía Firebase Hosting (sitio `rodizio`), así que esta condición se cumple.

## Fase 1 (Firebase Authentication) — ✅ hecha y conectada en las 4 apps

`shared/auth.js` ya existe, con la configuración real del proyecto embebida, y expone: `login()`, `logout()`, `getCurrentUser()`, `onAuthStateChanged()`, `crearCuenta()`, `restablecerPasswordPropia()`.

`shared/roles.js` también existe: `getWorkerProfile()`, `getRolesPermitidos()`, `setActiveRole()`/`getActiveRole()`, `hasRole()`, `hasPermission()`.

**Diferencia técnica importante:** `auth.js` es el único archivo de `shared/` que se carga como módulo ES (`<script type="module" src="../shared/auth.js">`), porque el SDK de Firebase Authentication se importa desde el CDN oficial (`gstatic.com/firebasejs/12.17.1/...`). `firebase.js`, `util.js` y `roles.js` siguen siendo scripts clásicos (globales, sin `type="module"`). Dentro de `auth.js`, cada función se cuelga en `window` al final para que el resto del código (scripts clásicos) la pueda llamar igual que las demás funciones compartidas.

**Limitaciones reales, ya documentadas y aceptadas conscientemente:**
1. **Restablecer contraseña por correo no funciona.** Los trabajadores usan `usuario@rodizio.local` (correo sintético interno, nunca una bandeja real), así que Firebase no tiene a quién mandarle el link de recuperación. `restablecerPasswordPropia()` solo sirve para que el propio trabajador, ya logueado, cambie su contraseña. Resetear la de otro trabajador, hoy, requiere hacerlo manualmente desde la consola de Firebase (Authentication → usuario → Reset password) — no hay forma de automatizarlo sin backend (Admin SDK o Cloud Functions).
2. **Crear cuentas de otros trabajadores usa una segunda instancia de Firebase** (`authSecundaria()` dentro de `auth.js`) para que el admin no pierda su propia sesión al crear una — es una limitación conocida del SDK de Firebase Auth, no un bug nuestro.

**Ya wireado a las 4 interfaces.** `mesero-app`, `panel-caja` y `panel-cocina` tienen guard (rol `mesero` / `cajero` / `cocinero` respectivamente); `panel-admin` tiene guard de rol `admin`. El login por PIN de `mesero-app` (`hashPin()`, `crearCuentaSiLibre()`, `/meseros`) quedó reemplazado por completo — ver nota "LEGACY" en el esquema de Firebase.

**Bootstrap temporal en el login raíz.** `index.html` (raíz) tiene un botón "Crear cuenta de administrador (bootstrap)" que llama `crearCuenta()` + escribe `/trabajadores/{uid}` con `rolesPermitidos: ["admin"]`, para crear el primer admin sin depender de la consola de Firebase ni de `panel-admin` (que a su vez exige ya tener un admin para entrar). Está marcado en el código con el comentario `BOOTSTRAP TEMPORAL` — **quitar ese bloque una vez exista al menos un admin funcional**; de ahí en adelante, dar de alta trabajadores se hace desde `panel-admin`.

## Cómo extender

- **Agregar un plato:** editar `menu.js`, agregar `{ id, nombre, desc, precio }` dentro de la categoría correspondiente. El `id` debe ser único en todo el archivo.
- **Agregar una categoría:** agregar `{ cat, items }` a `MENU` + una entrada con ese mismo nombre en `SUGERENCIAS`.
- **Agregar un panel nuevo:** partir de `panel-cocina/` (el más simple), mismo `DB_URL`, `name`/`short_name` únicos en `manifest.webmanifest`, y nombre de `CACHE` único en `sw.js`.
- **Instalar como PWA:** cada carpeta ya trae manifest + service worker + 3 iconos. Solo necesita servirse por HTTPS (o `localhost`); el navegador ofrece "Instalar" tanto en PC como en celular automáticamente.

## Limitaciones conocidas

1. **Reglas de Firebase abiertas** (`.read/.write: true`) — cualquiera con la URL de la base puede leer y escribir sin restricción, **sin importar que las 4 apps ya autentiquen con Firebase Auth**: el guard de cada app es una verificación de la interfaz, no una regla de la base de datos. Cerrar esto de verdad significa escribir reglas RTDB que exijan `auth != null` (y, según la ruta, el rol correcto) — pendiente, ver Fase 9 en Pendientes. Importante: `mesero-app`/`panel-caja`/`panel-cocina` ya mandan las peticiones REST sin token (`shared/firebase.js` no adjunta `?auth=`), así que cerrar reglas hoy las rompería — primero habría que adjuntar el ID token a esas peticiones.
2. **`/meseros` (PIN, legacy):** el nodo sigue en la base sin borrar, con el mismo riesgo de siempre (hash SHA-256 sin sal) si alguien lo lee por REST — pero ya no lo usa ninguna app, así que es dato muerto, no una superficie activa.
3. **Sin backend real:** el código secuencial (`siguienteCodigo`) usa ETag condicional como aproximación a una transacción atómica. No es 100% a prueba de carreras bajo concurrencia muy alta (aceptable para el volumen de un restaurante).
4. **Exportar a Excel** (panel-caja) depende de cargar ExcelJS desde CDN la primera vez (necesita internet); después queda cacheado por el service worker.

## Para futuras sesiones — no reintroducir estos bugs ya corregidos

- **No** volver a poner una limpieza automática de cuentas que corra en cada carga de la app — causó un bug real: borraba cuentas legítimas cuyo usuario contenía cierto substring. Si hace falta borrar una cuenta puntual, se hace una sola vez, manualmente, no como código permanente.
- **No** autologuear después de registrar una cuenta — es intencional que vuelva a login.
- Una vez adoptado el refactor a `shared/`, **no** volver a duplicar `dbUrl`/`dbGet`/etc. dentro de cada app — deben vivir solo en `shared/firebase.js`.

## Pendientes / decisiones abiertas

- [ ] Alcance de `panel-cliente` — sin definir.
- [x] **Fase 1 — Firebase Authentication:** `shared/auth.js` construido con la config real, en uso por el login raíz y por `panel-admin`.
- [x] Refactor a `shared/` (theme.css, firebase.js, util.js) — aplicado y verificado en las 3 apps existentes.
- [x] `shared/roles.js` — construido y en uso (getWorkerProfile, hasRole, etc.).
- [x] **Login raíz (`/index.html`)** — punto de entrada único: autentica, lee `/trabajadores/{uid}`, y redirige (o deja elegir, si tiene varios roles) hacia `mesero-app/`, `panel-caja/`, `panel-cocina/` o `panel-admin/`.
- [x] **`panel-admin` mínimo** — crear trabajador (Firebase Auth + `/trabajadores/{uid}`) y listado de solo lectura. Protegido con guard real: sin sesión o sin rol `admin` activo → redirige al login raíz. Editar, activar/desactivar, quitar roles y restablecer contraseña de otro trabajador **NO** están implementados todavía (alcance a propósito reducido).
- [x] **`mesero-app`, `panel-caja` y `panel-cocina` ya validan sesión** — guard con `onAuthStateChanged()` + `getWorkerProfile()` + `hasRole()` (rol `mesero`/`cajero`/`cocinero` según la app) que redirige a `/` si no hay sesión, el perfil no existe/está inactivo, o no tiene el rol correcto. Entrar directo por bookmark/URL sin pasar por el login raíz ya no funciona.
- [x] `mesero-app` reemplazó el login por PIN por el guard de sesión + rol `mesero`, igual que las demás apps.
- [ ] **Quitar el bootstrap temporal de `index.html`** (botón "Crear cuenta de administrador") una vez exista al menos un admin funcional — ver nota en la sección Fase 1.
- [ ] Revisar `"orientation": "portrait"` en el manifest de `mesero-app` ahora que también se instala en PC (los paneles ya usan `"any"`).
- [ ] Resto de fases del plan: `shared/mesas.js`, `shared/pedidos.js` (con estado por línea), `shared/qr.js`, `panel-cliente/`, cerrar las reglas abiertas de Firebase (Fase 9).
- [ ] **Decisión pendiente sobre restablecer contraseña de otro trabajador** (sección 36): sin backend, la única forma hoy es manual desde la consola de Firebase.

## Despliegue

**Firebase Hosting**, sitio `rodizio` dentro del mismo proyecto Firebase (`rodizio-eb49a`) que ya usan RTDB y Authentication — todo bajo un solo proyecto. Configurado con `firebase.json` (`"public": "."`, sirve el repo tal cual, sin mover nada a una carpeta `public/` aparte) y `.firebaserc`. Deploy: `firebase deploy --only hosting:rodizio` → publica en `https://rodizio.web.app`. El login raíz (`/index.html`) es el punto de entrada; cada app sigue siendo también una PWA instalable por separado.

**Nota histórica:** el proyecto original (`rodizio-cucuta-08`) fue suspendido por Google Cloud Platform (Trust & Safety) el 11 ago 2026, muy probablemente por abuso de terceros aprovechando las reglas de RTDB abiertas (ver "Limitaciones conocidas" #1). Se migró todo a `rodizio-eb49a` con `DB_URL` (`shared/firebase.js`) y `firebaseConfig` (`shared/auth.js`) actualizados. Si el proyecto viejo se reactiva por la apelación, **no volver a usarlo** sin antes cerrar las reglas de RTDB — la vulnerabilidad que probablemente causó la suspensión sigue sin corregir en el proyecto nuevo también.

**Pendiente manual para que `rodizio-eb49a` quede operativo** (código ya listo, falta esto en la consola de Firebase, no se puede automatizar desde el repo):
1. Authentication → Sign-in method → habilitar **Email/Password** (si no está habilitado, todo login falla con `auth/operation-not-allowed`).
2. `/trabajadores` está vacío en el proyecto nuevo — recrear la cuenta admin con el botón de bootstrap en `/index.html` (ver sección siguiente), o a mano.
3. `.firebaserc` no existe en el repo — antes del primer `firebase deploy` en este proyecto, correr `firebase use --add` y seleccionar `rodizio-eb49a`. Si se usa Hosting, también crear el sitio de Hosting dentro del proyecto nuevo desde la consola (Hosting → Comenzar) antes del primer deploy.
4. Reglas de RTDB del proyecto nuevo: revisar que no hayan quedado en modo "prueba" con vencimiento a 30 días (default de Firebase al crear la base) — igual siguen abiertas hasta que se aborde la Fase 9, pero conviene no dejarlas expirar a "todo denegado" sin darse cuenta.

## Cómo crear la primera cuenta de admin

Camino normal: `/index.html` → botón **"Crear cuenta de administrador (bootstrap)"** → llena nombre/usuario/contraseña → crea la cuenta en Firebase Auth y su perfil en `/trabajadores` con `rolesPermitidos: ["admin"]` → vuelve a login → entra con ese usuario y contraseña. Es un bloque temporal (ver Pendientes) — una vez tengas un admin, da de alta al resto desde `panel-admin`.

Alternativa manual (consola de Firebase, por si el bootstrap de arriba no está disponible):
1. Firebase Console → Authentication → Users → "Add user". Email: `TUUSUARIO@rodizio.local` (reemplaza TUUSUARIO), cualquier contraseña. Copia el UID que te muestra.
2. Firebase Console → Realtime Database → en la raíz, crea manualmente el nodo `/trabajadores/{ESE_UID}` con:
   ```json
   { "nombre": "Tu Nombre", "usuario": "TUUSUARIO", "rolesPermitidos": ["admin", "mesero"], "estado": "activo", "creado": 1690000000000 }
   ```
3. Entra a `/index.html` con usuario `TUUSUARIO` y esa contraseña.
