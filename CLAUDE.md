# Rodizio Cúcuta — Sistema de pedidos

4 PWAs vanilla (HTML/CSS/JS — sin build, sin framework) que comparten **una sola** Firebase Realtime Database. Cada una se instala por separado, en el dispositivo que le corresponde, en PC y en celular.

| App | Carpeta | Para quién | Dispositivo típico |
|---|---|---|---|
| Meseros | `mesero-app/` | Toman el pedido | Celular |
| Panel de caja | `panel-caja/` | Cobro, historial, exportar Excel | Tablet/PC |
| Panel de cocina | `panel-cocina/` | Cocineros, avanzar estado | Tablet |
| Panel de administración | `panel-admin/` | Gestionar trabajadores | PC |
| Panel de cliente | `panel-cliente/` | Comensales, piden desde la mesa vía QR | Celular propio del cliente |

`panel-cliente` es distinto a las otras 4: **no tiene login** (nadie se autentica) y **no es PWA** (sin `manifest.webmanifest` ni `sw.js`) — es una página web simple que se abre al escanear el QR de la mesa, para que cargue rápido sin fricción de instalación.

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
  cliente       "María"                   # opcional — solo si el pedido vino de una solicitud confirmada (ver panel-cliente); si falta, panel-cocina muestra el nombre del mesero en su lugar
  lineas        [{id, nombre, cat, qty, precio, nota, ronda}]  # ronda: 1, 2, 3… ver "Rondas" abajo
  total         123400
  estado        "enviado" | "preparacion" | "listo" | "entregado" | "cancelado"   # RESUMEN calculado (salvo "cancelado"), ver "Estado por ronda" abajo — no se edita a mano, se recalcula en cada cambio
  ts            1690000000000             # creación (ronda 1)
  tsCambio      1690000000000             # último cambio de estado de cualquier ronda (lo pone panel-cocina o mesero-app)
  rondaActual   1                         # número de la última ronda agregada (1 si nunca se sumó nada)
  rondas        {"1": 1690000000000}      # ronda -> timestamp en que se agregó, para mostrar "hace X min" por sección
  rondaEstados  {"1": "listo", "2": "enviado"}   # estado de CADA ronda por separado — ver "Estado por ronda" abajo
  rondaPrepInicio {"2": 1690000000000}    # opcional — ronda -> timestamp de cuándo se tocó "Empezar" para esa ronda, para su cronómetro individual
  tsUltimaRonda 1690000000000             # cambia con cada ronda nueva — dispara el aviso en panel-cocina
  avisoCambio   {mensaje, mesero, ts}     # opcional — ver "Avisar cambio a cocina" abajo
  pagado        true                      # opcional — lo pone panel-caja al cobrar
  tsPago        1690000000000             # opcional — timestamp del cobro
  metodoPago    "efectivo" | "tarjeta"    # opcional — lo pone panel-caja al cobrar
  cajero        "Laura Gómez"             # opcional — quién confirmó el cobro (mismo patrón que mesero/meseroUsuario)
  cajeroUsuario "laurag"                  # opcional
  canceladoPor  "Juan Pérez"              # opcional — solo si estado === "cancelado"; quién lo canceló (mesero-app)
  tsCancelado   1690000000000             # opcional — timestamp de la cancelación
  motivoCancelacion "Cliente se arrepintió"  # opcional — texto libre, lo pide un prompt() al cancelar

/solicitudes/{mesaId}          # carrito pendiente de un cliente vía QR, ver panel-cliente
  lineas        [{id, nombre, cat, qty, precio, nota}]   # mismo shape que pedidos.lineas
  mesa          "Mesa 7"                  # nombre visible, para que mesero-app pueda
                                           # registrar la mesa aunque no la conociera aún
  cliente       ""                        # opcional — nombre que el cliente escribe al armar el carrito; viaja a pedidos.cliente si el mesero confirma
  actualizado   1690000000000

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

**Flujo de un pedido iniciado por el cliente (QR):** el cliente escanea el QR de su mesa → abre `panel-cliente` → arma su carrito, que se guarda en vivo en `/solicitudes/{mesaId}` → toca "Enviar pedido al mesero". Eso **no** crea un pedido ni pasa a cocina — solo le avisa a `mesero-app` (sonido + toast + indicador en la tarjeta de esa mesa) que hay un pedido esperando. El mesero se acerca, revisa el detalle, y toca "Confirmar pedido": recién ahí se carga como comanda normal (`enviado` en `/pedidos`) y se borra `/solicitudes/{mesaId}`. Si el mesero prefiere no usarlo (pedido de prueba, cliente se arrepintió), puede "Descartar" sin crear nada. El cliente nunca manda nada directo a cocina.

