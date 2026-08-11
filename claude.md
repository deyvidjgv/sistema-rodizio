# Rodizio Cúcuta — Sistema de pedidos

Sistema de pedidos para restaurante compuesto por PWAs vanilla (HTML/CSS/JS, sin frameworks y sin bundler) que comparten un único proyecto Firebase.

La arquitectura debe mantenerse simple y separada por responsabilidades:

1. Firebase Authentication → identidad y login.
2. Autorización → roles y permisos.
3. Firebase Realtime Database → datos de la aplicación.
4. REST → operaciones sobre RTDB.
5. SSE → actualizaciones en tiempo real.
6. PWAs → interfaces para administrador, mesero, cajero, cocina y cliente.

No agregar otros lenguajes o frameworks salvo que exista una necesidad técnica real y justificada.

---

# 1. Aplicaciones

| App | Carpeta | Función | Dispositivo |
|---|---|---|---|
| Meseros | `mesero-app/` | Gestión de mesas y pedidos | Celular |
| Panel de caja | `panel-caja/` | Cobros, caja, historial y exportación | Tablet/PC |
| Panel de cocina | `panel-cocina/` | Preparación y seguimiento de productos | Tablet |
| Panel cliente | `panel-cliente/` | Menú, pedidos mediante QR y solicitudes | Celular |
| Panel administrador | `panel-admin/` | Gestión general del sistema | PC/Tablet |

Todas las aplicaciones utilizan el mismo proyecto Firebase.

---

# 2. Tecnología

Utilizar inicialmente:

- HTML5.
- CSS3.
- JavaScript vanilla.
- Firebase Authentication.
- Firebase Realtime Database.
- REST API de Realtime Database.
- Server-Sent Events (SSE).
- PWA / Service Worker.

No utilizar React, Vue, Angular, Node, Python, PHP u otros frameworks/lenguajes salvo que posteriormente exista una necesidad técnica concreta.

La prioridad es mantener el sistema sencillo, ligero y fácil de mantener.

---

# 3. Arquitectura general

Separar claramente:

```text
                    PRESENTACIÓN
                         │
       ┌─────────────────┼─────────────────┐
       ↓                 ↓                 ↓
    MESERO            CAJERO            COCINA
       │                 │                 │
       └─────────────────┼─────────────────┘
                         ↓
                AUTENTICACIÓN
                  auth.js
                         ↓
                AUTORIZACIÓN
                  roles.js
                         ↓
                  DATOS RTDB
                 firebase.js
                         ↓
              Firebase Realtime DB
                         ↑
                    REST + SSE
                         ↑
                   CLIENTE QR
```

No mezclar autenticación con lógica de pedidos.

No duplicar la lógica de Firebase en cada aplicación.

---

# 4. Firebase Authentication

Firebase Authentication será responsable de:

- Login.
- Logout.
- Contraseña.
- Sesión.
- Firebase UID.
- Estado de autenticación.
- Creación de cuentas de trabajadores.
- Restablecimiento de contraseña.

No almacenar contraseñas en Realtime Database.

No almacenar contraseñas en localStorage.

No implementar un sistema propio de hash de contraseñas.

No utilizar PIN como sistema principal de autenticación.

---

# 5. Usuarios y trabajadores

Cada trabajador tendrá una única cuenta.

Roles iniciales:

```text
admin
mesero
cajero
```

En el futuro pueden agregarse:

```text
cocinero
supervisor
gerente
```

Un trabajador puede tener varios roles.

Ejemplo:

```text
Juan Pérez
Usuario: juan

rolesPermitidos:
- mesero
- cajero
```

No crear cuentas diferentes para cada función.

---

# 6. Gestión de trabajadores

El administrador tendrá un módulo:

```text
Trabajadores
```

Debe poder:

- Crear trabajador.
- Editar trabajador.
- Activar/desactivar trabajador.
- Asignar roles.
- Quitar roles.
- Cambiar/restablecer contraseña.
- Consultar información.
- Consultar estado.

Formulario:

```text
Nombre completo
Usuario
Contraseña
Roles permitidos
Estado
```

Flujo de creación:

```text
Administrador
    ↓
Formulario
    ↓
Firebase Authentication
    ↓
Firebase UID
    ↓
/trabajadores/{UID}
```

La contraseña solamente pertenece a Firebase Authentication.

---

# 7. Firebase UID

El Firebase UID será el identificador principal del trabajador.

Ejemplo:

