"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { Stepper } from "@/components/Stepper";
import { registrarEvento } from "@/app/actions/registro";
import { MOTIVOS_AJUSTE, MOTIVOS_PROBLEMA, MOTIVOS_SANIDAD } from "@/lib/format";

type Panel = "mortandad" | "huevos" | "problema" | "sanidad" | "ajuste_aves" | null;

function Opciones({ name, opciones }: { name: string; opciones: Record<string, string> }) {
  return (
    <div className="opciones">
      {Object.entries(opciones).map(([valor, etiqueta]) => (
        <label key={valor} className="opcion">
          <input type="radio" name={name} value={valor} required /> {etiqueta}
        </label>
      ))}
    </div>
  );
}

function Nota({ obligatoria }: { obligatoria?: boolean }) {
  return (
    <div className="campo">
      <label htmlFor="nota">Nota {obligatoria ? "" : "(opcional)"}</label>
      <input id="nota" name="nota" maxLength={300} />
    </div>
  );
}

export function JaulaPantalla({
  jaulaId,
  codigo,
  aves,
  esAdmin,
}: {
  jaulaId: number;
  codigo: string;
  aves: number | null;
  esAdmin: boolean;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [exito, setExito] = useState<{ mensaje: string; hora: string } | null>(null);

  if (exito) {
    return (
      <div className="tarjeta exito">
        <div className="tilde" aria-hidden>
          ✓
        </div>
        <h1>Registrado</h1>
        <p>
          <strong>{codigo}</strong> · {exito.mensaje} · {exito.hora}
        </p>
        <p className="suave">Apoyá el celular en la próxima jaula.</p>
        <button
          className="btn"
          onClick={() => {
            setExito(null);
            setPanel(null);
          }}
        >
          Registrar otra cosa en esta jaula
        </button>
      </div>
    );
  }

  const alGuardar = (r: { mensaje: string; datos?: Record<string, string | number> }) =>
    setExito({ mensaje: r.mensaje, hora: String(r.datos?.hora ?? "") });

  const oculto = (tipo: string) => (
    <>
      <input type="hidden" name="jaula_id" value={jaulaId} />
      <input type="hidden" name="tipo" value={tipo} />
    </>
  );

  const botones: { tipo: Exclude<Panel, null>; label: string }[] = [
    { tipo: "huevos", label: "Huevos" },
    { tipo: "mortandad", label: "Mortandad" },
    { tipo: "problema", label: "Problema" },
    { tipo: "sanidad", label: "Sanidad" },
  ];
  if (esAdmin) botones.push({ tipo: "ajuste_aves", label: "Ajustar aves" });

  return (
    <>
      {!panel && (
        <ActionForm action={registrarEvento} boton="✓ Todo OK" botonClass="btn primario enorme" onOk={alGuardar}>
          {oculto("ok")}
        </ActionForm>
      )}

      <div className="botones-evento">
        {botones.map((b) => (
          <button
            key={b.tipo}
            type="button"
            className={`btn ${panel === b.tipo ? "elegido" : ""}`}
            onClick={() => setPanel(panel === b.tipo ? null : b.tipo)}
          >
            {b.label}
          </button>
        ))}
      </div>

      {panel && (
        <div className="tarjeta" style={{ marginTop: "1rem" }}>
          {panel === "huevos" && (
            <ActionForm key="huevos" action={registrarEvento} boton="Guardar huevos" botonClass="btn primario ancho" onOk={alGuardar}>
              {oculto("huevos")}
              <Stepper name="buenos" label="Buenos" />
              <Stepper name="rotos" label="Rotos" />
              <Stepper name="sucios" label="Sucios" />
              <p className="suave">
                <small>Es un indicador de postura de la jaula. El stock se carga en el parche general.</small>
              </p>
            </ActionForm>
          )}
          {panel === "mortandad" && (
            <ActionForm key="mortandad" action={registrarEvento} boton="Guardar mortandad" botonClass="btn primario ancho" onOk={alGuardar}>
              {oculto("mortandad")}
              <Stepper name="cantidad" label="Aves muertas" inicial={1} min={1} max={aves ?? 20} />
            </ActionForm>
          )}
          {panel === "problema" && (
            <ActionForm key="problema" action={registrarEvento} boton="Guardar problema" botonClass="btn primario ancho" onOk={alGuardar}>
              {oculto("problema")}
              <Opciones name="motivo" opciones={MOTIVOS_PROBLEMA} />
              <Nota />
            </ActionForm>
          )}
          {panel === "sanidad" && (
            <ActionForm key="sanidad" action={registrarEvento} boton="Guardar sanidad" botonClass="btn primario ancho" onOk={alGuardar}>
              {oculto("sanidad")}
              <Opciones name="motivo" opciones={MOTIVOS_SANIDAD} />
              <Nota />
            </ActionForm>
          )}
          {panel === "ajuste_aves" && (
            <ActionForm key="ajuste" action={registrarEvento} boton="Guardar ajuste" botonClass="btn primario ancho" onOk={alGuardar}>
              {oculto("ajuste_aves")}
              <Stepper name="cantidad" label="Aves en la jaula" inicial={aves ?? 4} max={50} />
              <Opciones name="motivo" opciones={MOTIVOS_AJUSTE} />
              <Nota />
            </ActionForm>
          )}
        </div>
      )}
    </>
  );
}
