// Sustituye "server-only" por un modulo vacio, solo para `npm run test`.
// No se usa en absoluto durante `next dev`/`next build`: ese flujo sigue
// resolviendo el paquete real sin tocar esta logica (ver design.md).
// `server-only` lanza una excepcion incondicional fuera del bundler de
// Next.js (es asi por diseno: Next lo reemplaza por un archivo vacio al
// compilar para el servidor). Al correr los modulos directamente con
// tsx/node para las pruebas, nunca pasamos por ese bundler, asi que sin este
// stub cualquier modulo marcado "server-only" rompe la prueba.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- script CJS de preload (node --require), no puede usar import
const Module = require("node:module");

const originalLoad = Module._load;
Module._load = function stubbedLoad(request, parent, isMain) {
  if (request === "server-only" || request === "client-only") {
    return {};
  }
  return originalLoad.call(this, request, parent, isMain);
};
