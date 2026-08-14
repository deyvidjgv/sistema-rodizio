# Rodizio Cúcuta — Sistema de Gestión y Pedidos

Sistema web liviano (PWA) de tiempo real para la gestión de comandas en restaurantes tipo Rodizio. Diseñado sin frameworks pesados ni pasos de compilación (Vanilla JS/CSS/HTML), conectado directamente a **Firebase Realtime Database** mediante REST + SSE.

---

## 🚀 Despliegue en Firebase Hosting

Ya se encuentra configurado (`firebase.json`, sitio `rodizio` apuntando al proyecto Firebase). El repo no versiona `.firebaserc`, así que la primera vez en una máquina nueva hay que correr `firebase use --add` y seleccionar el proyecto `rodizio-eb49a`:

```bash
npm install -g firebase-tools   # Instalación única de CLI
firebase login
firebase deploy --only hosting:rodizio
```

Publicado en: `https://rodizio.web.app`

---

## 🛠️ Arquitectura y Estructura del Código

El proyecto ha sido modularizado separando la estructura (HTML), los estilos (CSS) y la lógica funcional (JS) de cada panel de forma desacoplada y mantenible.

```
sistema-rodizio/
├── index.html            ← Login único unificado
├── styles.css            ← Estilos del login principal
├── app.js                ← Lógica del login y redirecciones por rol
├── shared/               ← Módulos compartidos por todos los paneles
│   ├── auth.js           ← Autenticación y Guards de sesión Firebase
│   ├── firebase.js       ← Cliente HTTP REST + SSE en tiempo real
│   ├── roles.js          ← Permisos y niveles de usuario
│   ├── util.js           ← Funciones de formato de moneda (COP), beeps y sanitización
│   ├── menu.js           ← Menú completo (platos/bebidas + sugerencias), compartido por mesero-app y panel-cliente
│   ├── ui.js              ← Notificaciones Toast unificadas en tiempo real
│   ├── ui.css             ← Componentes UI comunes (Toasts, botones CTA, empty states)
│   └── theme.css         ← Variables de diseño global, paleta de colores y fuentes
├── icons/                ← Íconos y logo centralizados (incluye icons/menu/ con la foto de cada plato)
├── mesero-app/           ← PWA para Meseros (Toma de comandas, menú interactivo, carritos por mesa y confirmación de pedidos hechos por QR)
├── panel-cocina/         ← Panel Kanban de Cocina (Recepción, preparación y despacho)
├── panel-caja/           ← Panel de Caja (Facturación, cierre de cuentas y exportación a Excel)
├── panel-admin/          ← Panel de Administración (Gestión de personal y generación de QR por mesa)
└── panel-cliente/        ← Página pública sin login que se abre al escanear el QR de la mesa, para pedir desde el celular propio
```

---

## 📋 Módulos y Paneles Activos

1. **Login Unificado (`/`)**: Entrada global que verifica la sesión y deja elegir entre los paneles operativos (mesero, caja, cocina) a los que cualquier trabajador activo tiene acceso; el panel de administración solo lo ven quienes tienen ese rol asignado.
2. **PWA Meseros (`/mesero-app`)**: Interfaz táctil adaptada a celulares. Soporta persistencia de carritos por mesa, búsqueda en el menú, alertas instantáneas cuando la cocina marca un pedido como "Listo", y revisión/confirmación de los pedidos que un cliente arma desde su QR antes de mandarlos a cocina.
3. **Panel Cocina (`/panel-cocina`)**: Pantalla horizontal dividida en estados (*Nuevos*, *En preparación*, *Listos*). Cuenta con alertas sonoras diferenciales, incluyendo un aviso cuando el mesero necesita coordinar un cambio en un pedido que ya está en preparación.
4. **Panel Caja (`/panel-caja`)**: Control financiero para cobrar cuentas pendientes, historial del día y reporte descargable en formato Excel.
5. **Panel Administración (`/panel-admin`)**: Alta, edición y activación/desactivación de trabajadores, y generación/descarga de los códigos QR de cada mesa.
6. **Panel Cliente (`/panel-cliente`)**: Página pública sin login, pensada para abrirse al escanear el QR de la mesa. El comensal arma su pedido con fotos de cada plato y lo envía — el mesero lo revisa y confirma antes de que entre a cocina, así el cliente nunca escribe directo en las comandas.

---

## ⚡ Características Destacadas

- **Cero Build/Bundlers**: Carga instantánea directa en el navegador.
- **Instalable (PWA)**: Cada panel operativo incluye manifest y Service Worker independiente para pantalla de inicio (`panel-cliente` es la excepción a propósito: es una página liviana sin instalación, para abrir rápido desde el QR).
- **Sincronización SSE en Tiempo Real**: Todos los cambios de estado se reflejan en menos de 200ms sin recargar la página.
- **Normalización de Mesas**: Algoritmo tolerante a fallos que evita la duplicación de identificadores de mesas.
- **Pedido por QR con confirmación humana**: el cliente arma su carrito desde su propio celular, pero el mesero siempre es quien revisa y lo pasa a cocina — nunca se salta ese paso.
