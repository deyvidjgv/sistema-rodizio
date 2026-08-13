# Rodizio Cúcuta — Sistema de pedidos

4 PWAs vanilla (HTML/CSS/JS — sin build, sin framework) que comparten **una sola** Firebase Realtime Database. Cada una se instala por separado, en el dispositivo que le corresponde, en PC y en celular.

| App | Carpeta | Para quién | Dispositivo típico |
|---|---|---|---|
| Meseros | `mesero-app/` | Toman el pedido | Celular |
| Panel de caja | `panel-caja/` | Cobro, historial, exportar Excel | Tablet/PC |
| Panel de cocina | `panel-cocina/` | Cocineros, avanzar estado | Tablet |
| Panel de administración | `panel-admin/` | Gestionar trabajadores | PC |

> **Nota:** `README.md` (en la raíz) es la documentación general del proyecto. Este archivo se centra en lo que hay que saber **antes de tocar el código**: decisiones tomadas a propósito, y trampas conocidas.

## Arquitectura de datos: REST + SSE, sin SDK (para los datos)

Firebase Realtime Database **sin el SDK de Firebase** para leer/escribir datos: todo por la REST API pública (`GET/PUT/PATCH/POST/DELETE {DB_URL}{path}.json`) y streaming en vivo con `EventSource` (Server-Sent Events). Cero dependencias, cero build.

El SDK de Firebase **sí** se usa, pero solo para Authentication (`shared/auth.js`, único archivo de `shared/` cargado como módulo ES, importa el SDK desde el CDN de gstatic).

## Esquema de Firebase

```
/pedidos/{pushId}
  codigo        "P-014"                  # correlativo diario, ver siguienteCodigo()
  mesa          "Mesa 7"                  # NOMBRE de la mesa — lo que muestran cocina y caja
  mesaId        "mesa-7"                  # id local de la mesa (ver "Mesas" abajo)
  mesero        "Juan Pérez"
  meseroUsuario "juanp"
  lineas        [{id, nombre, cat, qty, precio, nota}]
  total         123400
  estado        "enviado" | "preparacion" | "listo" | "entregado"
  ts            1690000000000             # creación
  tsCambio      1690000000000             # último cambio de estado (lo pone panel-cocina)
  pagado        true                      # opcional — lo pone panel-caja al cobrar
  tsPago        1690000000000             # opcional — timestamp del cobro

/contadores/{YYYY-MM-DD}
  <number>       # último correlativo del día, escritura con ETag condicional (evita choques)

/trabajadores/{uid}          # uid = UID de Firebase Authentication
  nombre
  usuario                    # sin "@rodizio.local" — ver usuarioAEmail() en shared/auth.js
  rolesPermitidos            # ARRAY. En la práctica solo contiene "admin" o está vacío
  estado                     # "activo" | "inactivo" — inactivo = fuera de todas las apps
  creado / actualizado
```

**No existe un nodo `/mesas`.** Si en la base quedó uno de una versión anterior, es dato muerto: ninguna app lo lee ni lo escribe. Ver "Mesas" abajo.

**Flujo de un pedido:** mesero envía (`enviado`) → cocina pasa a `preparacion` → `listo` → mesero marca `entregado` → caja confirma el cobro (`pagado: true`, sin tocar `estado`). Las apps escuchan `/pedidos` en vivo por SSE, así que un cambio se ve al instante en todas las pantallas sin refrescar.

**División de responsabilidades por panel** (a propósito, no se pisan):
- `mesero-app`: crea el pedido (`enviado`) y lo marca `entregado` cuando lo sirve.
- `panel-cocina`: avanza `enviado` → `preparacion` → `listo`. No toca cobros.
- `panel-caja`: solo ve pedidos ya `entregado` y confirma el pago (`pagado`/`tsPago`). **No** avanza el estado del pedido — eso es trabajo de cocina. Tampoco muestra el tablero Nuevos/Preparación/Listos: eso se quitó a propósito porque duplicaba a `panel-cocina`.
- `panel-admin`: gestiona trabajadores (crear, editar, activar/desactivar, eliminar). No toca pedidos.

