"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { asignarEtiqueta } from "@/app/actions/registro";

type Jaula = { id: number; codigo: string; conEtiqueta: boolean };

export function AsignarEtiqueta({ codigo, jaulas, hayGeneral }: { codigo: string; jaulas: Jaula[]; hayGeneral: boolean }) {
  const [tipo, setTipo] = useState<"jaula" | "general">("jaula");
  const [filtro, setFiltro] = useState("");
  const visibles = jaulas.filter((j) => j.codigo.toLowerCase().includes(filtro.trim().toLowerCase()));

  return (
    <div className="tarjeta">
      <h1>Etiqueta nueva</h1>
      <p className="suave">
        Código <strong>{codigo}</strong>. Elegí a qué corresponde. Desde ese momento, esta etiqueta abre esa jaula o la
        carga de la juntada.
      </p>
      <ActionForm action={asignarEtiqueta} boton="Asignar etiqueta" botonClass="btn primario ancho">
        <input type="hidden" name="codigo" value={codigo} />
        <div className="opciones">
          <label className="opcion">
            <input type="radio" name="tipo" value="jaula" checked={tipo === "jaula"} onChange={() => setTipo("jaula")} />
            Jaula muestra
          </label>
          <label className="opcion">
            <input
              type="radio"
              name="tipo"
              value="general"
              checked={tipo === "general"}
              onChange={() => setTipo("general")}
            />
            Parche general (juntada de huevos)
          </label>
        </div>

        {tipo === "jaula" &&
          (jaulas.length === 0 ? (
            <p className="msg aviso">
              Todavía no hay jaulas cargadas. Crealas primero en <a href="/admin/jaulas">Jaulas</a>.
            </p>
          ) : (
            <>
              <div className="campo">
                <label htmlFor="buscar">Buscar jaula</label>
                <input id="buscar" placeholder="ej. G1-F02" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
              </div>
              <div className="campo">
                <label htmlFor="jaula_id">Jaula</label>
                <select id="jaula_id" name="jaula_id" required size={Math.min(8, Math.max(3, visibles.length))}>
                  {visibles.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.codigo}
                      {j.conEtiqueta ? " (ya tiene etiqueta: se reemplaza)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ))}
        {tipo === "general" && hayGeneral && (
          <p className="msg aviso">Ya hay un parche general activo. Si asignás este, el anterior queda dado de baja.</p>
        )}
      </ActionForm>
    </div>
  );
}
