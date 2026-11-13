"use client";

import { useState } from "react";

/** Número con botones grandes de + y −, pensado para usar con guantes. */
export function Stepper({
  name,
  label,
  inicial = 0,
  min = 0,
  max = 9999,
}: {
  name: string;
  label: string;
  inicial?: number;
  min?: number;
  max?: number;
}) {
  const [v, setV] = useState(String(inicial));
  const n = Number(v) || 0;
  const set = (x: number) => setV(String(Math.max(min, Math.min(max, x))));
  return (
    <div className="stepper">
      <label htmlFor={`st-${name}`}>{label}</label>
      <div className="stepper-fila">
        <button type="button" className="btn redondo" onClick={() => set(n - 1)} aria-label={`Restar ${label}`}>
          −
        </button>
        <input
          id={`st-${name}`}
          name={name}
          inputMode="numeric"
          pattern="[0-9]*"
          value={v}
          onChange={(e) => setV(e.target.value.replace(/\D/g, "").slice(0, 5))}
          onFocus={(e) => e.target.select()}
        />
        <button type="button" className="btn redondo" onClick={() => set(n + 1)} aria-label={`Sumar ${label}`}>
          +
        </button>
      </div>
    </div>
  );
}