```text
Firebase Authentication
UID: abc123xyz
```

En RTDB:

```text
/trabajadores/abc123xyz
```

No utilizar como identificador principal:

- Nombre.
- Usuario.
- Rol.
- PIN.

---

# 8. Perfil del trabajador

Estructura:

```text
/trabajadores/{uid}

nombre
usuario
rolesPermitidos
estado
creado
actualizado
```

Ejemplo:

```text
/trabajadores/abc123

nombre: "Juan Pérez"
usuario: "juan"

rolesPermitidos:
  - "mesero"
  - "cajero"

estado: "activo"

creado: 1690000000000
actualizado: 1690000000000
```

---

# 9. Login

Flujo:

```text
Usuario
   ↓
Contraseña
   ↓
Firebase Authentication
   ↓
¿Autenticado?
   ├── NO → Mostrar error
   └── SÍ
        ↓
      Firebase UID
        ↓
 /trabajadores/{UID}
        ↓
 ¿Existe?
        ↓
 ¿Está activo?
        ↓
 Obtener rolesPermitidos
```

Si la cuenta está inactiva:

```text
Tu cuenta está desactivada.
Contacta al administrador.
```

---

# 10. Selección del rol

Si un trabajador tiene un solo rol:

```text
rolesPermitidos:
- mesero
```

Entrar directamente.

Si tiene varios:

```text
rolesPermitidos:
- mesero
- cajero
```

Mostrar:

```text
┌────────────────────────────┐
│       BIENVENIDO JUAN      │
│                            │
│ Selecciona tu rol de hoy:  │
│                            │
│       [ MESERO ]           │
│       [ CAJERO ]           │
└────────────────────────────┘
```

El usuario solamente puede seleccionar roles que estén en `rolesPermitidos`.

---

# 11. Rol activo

Separar:

```text
rolesPermitidos
```

de:

```text
rolActivo
```

Ejemplo:

```text
rolesPermitidos:
- mesero
- cajero

rolActivo:
mesero
```

Seleccionar un rol no modifica los roles asignados por el administrador.

El rol activo solamente representa la función utilizada durante esa sesión.

---

# 12. Permisos

## Admin

Acceso a:

- Dashboard.
- Trabajadores.
- Mesas.
- Productos.
- Categorías.
- Inventario.
- Pedidos.
- Ventas.
- Caja.
- Reportes.
- Configuración.
- Generación de QR.

## Mesero

Acceso a:

- Mesas.
- Pedidos pendientes.
- Confirmación de pedidos.
- Seguimiento de productos.
- Entrega de productos.
- Solicitudes de clientes.
- Solicitudes de cuenta.

## Cajero

Acceso a:

- Caja.
- Cobros.
- Ventas.
- Historial.
- Cierre de caja.

## Cocina

Si posteriormente se implementa como usuario:

- Pedidos confirmados.
- Preparación.
- Cambio a `listo`.
- Visualización por mesa.

---

# 13. Protección

No confiar únicamente en ocultar botones.

Cada aplicación debe validar:

```text
Usuario autenticado
        ↓
Trabajador existe
        ↓
Trabajador activo
        ↓
Rol válido
        ↓
Permiso requerido
        ↓
Permitir operación
```

Un usuario no autorizado no debe poder acceder modificando manualmente la URL.

---

# 14. Mesas y códigos QR

Cada mesa tendrá un identificador único.

Ejemplo:

```text
Mesa 1
mesaId: mesa_001

Mesa 2
mesaId: mesa_002

Mesa 7
mesaId: mesa_007
```

Cada mesa tendrá un QR diferente.

El QR debe apuntar al panel cliente identificando la mesa.

Ejemplo conceptual:

```text
panel-cliente?mesa=mesa_007
```

No confiar solamente en el parámetro de URL para autorizar operaciones. El sistema debe validar que la mesa existe y está activa.

---

# 15. Gestión de mesas

El administrador podrá:

- Crear mesas.
- Editar mesas.
- Activar/desactivar mesas.
- Generar QR.
- Regenerar QR.
- Imprimir QR.
- Consultar estado.

No crear un QR genérico para todo el restaurante.

Cada mesa debe tener su propio QR.

---

# 16. Estados de mesa

Mantener pocos estados y con significado claro:

```text
libre
pendiente
ocupada
cuenta
```

### libre

No tiene pedido activo.

### pendiente

El cliente escaneó el QR y realizó una solicitud/pedido que necesita ser revisado por el mesero.