## Acceso y roles — el modelo real

**Cualquier trabajador activo puede operar mesero, caja o cocina.** No hace falta que el admin le asigne esos roles uno por uno: los turnos rotan, y el panel que usa una persona lo define el dispositivo en el que trabaja ese día, no una lista guardada. El login raíz le muestra los 3 paneles para que elija.

`admin` es el **único** rol que se asigna explícitamente (checkbox en `panel-admin`), porque da acceso a gestionar trabajadores. Vive en `rolesPermitidos`.

**Sesión: una sola vez, en el login raíz (`/index.html`).** Cada app solo trae un *guard* que en cada carga verifica: sesión de Firebase Auth válida + perfil existe en `/trabajadores/{uid}` + `estado === "activo"`. Si algo falla, redirige a `/`. `panel-admin` además exige `hasRole(perfil, "admin")`.

Consecuencia práctica: desactivar o eliminar a un trabajador lo saca de **todas** las apps en la siguiente carga, aunque ya tuviera sesión abierta.

**Entrar a un panel sin permiso NO cierra la sesión** — solo redirige al login raíz, que reconoce la sesión existente y enruta. (Antes cerraba sesión por completo; era un bug molesto, no lo reintroduzcas.)

## Mesas — sin nodo en Firebase, ocupación calculada al vuelo

Vive todo en `mesero-app`, no hay CRUD de mesas en ningún panel:

- La grilla arranca con **Mesa 1 … Mesa 20**, generadas en memoria (`defaultMesas` en `mesero-app/app.js`). No se leen de Firebase.
- El botón **"+ Abrir otra"** deja escribir cualquier nombre ("Terraza 1", "VIP", "Barra 3") — se agrega a la grilla de esa pantalla al instante.
- Una mesa creada así **se propaga sola a los demás meseros** en cuanto tiene un pedido: `conectarPedidos()` reconstruye la lista de mesas a partir de los pedidos sin pagar que llegan por SSE. Si nunca se le manda una comanda, desaparece al recargar (es lo esperado — no era una mesa real).
- **Ocupada** = existe algún pedido de esa mesa sin `pagado`. Es un cálculo al vuelo (`mesaOcupada()`), no una bandera guardada, así que nunca puede quedar desincronizada.
- **Cualquier mesero puede entrar a cualquier mesa**, esté libre u ocupada, y mandarle una comanda nueva. No hay dueño, ni reserva, ni bloqueo — fue una decisión consciente: más simple, sin el caso raro de "mesa ocupada para siempre porque alguien la tomó y nunca la usó", a cambio de no impedir que dos personas trabajen la misma mesa a la vez.
- Elegir mesa **no escribe nada en Firebase** — es estado de esa pantalla. Recargar no "pierde" nada que importe; la mesa vuelve a aparecer sola si tiene pedidos abiertos.
- El carrito **se guarda por mesa** mientras la app está abierta (`carritosPorMesa`), para poder saltar entre mesas sin perder lo que ya se había marcado.

## Convenciones de código

- Vanilla JS, sin frameworks, sin bundler.
- Cada app son 3 archivos: `index.html` (estructura) + `styles.css` (estilos propios) + `app.js` (lógica). Lo común vive en `shared/`.
- El menú completo (162 platos/bebidas + `SUGERENCIAS` por categoría) está **inline en `mesero-app/app.js`**, no en un archivo aparte.
- IDs del menú: prefijo por categoría + número (`en1`, `pa3`, `ab2`…). Debe ser único en todo el archivo.
- Iconos y logo: **centralizados en `icons/`** en la raíz, no duplicados por panel.
- Service worker por app: cachea el cascarón para offline + instalable. Las peticiones a `firebaseio.com` **nunca** se cachean — siempre en vivo.
- Registro de cuenta **no** inicia sesión automáticamente — es intencional que vuelva al login.

## Limitaciones conocidas (aceptadas a propósito)

