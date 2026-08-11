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
  tsCambio      1690000000000   # último cambio de estado

/contadores/{YYYY-MM-DD}
  <number>       # último correlativo del día, escritura con ETag condicional (evita choques)

/meseros/{usuario}
  nombre
  pinHash        # SHA-256 del PIN — NUNCA texto plano
  creado
```

**Flujo de un pedido:** mesero envía (`enviado`) → cocina pasa a `preparacion` → `listo` → mesero marca `entregado`. Las 3 apps escuchan `/pedidos` en vivo por SSE, así que un cambio de estado se ve al instante en todas las pantallas sin refrescar.

## Convenciones de código

- Vanilla JS, sin frameworks, sin bundler.
- IDs del menú: prefijo por categoría + número (`en1`, `pa3`, `ab2`…) — ver `menu.js`.
- PIN de mesero: se hashea con SHA-256 **en el celular**, antes de tocar la red. Nunca en texto plano, nunca en localStorage.
- Cuentas de mesero viven en Firebase (`/meseros`), **no localmente**. Cada celular solo recuerda (localStorage) qué usuarios *ya iniciaron sesión en ese dispositivo*, para mostrarlos como accesos rápidos — nunca la lista completa de meseros del restaurante (para que nadie vea ni toque el perfil de otro).
- Registro de cuenta **no** inicia sesión automáticamente — el flujo intencional es: registrar → volver a login → el mesero entra él mismo con su PIN.
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
- `hashPin()` y `crearCuentaSiLibre()` siguen viviendo dentro de `mesero-app/index.html`, **a propósito** — son parte del login por PIN que la Fase 1 (Firebase Authentication) va a reemplazar. No tiene sentido moverlas a `shared/` para borrarlas poco después.
- Cada `sw.js` ya precachea los 3 archivos de `shared/` (rutas relativas `../shared/...`) además de su propio cascarón, así que el offline sigue funcionando.
- Condición para que esto siga funcionando: **las apps deben seguir sirviéndose desde el mismo dominio/hosting**, con `shared/` como carpeta hermana de cada app.

## Cómo extender

- **Agregar un plato:** editar `menu.js`, agregar `{ id, nombre, desc, precio }` dentro de la categoría correspondiente. El `id` debe ser único en todo el archivo.
- **Agregar una categoría:** agregar `{ cat, items }` a `MENU` + una entrada con ese mismo nombre en `SUGERENCIAS`.
- **Agregar un panel nuevo:** partir de `panel-cocina/` (el más simple), mismo `DB_URL`, `name`/`short_name` únicos en `manifest.webmanifest`, y nombre de `CACHE` único en `sw.js`.
- **Instalar como PWA:** cada carpeta ya trae manifest + service worker + 3 iconos. Solo necesita servirse por HTTPS (o `localhost`); el navegador ofrece "Instalar" tanto en PC como en celular automáticamente.

## Limitaciones conocidas

1. **Reglas de Firebase abiertas** (`.read/.write: true`) — cualquiera con la URL de la base puede leer y escribir sin restricción. Autenticación real requeriría `apiKey` + Firebase Auth (fuera del alcance actual).
2. **PIN de 4 dígitos, hasheado sin sal** — débil ante fuerza bruta offline si alguien llega a leer `/meseros` directamente vía REST.
3. **Sin backend real:** el código secuencial (`siguienteCodigo`) usa ETag condicional como aproximación a una transacción atómica. No es 100% a prueba de carreras bajo concurrencia muy alta (aceptable para el volumen de un restaurante).
4. **Exportar a Excel** (panel-caja) depende de cargar ExcelJS desde CDN la primera vez (necesita internet); después queda cacheado por el service worker.

## Para futuras sesiones — no reintroducir estos bugs ya corregidos

- **No** volver a poner una limpieza automática de cuentas que corra en cada carga de la app — causó un bug real: borraba cuentas legítimas cuyo usuario contenía cierto substring. Si hace falta borrar una cuenta puntual, se hace una sola vez, manualmente, no como código permanente.
- **No** autologuear después de registrar una cuenta — es intencional que vuelva a login.
- Una vez adoptado el refactor a `shared/`, **no** volver a duplicar `dbUrl`/`dbGet`/etc. dentro de cada app — deben vivir solo en `shared/firebase.js`.

## Pendientes / decisiones abiertas

- [ ] Alcance de `panel-cliente` — sin definir.
- [ ] **Fase 1 — Firebase Authentication:** bloqueada hasta tener `apiKey`/`authDomain`/`projectId`/`appId` del proyecto Firebase (Project Settings → General → Tus apps). Requiere también habilitar el método de acceso "Email/Password" en Authentication → Sign-in method. Como los trabajadores tienen "usuario" y no correo, se va a generar un correo sintético tipo `usuario@rodizio.local` puramente interno para Firebase Auth — nunca visible ni usado por el trabajador.
- [x] Refactor a `shared/` (theme.css, firebase.js, util.js) — aplicado y verificado en las 3 apps existentes.
- [ ] Revisar `"orientation": "portrait"` en el manifest de `mesero-app` ahora que también se instala en PC (los paneles ya usan `"any"`).
- [ ] Resto de fases del `claude.md` del compañero: roles (`shared/roles.js`), mesas (`shared/mesas.js`), pedidos con estado por línea (`shared/pedidos.js`), QR (`shared/qr.js`), `panel-admin/`, `panel-cliente/`, cierre de las reglas abiertas de Firebase — todo depende de completar la Fase 1 primero.