### ocupada

El mesero confirmó el pedido y existe una atención activa.

### cuenta

El cliente terminó y solicita pagar.

Después del pago:

```text
cuenta → libre
```

El estado de la mesa es independiente del estado de cada pedido.

---

# 17. Panel cliente mediante QR

Flujo:

```text
Cliente llega
    ↓
Escanea QR de la mesa
    ↓
Panel cliente
    ↓
El sistema identifica la mesa
    ↓
Mostrar menú
```

El cliente podrá:

- Consultar menú.
- Seleccionar productos.
- Indicar cantidades.
- Ver resumen.
- Enviar solicitud de pedido.
- Solicitar atención.
- Solicitar cuenta.

No requiere crear una cuenta de Firebase para realizar un pedido de mesa.

El QR identifica el contexto de la mesa, no la identidad personal del cliente.

---

# 18. Solicitud de pedido del cliente

El cliente no debe enviar directamente un pedido confirmado a cocina.

El flujo será:

```text
Cliente
   ↓
Selecciona productos
   ↓
Confirma solicitud
   ↓
Pedido = solicitado
   ↓
Mesa = pendiente
   ↓
Mesero recibe notificación
```

El mesero debe acercarse a la mesa y confirmar el pedido con el cliente.

---

# 19. Confirmación por el mesero

El mesero verá:

```text
MESA 7
🔔 Nueva solicitud

2 Hamburguesas
1 Ensalada
2 Gaseosas
1 Postre

[ REVISAR ]
```

El mesero confirma físicamente con el cliente.

Después:

```text
[ CONFIRMAR PEDIDO ]
```

Resultado:

```text
Pedido:
solicitado → confirmado

Mesa:
pendiente → ocupada
```

Solo después de la confirmación el pedido entra oficialmente al flujo de cocina.

---

# 20. Pedidos

Un pedido debe tener:

```text
/pedidos/{pushId}

codigo
mesaId
mesaNumero
meseroUid
meseroUsuario
meseroNombre
estado
lineas
total
ts
tsCambio
```

Ejemplo:

```text
codigo: "P-014"
mesaId: "mesa_007"
mesaNumero: 7

meseroUid: "abc123"
meseroUsuario: "juan"
meseroNombre: "Juan Pérez"

estado: "confirmado"
```

---

# 21. Estados del pedido

Estados generales:

```text
solicitado
confirmado
en_preparacion
parcialmente_listo
listo
entregado
cancelado
```

No utilizar un único estado para saber el estado de todos los productos.

El pedido puede estar:

```text
parcialmente_listo
```

mientras algunos productos todavía están en preparación.

---

# 22. Estado individual de cada producto

Cada línea del pedido debe tener su propio estado.

Ejemplo:

```text
lineas:

1.
producto: Hamburguesa
cantidad: 2
estado: preparando

2.
producto: Ensalada
cantidad: 1
estado: listo

3.
producto: Gaseosa
cantidad: 2
estado: entregado

4.
producto: Postre
cantidad: 1
estado: pendiente
```

Estados recomendados:

```text
pendiente
preparando
listo
entregado
cancelado
```

Esto permite saber exactamente qué falta.

---

# 23. Panel de cocina

La cocina debe mostrar los pedidos confirmados organizados por mesa.

Ejemplo:

```text
MESA 7

2 Hamburguesas
[ PREPARANDO ]

1 Ensalada
[ LISTA ]

2 Gaseosas
[ LISTAS ]

1 Postre
[ PENDIENTE ]
```

La cocina es responsable de preparar.

La cocina puede cambiar:

```text
pendiente → preparando
preparando → listo
```

La cocina no debe marcar productos como entregados.

---

# 24. Entrega por parte del mesero

Cuando un producto está:

```text
listo
```

el mesero recibe la actualización.

El mesero recoge el producto y lo lleva a la mesa.

Entonces marca:

```text
listo → entregado
```

Esto permite que el sistema sepa:

```text
MESA 7

✓ Hamburguesa 1 → entregada
✓ Ensalada → entregada
✓ Gaseosa 1 → entregada
◐ Hamburguesa 2 → preparando
○ Postre → pendiente
```

El responsable de marcar `entregado` es el mesero.

---

# 25. Pedidos adicionales

Una mesa puede realizar múltiples pedidos durante la misma atención.

Ejemplo:

```text
Mesa 7

Pedido #001
- 2 Hamburguesas
- 2 Gaseosas

Pedido #002
- 1 Postre
- 2 Cafés
```

