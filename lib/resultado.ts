export type Resultado = {
  estado: "ok" | "error" | "confirmar";
  mensaje: string;
  /** Cambia en cada respuesta, para que el formulario sepa que llegó una nueva. */
  n?: number;
  datos?: Record<string, string | number>;
} | null;

export const ok = (mensaje: string, datos?: Record<string, string | number>): Resultado => ({
  estado: "ok",
  mensaje,
  datos,
  n: Date.now(),
});
export const error = (mensaje: string): Resultado => ({ estado: "error", mensaje, n: Date.now() });
export const confirmar = (mensaje: string): Resultado => ({ estado: "confirmar", mensaje, n: Date.now() });

/** Lee un entero de un formulario dentro de un rango. Devuelve null si no es válido. */
export function entero(fd: FormData, campo: string, min: number, max: number): number | null {
  const v = String(fd.get(campo) ?? "").trim();
  if (!/^\d+$/.test(v)) return null;
  const n = Number(v);
  return n >= min && n <= max ? n : null;
}

export function texto(fd: FormData, campo: string, max = 200): string {
  return String(fd.get(campo) ?? "").trim().slice(0, max);
}

export const formatoUsuario = /^[a-z0-9._-]{2,30}$/;
