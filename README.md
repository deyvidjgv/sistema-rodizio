# Rodizio Cúcuta — Sistema de pedidos

Ver [`CLAUDE.md`](./CLAUDE.md) para la arquitectura completa, el esquema de Firebase y las decisiones de diseño.

## Desplegar en Firebase Hosting

Ya está configurado (`firebase.json` + `.firebaserc`, sitio `rodizio` dentro del mismo proyecto Firebase que la base de datos):

```bash
npm install -g firebase-tools   # una sola vez, si no lo tienes
firebase login
firebase deploy --only hosting:rodizio
```

El sitio queda publicado en `https://rodizio.web.app`. No hace falta mover ningún archivo a una carpeta `public/` — `firebase.json` ya apunta a la raíz del repo tal cual está.

`index.html` (en esta misma carpeta raíz) es el **login único** del sistema — desde ahí cada trabajador entra con su usuario y contraseña, y el sistema lo manda automáticamente a la app que le corresponde según su rol (mesero, caja, cocina, admin).

No hace falta ningún build ni paso de compilación — todo es HTML/CSS/JS servido tal cual.

## Estructura

```
/                  ← login raíz (punto de entrada único)
firebase.json      ← configuración de Firebase Hosting
shared/            ← código común a todas las apps (ver CLAUDE.md)
mesero-app/        ← PWA de meseros
panel-caja/        ← PWA de caja
panel-cocina/      ← PWA de cocina
panel-admin/       ← PWA de administración (crear trabajadores)
panel-cliente/     ← (pendiente)
```

Cada carpeta de app es también una PWA instalable por separado (tiene su propio `manifest.webmanifest` + `sw.js`), para que cada trabajador pueda instalar solo la que necesita en su celular/tablet.