No crear una nueva mesa ni una nueva sesión de mesa.

Los pedidos deben estar asociados a la misma:

```text
mesaId
```

La cuenta final debe poder agrupar todos los pedidos activos de esa mesa.

---

# 26. Solicitar mesero

El panel cliente debe permitir:

```text
[ LLAMAR AL MESERO ]
```

Flujo:

```text
Cliente
   ↓
Llamar al mesero
   ↓
Mesa = pendiente de atención
   ↓
Mesero recibe notificación
```

La solicitud debe poder marcarse como atendida.

---

# 27. Solicitar cuenta

El cliente puede seleccionar:

```text
[ SOLICITAR CUENTA ]
```

Flujo:

```text
Cliente
   ↓
Solicitar cuenta
   ↓
Mesa = cuenta
   ↓
Cajero recibe notificación
```

El cajero consulta todos los pedidos asociados a la mesa.

Después del pago:

```text
venta registrada
      ↓
mesa = libre
```

---

# 28. Flujo completo

```text
                         QR
                          ↓
                       CLIENTE
                          ↓
                        MENÚ
                          ↓
                   Crear solicitud
                          ↓
                Pedido = solicitado
                          ↓
                Mesa = pendiente
                          ↓
                       MESERO
                          ↓
               Confirmar con cliente
                          ↓
                Pedido = confirmado
                          ↓
                 Mesa = ocupada
                          ↓
                       COCINA
                          ↓
                  Preparar productos
                          ↓
                Producto = listo
                          ↓
                       MESERO
                          ↓
                 Recoger y entregar
                          ↓
              Producto = entregado
                          ↓
             ¿Hay productos pendientes?
                   /                              SÍ               NO
                 ↓                 ↓
              Esperar          Atención continúa
                                  ↓
                         Cliente solicita cuenta
                                  ↓
                           Mesa = cuenta
                                  ↓
                               CAJERO
                                  ↓
                                Cobro
                                  ↓
                         Registrar venta
                                  ↓
                           Mesa = libre
```

---

# 29. REST

REST se utilizará para operaciones de datos de Realtime Database.

```text
GET
POST
PUT
PATCH
DELETE
```

REST sirve para:

- Consultar mesas.
- Crear pedidos.
- Actualizar estados.
- Registrar ventas.
- Consultar productos.
- Gestionar trabajadores.
- Actualizar información.

REST no debe implementar manualmente el login.

El login pertenece a Firebase Authentication.

---

# 30. SSE

SSE se utilizará para actualizaciones en tiempo real.

Ejemplo:

```text
Cliente crea solicitud
        ↓
Realtime Database
        ↓
SSE
        ↓
Panel mesero
        ↓
🔔 Mesa 7 solicita atención
```

Otro:

```text
Cocina marca producto como listo
        ↓
Realtime Database
        ↓
SSE
        ↓
Panel mesero
        ↓
Producto listo para entregar
```

Otro:

```text
Cajero registra pago
        ↓
Realtime Database
        ↓
SSE
        ↓
Panel mesero
        ↓
Mesa vuelve a libre
```

---

# 31. Auditoría

Las operaciones importantes deben identificar al usuario que las realizó.

Ejemplo:

```text
meseroUid
meseroUsuario
meseroNombre
rol
timestamp
```

Para ventas:

```text
cajeroUid
cajeroUsuario
cajeroNombre
rol
timestamp
```

Esto permite conocer quién realizó cada operación.

---

# 32. Estructura compartida

```text
shared/
├── firebase.js
├── auth.js
├── roles.js
├── mesas.js
├── pedidos.js
├── qr.js
├── util.js
├── theme.css
└── tickets.css
```

## firebase.js

Responsable de comunicación con RTDB:

```text
dbGet()
dbPush()
dbUpdate()
dbDelete()
dbPatch()
SSE
siguienteCodigo()
```

No debe contener lógica de login.

## auth.js

Responsable de:

```text
login()
logout()
getCurrentUser()
onAuthStateChanged()
crearCuenta()
restablecerPassword()
```

## roles.js

Responsable de:

```text
getWorkerProfile()
getRolesPermitidos()
setActiveRole()
getActiveRole()
hasRole()
hasPermission()
```

## mesas.js

Responsable de:

```text
getMesa()
getMesas()
crearMesa()
actualizarMesa()
cambiarEstadoMesa()
```

## pedidos.js

