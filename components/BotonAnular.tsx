"use client";

import { ActionForm } from "./ActionForm";
import type { Resultado } from "@/lib/resultado";

/** Botón chico que pide confirmación antes de anular un registro. */
export function BotonAnular({
  id,
  action,
  label = "Anular",
}: {
  id: number | string;
  action: (prev: Resultado, fd: FormData) => Promise<Resultado>;
  label?: string;
}) {
  return (
    <ActionForm action={action} boton={label} botonClass="btn chico peligro">
      <input type="hidden" name="id" value={String(id)} />
    </ActionForm>
  );
}