1. **Las reglas de RTDB están abiertas** (`.read/.write: true`) — cualquiera con la URL de la base puede leer y escribir, **aunque las 4 apps autentiquen con Firebase Auth**: el guard de cada app es una verificación de la interfaz, no una regla de la base. Cerrarlo de verdad es la "Fase 9" — ver `database.rules.json`, que es un **borrador que NO debe aplicarse todavía** (rompería las 4 apps; el archivo explica exactamente qué falta).
2. **Restablecer contraseña por correo no funciona.** Los trabajadores usan `usuario@rodizio.local` (correo sintético interno, sin bandeja real), así que Firebase no tiene a quién mandarle el link. Resetear la contraseña de otro trabajador se hace a mano desde la consola de Firebase.
3. **Eliminar un trabajador** desde `panel-admin` borra su perfil de `/trabajadores` (con eso ya no puede entrar), pero **no** borra su cuenta de Firebase Authentication — esa queda huérfana y hay que borrarla desde la consola. No hay forma de automatizarlo sin backend (Admin SDK).
4. **Crear cuentas de otros trabajadores usa una segunda instancia de Firebase** (`authSecundaria()` en `auth.js`) para que el admin no pierda su propia sesión al crear una. Es una limitación conocida del SDK, no un bug nuestro.
5. **Sin backend real:** `siguienteCodigo()` usa ETag condicional como aproximación a una transacción atómica. No es 100% a prueba de carreras con concurrencia muy alta (aceptable para el volumen de un restaurante).
6. **Exportar a Excel** (panel-caja) carga ExcelJS desde CDN la primera vez (necesita internet); después queda cacheado por el service worker.
7. **No hay forma de crear el primer admin desde la interfaz.** `panel-admin` exige ya ser admin para entrar, así que si `/trabajadores` queda vacío, hay que crear el primer registro a mano desde la consola de Firebase (ver abajo).

## Para futuras sesiones — no reintroducir estos bugs ya corregidos

- **No** volver a poner una limpieza automática de cuentas que corra en cada carga — causó un bug real: borraba cuentas legítimas cuyo usuario contenía cierto substring.
- **No** autologuear después de registrar una cuenta — es intencional que vuelva al login.
- **No** volver a duplicar `dbUrl`/`dbGet`/etc. dentro de cada app — viven solo en `shared/firebase.js`.
- **No** hacer que entrar a un panel sin permiso cierre la sesión — solo redirigir al login raíz.
- **No** volver a poner el tablero Nuevos/Preparación/Listos en `panel-caja` — duplicaba `panel-cocina` a propósito quitado.
- **No** aplicar `database.rules.json` sin antes hacer lo que ese mismo archivo lista.
- **No** volver a introducir reserva exclusiva de mesas (dueño / `meseroId` / bloqueo) — se probó y se descartó a propósito.

## Cómo crear el primer admin (consola de Firebase)

1. Firebase Console → Authentication → Users → "Add user". Email: `TUUSUARIO@rodizio.local`, cualquier contraseña. Copia el UID.
2. Firebase Console → Realtime Database → crea el nodo `/trabajadores/{ESE_UID}`:
   ```json
   { "nombre": "Tu Nombre", "usuario": "TUUSUARIO", "rolesPermitidos": ["admin"], "estado": "activo", "creado": 1690000000000 }
   ```
3. Entra a `/index.html` con ese usuario y contraseña. De ahí en adelante, el resto de trabajadores se dan de alta desde `panel-admin`.

## Despliegue

**Firebase Hosting**, sitio `rodizio` dentro del proyecto `rodizio-eb49a` (mismo proyecto que RTDB y Authentication). Deploy: `firebase deploy --only hosting:rodizio` → publica en `https://rodizio.web.app`.

Antes del primer deploy en una máquina nueva: `firebase use --add` y seleccionar `rodizio-eb49a` (el repo no versiona `.firebaserc`).

**Nota histórica:** el proyecto original (`rodizio-cucuta-08`) fue suspendido por Google Cloud Platform el 11 ago 2026, muy probablemente por abuso de terceros aprovechando las reglas de RTDB abiertas (limitación #1). Se migró todo a `rodizio-eb49a`. Si el viejo se reactiva, **no volver a usarlo** sin cerrar las reglas primero — la vulnerabilidad sigue sin corregir también en el nuevo.