Responsable de:

```text
crearSolicitudPedido()
confirmarPedido()
actualizarEstadoPedido()
actualizarEstadoLinea()
obtenerPedidosMesa()
```

## qr.js

Responsable de:

```text
generarQR()
generarQRMesa()
regenerarQR()
```

---

# 33. LocalStorage

No guardar información sensible.

Nunca guardar:

- Contraseñas.
- PIN.
- Credenciales.
- Tokens manuales.
- Contraseñas Firebase.

Puede utilizarse para:

- Preferencias de interfaz.
- Configuración visual.
- Datos temporales.
- Estado visual no sensible.

La sesión debe gestionarse mediante Firebase Authentication.

---

# 34. Seguridad

No mantener permanentemente reglas como:

```text
.read: true
.write: true
```

La implementación final debe utilizar Firebase Authentication y reglas de RTDB.

Nunca confiar únicamente en JavaScript del cliente.

Nunca considerar seguro ocultar un botón como autorización.

Las reglas de Firebase deben proteger los datos aunque un usuario intente realizar una operación directamente.

---

# 35. Estado de trabajador

Estados:

```text
activo
inactivo
```

Un trabajador inactivo no puede iniciar sesión en el sistema operativo aunque su cuenta de Authentication exista.

No eliminar trabajadores automáticamente.

Mantener registros históricos.

---

# 36. Cambio de contraseña

El administrador puede iniciar el proceso de cambio/restablecimiento mediante Firebase Authentication.

Nunca guardar contraseñas en RTDB.

Nunca mostrar la contraseña existente.

---

# 37. Logout

```text
Firebase Authentication
        ↓
signOut
        ↓
Limpiar estado temporal
        ↓
Volver al Login
```

---

# 38. Estructura de carpetas

```text
rodizio/
│
├── shared/
│   ├── firebase.js
│   ├── auth.js
│   ├── roles.js
│   ├── mesas.js
│   ├── pedidos.js
│   ├── qr.js
│   ├── util.js
│   ├── theme.css
│   └── tickets.css
│
├── mesero-app/
│   ├── index.html
│   ├── menu.js
│   ├── manifest.webmanifest
│   └── sw.js
│
├── panel-caja/
│   ├── index.html
│   ├── manifest.webmanifest
│   └── sw.js
│
├── panel-cocina/
│   ├── index.html
│   ├── manifest.webmanifest
│   └── sw.js
│
├── panel-cliente/
│   ├── index.html
│   ├── menu.js
│   ├── pedido.js
│   ├── manifest.webmanifest
│   └── sw.js
│
└── panel-admin/
    ├── index.html
    ├── trabajadores.js
    ├── mesas.js
    ├── productos.js
    ├── reportes.js
    └── sw.js
```

---

# 39. Reglas de desarrollo

## No hacer

- No crear cuentas duplicadas por rol.
- No utilizar PIN como autenticación.
- No guardar contraseñas en RTDB.
- No guardar contraseñas en localStorage.
- No implementar login mediante REST.
- No mezclar autenticación con pedidos.
- No duplicar `auth.js`.
- No duplicar `firebase.js`.
- No confiar solamente en la interfaz.
- No marcar un producto como entregado desde cocina.
- No permitir que el cliente envíe directamente pedidos a cocina.
- No crear una nueva mesa por cada pedido adicional.
- No cambiar `rolesPermitidos` cuando el usuario selecciona un rol.
- No utilizar el número de mesa como identificador único de datos si existe un `mesaId`.

## Sí hacer

- Firebase Authentication para identidad.
- Firebase UID para trabajadores.
- RTDB para datos.
- REST para operaciones.
- SSE para tiempo real.
- `auth.js` para autenticación.
- `roles.js` para autorización.
- `firebase.js` para RTDB.
- Una cuenta por trabajador.
- Múltiples roles por trabajador.
- Rol activo por sesión.
- QR independiente por mesa.
- Estados separados para mesa, pedido y línea de pedido.
- Auditoría de operaciones.
- Cliente solicita.
- Mesero confirma.
- Cocina prepara.
- Mesero entrega.
- Cajero cobra.

---

# 40. Flujo de estados

## Mesa

```text
libre
  ↓
pendiente
  ↓
ocupada
  ↓
cuenta
  ↓
libre
```

## Pedido

```text
solicitado
  ↓
confirmado
  ↓
en_preparacion
  ↓
parcialmente_listo
  ↓
listo
  ↓
entregado
```

