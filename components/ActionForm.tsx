"use client";

import { useActionState, useEffect, useRef, useState, startTransition, type ReactNode } from "react";
import type { Resultado } from "@/lib/resultado";

type Props = {
  action: (prev: Resultado, fd: FormData) => Promise<Resultado>;
  children: ReactNode;
  boton: string;
  className?: string;
  botonClass?: string;
  limpiarAlGuardar?: boolean;
  onOk?: (r: NonNullable<Resultado>) => void;
};

/**
 * Formulario que muestra errores y pide confirmación cuando la acción lo requiere
 * (por ejemplo, un registro duplicado). Al confirmar, reenvía los mismos datos.
 */
export function ActionForm({ action, children, boton, className, botonClass, limpiarAlGuardar, onOk }: Props) {
  const [estado, enviar, pendiente] = useActionState(action, null);
  const [confirmando, setConfirmando] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!estado) return;
    setConfirmando(estado.estado === "confirmar");
    if (estado.estado === "ok") {
      if (limpiarAlGuardar) form.current?.reset();
      onOk?.(estado);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado?.n]);

  return (
    <form
      ref={form}
      className={className}
      onChange={() => setConfirmando(false)}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        if (confirmando) fd.set("confirmar", "1");
        startTransition(() => enviar(fd));
      }}
    >
      {children}
      {estado?.estado === "error" && <p className="msg error">{estado.mensaje}</p>}
      {estado?.estado === "confirmar" && confirmando && <p className="msg aviso">{estado.mensaje}</p>}
      {estado?.estado === "ok" && !onOk && <p className="msg ok">{estado.mensaje}</p>}
      <button type="submit" className={botonClass ?? "btn primario"} disabled={pendiente}>
        {pendiente ? "Guardando…" : confirmando ? "Sí, confirmar" : boton}
      </button>
    </form>
  );
}