Al armar el carrito, `panel-cliente` deja escribir un nombre opcional (`solicitudes.cliente`) que viaja al pedido si el mesero confirma. Ese nombre es lo que `panel-cocina` muestra en el ticket junto al mesero — si el mesero cargó la comanda directo (sin pasar por el QR) no hay nombre de cliente, y el ticket muestra el nombre del mesero también en ese lugar en vez de dejarlo vacío.

**Rondas — pedir más en la misma mesa NO crea un pedido nuevo.** Si el mesero envía una comanda a una mesa que ya tiene un pedido sin pagar (`pedidoActivoDeMesa()` en `mesero-app/app.js`), lo que envía se **suma como una ronda nueva** al pedido existente (`agregarRonda()`) en vez de crear un `/pedidos` aparte — antes sí creaba uno aparte, duplicando el ticket en cocina y en la pestaña "Pedidos" del mesero para la misma mesa/sentada; ver "Para futuras sesiones" más abajo. Cada línea guarda su `ronda` (1 = pedido original), y el pedido guarda `rondas` (timestamp de cuándo se agregó cada una) y `tsUltimaRonda`. `mesero-app` (pestaña Pedidos) y `panel-cocina` (cada ticket) muestran las líneas agrupadas por ronda con su propio encabezado ("Pedido inicial" / "Ronda 2 · hace X min"), usando `agruparPorRonda()` de `shared/util.js`. Por esto mismo, `cancelarPedido()` (borrar el pedido entero) y `editarPedido()` (sobreescribir "lineas" completo) solo se permiten si `rondaActual` sigue en 1 — un pedido con más de una ronda ya tuvo algo en curso o servido, así que no se puede tirar/reemplazar entero.

**Estado por ronda — cada ronda avanza y se sirve por separado.** Si una mesa ya tenía una ronda `listo` (esperando al mesero) y llega una ronda nueva, la ronda vieja **no se toca** — solo la ronda nueva arranca en `enviado`. Antes, agregar una ronda ponía TODO el pedido de vuelta en `estado: "enviado"`, así que la parte ya lista/servida parecía tener que prepararse de nuevo (confuso para cocina y para el mesero); se corrigió siguiendo el patrón de fulfillment por ítem que usan Toast/Oracle KDS. El detalle vive en `pedido.rondaEstados` (`{ronda: estado}`) y `pedido.rondaPrepInicio` (`{ronda: ts}`, para el cronómetro de preparación de esa ronda puntual) — `shared/util.js` expone:
- `estadoDeRonda(p, ronda)`: estado de una ronda puntual (con fallback a `p.estado` para pedidos de antes de este campo).
- `rondaEstadosCon(p)`: el mapa completo con el mismo fallback, para usar como base al construir un patch.
- `estadoEfectivoTicket(p)`: la ronda pendiente MENOS avanzada (o `"entregado"` si ya se sirvieron todas) — esto es lo que se guarda en `pedido.estado` en cada cambio, así decide en qué columna aparece el ticket en `panel-cocina` y cuándo `panel-caja` puede cobrarlo, sin que ese panel necesite saber nada de rondas.

En `panel-cocina`, cada grupo de ronda dentro del ticket tiene su propio botón ("Empezar"/"Marcar listo", `marcarRonda()`) y badge ("Esperando mesero"/"Servido"). En `mesero-app` (pestaña Pedidos), "Marcar servido" (`marcarServido(id, ronda)`) también es por ronda — se puede recoger la ronda 1 sin esperar a que la ronda 2 esté lista.

**Cancelar un pedido no lo borra — lo marca `estado: "cancelado"`.** `cancelarPedido()` en `mesero-app` hace `dbUpdate` (nunca `dbDelete`) para que el dueño tenga registro de qué se canceló, cuándo, quién lo hizo (`canceladoPor`) y por qué (`motivoCancelacion`, opcional). Un pedido cancelado no ocupa la mesa (`mesaOcupada()`/`pedidoActivoDeMesa()` lo excluyen explícitamente) y no aparece en el tablero de `panel-cocina` ni en `panel-caja` — ninguno de los dos lo busca por `estado`, así que "cancelado" simplemente no calza en ningún filtro existente. Sigue estando disponible en `/pedidos` para quien quiera auditar cancelaciones directamente en Firebase; no hay todavía una vista/reporte dedicado a esto.

