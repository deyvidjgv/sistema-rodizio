# Rodizio Cúcuta — Sistema de Gestión y Pedidos

Sistema web liviano (PWA) de tiempo real para la gestión de comandas en restaurantes tipo Rodizio. Diseñado sin frameworks pesados ni pasos de compilación (Vanilla JS/CSS/HTML), conectado directamente a **Firebase Realtime Database** mediante REST + SSE.

---

## 🚀 Despliegue en Firebase Hosting

Ya se encuentra configurado (`firebase.json` + `.firebaserc`, sitio `rodizio` apuntando al proyecto Firebase):

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
│   ├── ui.js             ← Notificaciones Toast unificadas en tiempo real
│   ├── ui.css            ← Componentes UI comunes (Toasts, botones CTA, empty states)
│   └── theme.css         ← Variables de diseño global, paleta de colores y fuentes
├── mesero-app/           ← PWA para Meseros (Toma de comandas, menú interactivo y carritos por mesa)
├── panel-cocina/         ← Panel Kanban de Cocina (Recepción, preparación y despacho)
├── panel-caja/           ← Panel de Caja (Facturación, cierre de cuentas y exportación a Excel)
└── panel-admin/          ← Panel de Administración (Gestión de personal y roles)
```

---

## 📋 Módulos y Paneles Activos

1. **Login Unificado (`/`)**: Entrada global que detecta automáticamente el rol del trabajador y redirige al panel correspondiente.
2. **PWA Meseros (`/mesero-app`)**: Interfaz táctil adaptada a celulares. Soporta persitencia de carritos por mesa, búsqueda en el menú y alertas instantáneas cuando la cocina marca un pedido como "Listo".
3. **Panel Cocina (`/panel-cocina`)**: Pantalla horizontal dividida en estados (*Nuevos*, *En preparación*, *Listos*). Cuenta con alertas sonoras diferenciales.
4. **Panel Caja (`/panel-caja`)**: Control financiero para cobrar cuentas pendientes, historial del día y reporte descargable en formato Excel.
5. **Panel Administración (`/panel-admin`)**: Alta de trabajadores en Firebase Auth y asignación granular de roles.

---

## ⚡ Características Destacadas

- **Cero Build/Bundlers**: Carga instantánea directa en el navegador.
- **Instalable (PWA)**: Cada módulo incluye manifest y Service Worker independiente para pantalla de inicio.
- **Sincronización SSE en Tiempo Real**: Todos los cambios de estado se reflejan en menos de 200ms sin recargar la página.
- **Normalización de Mesas**: Algoritmo tolerante a fallos que evita la duplicación de identificadores de mesas.
