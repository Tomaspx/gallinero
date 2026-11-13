export const TZ = process.env.APP_TZ || "America/Argentina/Buenos_Aires";
export const HUEVOS_POR_MAPLE = 30;

const pad = (n: number, w: number) => String(n).padStart(w, "0");

/** Código visible de una jaula, por ejemplo G2-F05-J118. */
export function codigoJaula(galpon: number, fila: number, jaula: number) {
  return `G${galpon}-F${pad(fila, 2)}-J${pad(jaula, 3)}`;
}

export function fechaHora(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

export function hora(d: Date | string) {
  return new Intl.DateTimeFormat("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(
    new Date(d)
  );
}

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria de la granja. */
export function hoyISO(offsetDias = 0) {
  const d = new Date(Date.now() + offsetDias * 864e5);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

export function diaCorto(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function hace(d: Date | string | null | undefined) {
  if (!d) return "nunca";
  const min = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 48) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} días`;
}

export const NOMBRE_EVENTO: Record<string, string> = {
  ok: "Todo OK",
  mortandad: "Mortandad",
  huevos: "Huevos",
  problema: "Problema",
  sanidad: "Sanidad",
  ajuste_aves: "Ajuste de aves",
  anulacion: "Anulación",
};

export const MOTIVOS_PROBLEMA: Record<string, string> = {
  agua: "Falta agua",
  alimento: "Falta alimento",
  jaula_rota: "Jaula rota",
  otro: "Otro",
};

export const MOTIVOS_SANIDAD: Record<string, string> = {
  enferma: "Ave enferma",
  medicacion: "Medicación",
  vacunacion: "Vacunación",
};

export const MOTIVOS_AJUSTE: Record<string, string> = {
  ingreso: "Ingreso",
  retiro: "Retiro",
  recuento: "Recuento",
};

/** Descripción corta de los datos de un evento, para listados. */
export function detalleEvento(tipo: string, datos: Record<string, unknown>): string {
  const n = (k: string) => Number(datos[k] ?? 0);
  const nota = datos.nota ? ` · ${datos.nota}` : "";
  switch (tipo) {
    case "mortandad":
      return `${n("cantidad")} ${n("cantidad") === 1 ? "ave muerta" : "aves muertas"}`;
    case "huevos":
      return `${n("buenos")} buenos, ${n("rotos")} rotos, ${n("sucios")} sucios`;
    case "problema":
      return `${MOTIVOS_PROBLEMA[String(datos.motivo)] ?? datos.motivo}${nota}`;
    case "sanidad":
      return `${MOTIVOS_SANIDAD[String(datos.motivo)] ?? datos.motivo}${nota}`;
    case "ajuste_aves":
      return `${n("cantidad")} aves · ${MOTIVOS_AJUSTE[String(datos.motivo)] ?? datos.motivo}${nota}`;
    case "anulacion":
      return `Anula el registro #${datos.anula_id ?? ""}${nota}`;
    default:
      return "";
  }
}