**"Avisar cambio a cocina" es otra cosa distinta a una ronda.** Ese botón (visible en `mesero-app` mientras el pedido está en `preparacion`/`listo`) es para cuando el cliente quiere **modificar o quitar** algo que ya se está cocinando — cuelga un aviso (`avisoCambio`) visible y sonoro en `panel-cocina` para que se coordinen de viva voz, pero **no** toca `lineas` ni `estado`. Agregar platos nuevos SIEMPRE pasa por el flujo de rondas de arriba (aparece como algo nuevo para preparar), nunca por este aviso.

**División de responsabilidades por panel** (a propósito, no se pisan):
- `mesero-app`: crea el pedido (`enviado`) y lo marca `entregado` cuando lo sirve. También revisa y confirma (o descarta) las solicitudes de `panel-cliente`.
- `panel-cocina`: avanza `enviado` → `preparacion` → `listo`. No toca cobros.
- `panel-caja`: solo ve pedidos ya `entregado` y confirma el pago (`pagado`/`tsPago`). **No** avanza el estado del pedido — eso es trabajo de cocina. Tampoco muestra el tablero Nuevos/Preparación/Listos: eso se quitó a propósito porque duplicaba a `panel-cocina`.
- `panel-admin`: gestiona trabajadores (crear, editar, activar/desactivar, eliminar) y genera/imprime los QR de cada mesa. No toca pedidos.
- `panel-cliente`: sin login, deja al comensal armar y mandar su carrito a `/solicitudes/{mesaId}`. Nunca escribe en `/pedidos` directamente.

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
- El menú completo (162 platos/bebidas + `SUGERENCIAS` por categoría) vive en **`shared/menu.js`** (script clásico, sin build) porque lo comparten `mesero-app` y `panel-cliente`.
- **Fotos de platos**: archivos en `icons/menu/` (155 de 162 ítems tienen foto — los que no, se muestran con un ícono genérico). Se bajaron una sola vez del menú digital existente en Ola Click (`rodizio-cucuta.ola.click`) y quedaron como archivos estáticos del repo, referenciados desde `shared/menu.js` (campo `img` por ítem) — no hay ninguna dependencia en vivo con Ola Click. **El nombre del archivo ya NO coincide con el `id` del ítem** (ver "IDs del menú" arriba): los `.webp` se quedaron con su nombre original (`en1.webp`, `pa3.webp`…) cuando los ids cambiaron de formato, así que `img` es un campo independiente — no se puede derivar la ruta de la foto a partir del `id`. Si se agrega un plato nuevo o cambia una foto, hay que bajar/reemplazar el `.webp` a mano y agregar/editar el campo `img` en `shared/menu.js`. Actualmente solo se muestran en `panel-cliente` — `mesero-app` no las usa (podría agregarse igual, reusando el mismo campo).
- IDs del menú: prefijo de categoría de 3 letras mayúsculas + guión + número de 2 dígitos (`ENT-01`, `PAR-03`, `ANG-02`…) — antes era `en1`/`pa3`/`ab2` (2 letras, sin guión ni relleno de ceros); se cambió para que se lea de un vistazo a qué categoría pertenece un código en los reportes. Prefijos por categoría: Entradas→`ENT`, Para Compartir→`COM`, De la Parrilla→`PAR`, Angus Beef→`ANG`, Burger Angus→`BUR`, De la Casa→`CAS`, Del Mar→`MAR`, Menú Infantil→`INF`, Postres→`POS`, Bebidas→`BEB`, Cervezas 3 Cordilleras→`CER`, Mocktails→`MOC`, Cocteles→`COC`, Licores→`LIC`, Vinos→`VIN`, Champagnes→`CHA`. Debe ser único en todo el archivo. El campo `img` de cada ítem **no** sigue este esquema — sigue apuntando al nombre de archivo `.webp` original (ver más abajo) para no tener que renombrar 155 fotos.
- Iconos y logo: **centralizados en `icons/`** en la raíz, no duplicados por panel.
- Service worker por app: cachea el cascarón para offline + instalable. Las peticiones a `firebaseio.com` **nunca** se cachean — siempre en vivo.
- Registro de cuenta **no** inicia sesión automáticamente — es intencional que vuelva al login.

## Limitaciones conocidas (aceptadas a propósito)