## Línea de pedido

```text
pendiente
  ↓
preparando
  ↓
listo
  ↓
entregado
```

No forzar que todos los estados cambien simultáneamente.

---

# 41. Orden recomendado de implementación

## Fase 1 — Firebase

- [ ] Configurar Firebase Authentication.
- [ ] Configurar proyecto Firebase.
- [ ] Mantener RTDB.
- [ ] Preparar reglas de seguridad.

## Fase 2 — Arquitectura compartida

- [ ] Crear `shared/auth.js`.
- [ ] Crear `shared/roles.js`.
- [ ] Separar `firebase.js`.
- [ ] Crear `mesas.js`.
- [ ] Crear `pedidos.js`.
- [ ] Crear `qr.js`.

## Fase 3 — Administrador

- [ ] Login administrador.
- [ ] Dashboard.
- [ ] Gestión de trabajadores.
- [ ] Crear trabajador.
- [ ] Editar trabajador.
- [ ] Activar/desactivar.
- [ ] Asignar roles.
- [ ] Restablecer contraseña.
- [ ] Gestión de mesas.
- [ ] Generación de QR.

## Fase 4 — Cliente

- [ ] Abrir panel mediante QR.
- [ ] Identificar mesa.
- [ ] Mostrar menú.
- [ ] Crear carrito.
- [ ] Crear solicitud.
- [ ] Solicitar mesero.
- [ ] Solicitar cuenta.
- [ ] Permitir pedidos adicionales.

## Fase 5 — Mesero

- [ ] Login.
- [ ] Selección de rol.
- [ ] Panel de mesas.
- [ ] Notificaciones de solicitudes.
- [ ] Revisar pedidos.
- [ ] Confirmar pedidos.
- [ ] Ver productos listos.
- [ ] Marcar productos entregados.
- [ ] Ver solicitudes de cuenta.

## Fase 6 — Cocina

- [ ] Login o acceso autorizado según diseño final.
- [ ] Mostrar pedidos confirmados.
- [ ] Agrupar por mesa.
- [ ] Mostrar líneas de pedido.
- [ ] Marcar pendiente/preparando/listo.
- [ ] Mantener actualización en tiempo real.

## Fase 7 — Caja

- [ ] Login.
- [ ] Validar rol `cajero`.
- [ ] Mostrar mesas con cuenta.
- [ ] Obtener todos los pedidos de la mesa.
- [ ] Registrar cobro.
- [ ] Registrar venta.
- [ ] Liberar mesa.
- [ ] Historial.
- [ ] Cierre de caja.

## Fase 8 — Tiempo real

- [ ] SSE para solicitudes.
- [ ] SSE para pedidos.
- [ ] SSE para estados de cocina.
- [ ] SSE para entregas.
- [ ] SSE para cuentas.
- [ ] SSE para cambios de mesa.

## Fase 9 — Seguridad

- [ ] Eliminar reglas abiertas.
- [ ] Proteger RTDB mediante Authentication.
- [ ] Validar roles.
- [ ] Validar permisos.
- [ ] Proteger trabajadores.
- [ ] Proteger ventas.
- [ ] Proteger pedidos.
- [ ] Proteger operaciones críticas.

## Fase 10 — Pruebas

Probar como mínimo:

```text
ADMIN
 ↓
Crear Juan
 ↓
Asignar Mesero + Cajero
```

```text
JUAN
 ↓
Login
 ↓
Seleccionar Mesero
 ↓
Ver mesa pendiente
 ↓
Confirmar pedido
```

```text
CLIENTE
 ↓
Escanear QR Mesa 7
 ↓
Crear pedido
 ↓
Solicitar
```

```text
COCINA
 ↓
Recibir pedido
 ↓
Preparar
 ↓
Marcar producto listo
```

```text
MESERO
 ↓
Ver producto listo
 ↓
Recoger
 ↓
Entregar
 ↓
Marcar entregado
```

```text
CLIENTE
 ↓
Solicitar cuenta
 ↓
CAJERO
 ↓
Cobrar
 ↓
Registrar venta
 ↓
Mesa = libre
```

También probar:

```text
Trabajador inactivo → ❌ acceso
Mesero intentando caja → ❌ acceso
Usuario no autenticado → ❌ acceso
Rol no asignado → ❌ acceso
Rol válido → ✅ acceso
Pedido adicional → ✅ misma mesa
Producto parcialmente listo → ✅ seguimiento individual
```
