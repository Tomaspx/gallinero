"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { Stepper } from "@/components/Stepper";
import { registrarJuntada } from "@/app/actions/registro";

export function JuntadaPantalla() {
  const [exito, setExito] = useState<{ mensaje: string; hora: string } | null>(null);

  if (exito) {
    return (
      <div className="tarjeta exito">
        <div className="tilde" aria-hidden>
          ✓
        </div>
        <h1>Juntada cargada</h1>
        <p>
          {exito.mensaje} · {exito.hora}
        </p>
        <button className="btn" onClick={() => setExito(null)}>
          Cargar otra juntada
        </button>
      </div>
    );
  }

  return (
    <div className="tarjeta">
      <div className="cabecera-jaula">
        <div className="codigo">Juntada de huevos</div>
        <p className="suave">Cargá los maples completos que se juntaron. Se suman al stock al confirmar.</p>
      </div>
      <ActionForm
        action={registrarJuntada}
        boton="Sumar al stock"
        botonClass="btn primario enorme"
        onOk={(r) => setExito({ mensaje: r.mensaje, hora: String(r.datos?.hora ?? "") })}
      >
        <Stepper name="maples" label="Maples juntados" inicial={0} max={5000} />
      </ActionForm>
    </div>
  );
}