1. **Las reglas de RTDB están abiertas** (`.read/.write: true`) — cualquiera con la URL de la base puede leer y escribir, **aunque las apps autentiquen con Firebase Auth**: el guard de cada app es una verificación de la interfaz, no una regla de la base. Cerrarlo de verdad es la "Fase 9" — ver `database.rules.json`, que es un **borrador que NO debe aplicarse todavía** (rompería las apps; el archivo explica exactamente qué falta). Ojo: cuando se aborde esa fase, `/solicitudes` va a necesitar una regla de escritura pública (sin `auth != null`) a diferencia del resto de rutas, porque `panel-cliente` no tiene login — queda anotado también en el propio `database.rules.json`.
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
- **No** dejar que `panel-cliente` escriba directo en `/pedidos` — el pedido del comensal solo va a `/solicitudes/{mesaId}`; el mesero es siempre quien confirma y lo pasa a cocina. Fue una decisión explícita del dueño del negocio, no un detalle técnico.
- **No** volver a hacer que enviar una comanda a una mesa ocupada cree un `/pedidos` nuevo — fue un bug real: pedir algo más en la misma mesa duplicaba el ticket en cocina y en la pestaña "Pedidos" del mesero. Tiene que sumarse como ronda nueva al pedido activo de esa mesa (`pedidoActivoDeMesa()`/`agregarRonda()` en `mesero-app/app.js`) — ver sección "Rondas" más arriba.
- **No** volver a resetear el pedido completo a `estado: "enviado"` cuando se agrega una ronda nueva a uno que ya estaba `listo`/`entregado` — fue un bug real: la parte ya lista o servida parecía tener que prepararse de nuevo, confundiendo a cocina y al mesero. El estado es por ronda (`rondaEstados`/`estadoDeRonda`/`estadoEfectivoTicket` en `shared/util.js`) — ver sección "Estado por ronda" más arriba.
- **No** volver a hacer `dbDelete` sobre un pedido al cancelarlo — se cambió a propósito a marcar `estado: "cancelado"` (ver más arriba) para que el dueño tenga registro completo de cancelaciones en su reporte de caja, en vez de que desaparezcan sin dejar rastro.
- **No** quitar los guards anti-doble-clic (`state.enviando`, y los `Set` de ids "en curso" en `marcarServido`/`marcar`/`confirmarPago`) pensando que son redundantes — sin ellos, un toque doble o una conexión lenta puede disparar la misma escritura dos veces (pedido duplicado, doble PATCH).

## Cómo crear el primer admin (consola de Firebase)

1. Firebase Console → Authentication → Users → "Add user". Email: `TUUSUARIO@rodizio.local`, cualquier contraseña. Copia el UID.
2. Firebase Console → Realtime Database → crea el nodo `/trabajadores/{ESE_UID}`:
   ```json
   { "nombre": "Tu Nombre", "usuario": "TUUSUARIO", "rolesPermitidos": ["admin"], "estado": "activo", "creado": 1690000000000 }
   ```
3. Entra a `/index.html` con ese usuario y contraseña. De ahí en adelante, el resto de trabajadores se dan de alta desde `panel-admin`.

## Despliegue

**Firebase Hosting**, sitio `rodiziocucuta21` dentro del proyecto `rodizio-eb49a` (mismo proyecto que RTDB y Authentication). Deploy: `firebase deploy --only hosting` → publica en `https://rodiziocucuta21.web.app`.

Antes del primer deploy en una máquina nueva: `firebase use --add` y seleccionar `rodizio-eb49a` (el repo no versiona `.firebaserc`). La cuenta de Google que administra este proyecto es `rodizio895@gmail.com` — si el login de Firebase CLI está con otra cuenta, `firebase login --reauth` para cambiar.

**Nota histórica:** el proyecto original (`rodizio-cucuta-08`) fue suspendido por Google Cloud Platform el 11 ago 2026, muy probablemente por abuso de terceros aprovechando las reglas de RTDB abiertas (limitación #1). Se migró todo a `rodizio-eb49a`. Si el viejo se reactiva, **no volver a usarlo** sin cerrar las reglas primero — la vulnerabilidad sigue sin corregir también en el nuevo.

**Nota sobre el nombre del sitio:** originalmente se documentó como sitio `rodizio` (`rodizio.web.app`), pero ese nombre (y variantes como `rodizio-cucuta`) quedaron reservados globalmente por el proyecto viejo suspendido — Firebase no libera los nombres de sitio aunque el proyecto esté suspendido. Se creó `rodiziocucuta21` como sitio nuevo el 2026-08-21. Si más adelante se quiere una URL más prolija para vender el producto, la solución es conectar un dominio propio (no depender de que un `.web.app` lindo esté libre).
