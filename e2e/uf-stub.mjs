import { createServer } from "node:http";

// Proveedor de UF simulado del lado servidor para las pruebas E2E: responde de forma
// instantánea y determinista con el mismo formato que findic.cl (GET /…/dd-mm-yyyy),
// de modo que ninguna prueba depende de la red ni del proveedor real.
const VALOR_UF = 39000;

createServer((req, res) => {
  const partes = /(\d{2})-(\d{2})-(\d{4})$/.exec(req.url ?? "");
  res.setHeader("content-type", "application/json");
  if (!partes) {
    res.statusCode = 404;
    res.end(JSON.stringify({ serie: [] }));
    return;
  }
  const [, dia, mes, anio] = partes;
  res.end(JSON.stringify({ serie: [{ fecha: `${anio}-${mes}-${dia}`, valor: VALOR_UF }] }));
}).listen(3101, "127.0.0.1");
