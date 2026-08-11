/* Rodizio — shared/firebase.js
   Responsable ÚNICAMENTE de la comunicación con Firebase Realtime
   Database: REST (dbGet/dbSet/dbPush/dbUpdate/dbDelete) y tiempo real
   (SSE). NO contiene lógica de login — eso vive en shared/auth.js
   (Fase 1, pendiente de la configuración de Firebase Authentication).
   Sin SDK de Firebase: se habla directo con la REST API pública de
   RTDB y con EventSource, que Firebase soporta de fábrica para
   streaming (Accept: text/event-stream). */

const DB_URL = "https://rodizio-cucuta-08-default-rtdb.firebaseio.com";
const dbUrl = (path) => `${DB_URL}${path}.json`;

async function dbGet(path) {
  const r = await fetch(dbUrl(path));
  return r.json();
}

async function dbPush(path, data) {
  const r = await fetch(dbUrl(path), { method: "POST", body: JSON.stringify(data) });
  const j = await r.json();
  return j.name;
}

// Reemplaza por completo el valor en esa ruta (PUT).
async function dbSet(path, data) {
  const r = await fetch(dbUrl(path), { method: "PUT", body: JSON.stringify(data) });
  return r.json();
}

// Actualiza solo los campos indicados, sin tocar el resto (PATCH).
async function dbUpdate(path, data) {
  await fetch(dbUrl(path), { method: "PATCH", body: JSON.stringify(data) });
}

async function dbDelete(path) {
  await fetch(dbUrl(path), { method: "DELETE" });
}

// ───────── Tiempo real (SSE) ─────────
// Abre un stream sobre una ruta completa (p. ej. "/pedidos") y llama a
// onEvento("put" | "patch", { path, data }) por cada cambio. Firebase
// primero manda un "put" con toda la foto inicial (path "/"), y luego
// un evento por cada cambio incremental.
function escucharSSE(path, onEvento) {
  const es = new EventSource(dbUrl(path));
  es.addEventListener("put", (e) => onEvento("put", JSON.parse(e.data)));
  es.addEventListener("patch", (e) => onEvento("patch", JSON.parse(e.data)));
  return es;
}

// Aplica un evento SSE sobre un árbol local ya cargado en memoria y
// devuelve el árbol resultante. El caller siempre debe reasignar:
//   pedidos = aplicarEventoSSE(pedidos, tipo, evento);
// porque en el caso de una foto completa (path "/") se devuelve un
// objeto nuevo, y en los demás casos se muta y devuelve el mismo.
function aplicarEventoSSE(arbol, tipo, evento) {
  const { path, data } = evento;
  if (path === "/") return data || {};
  const key = path.slice(1).split("/")[0];
  if (tipo === "put") {
    if (data === null) delete arbol[key];
    else arbol[key] = data;
  } else {
    arbol[key] = Object.assign({}, arbol[key], data);
  }
  return arbol;
}

// ───────── Correlativo diario de pedidos (P-001, P-002, …) ─────────
// Escritura condicional con ETag para que dos comandas enviadas al
// mismo tiempo no choquen de número (aproximación a una transacción
// atómica sin backend propio — ver limitaciones en claude.md).
async function siguienteCodigo() {
  const hoy = new Date().toISOString().slice(0, 10);
  const path = `/contadores/${hoy}`;
  for (let intento = 0; intento < 5; intento++) {
    try {
      const getRes = await fetch(dbUrl(path), { headers: { "X-Firebase-ETag": "true" } });
      const etag = getRes.headers.get("ETag");
      let actual = await getRes.json();
      if (typeof actual !== "number") actual = 0;
      const siguiente = actual + 1;
      const putRes = await fetch(dbUrl(path), {
        method: "PUT",
        headers: etag ? { "if-match": etag } : {},
        body: JSON.stringify(siguiente)
      });
      if (putRes.status === 200) return "P-" + String(siguiente).padStart(3, "0");
    } catch (e) {}
  }
  return "P-" + String(Date.now()).slice(-4);
}
