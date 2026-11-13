# Gallinero

Web app para gestionar el gallinero: stock de huevos en maples, entregas y reporte de jaulas muestra con etiquetas NFC.

- **Operarios:** apoyan el celular en la etiqueta de una jaula y registran Todo OK, huevos, mortandad, problemas o sanidad. En el parche general cargan los maples juntados.
- **Administrador:** ve el stock, registra salidas y recuentos, consulta reportes y configura jaulas, usuarios y etiquetas.

Hecho con Next.js y PostgreSQL (Supabase). La especificación completa está en el documento del proyecto.

## Publicarlo en Vercel + Supabase

1. En [vercel.com](https://vercel.com), **Add New → Project**, importá este repo y tocá **Deploy**. El primer deploy funciona pero muestra "Falta conectar la base de datos".
2. En el proyecto de Vercel, andá a **Storage → Create Database → Supabase**, creá la base (región São Paulo es la más cercana) y conectala al proyecto. Eso carga solas las variables `POSTGRES_URL` y compañía.
3. **Deployments → Redeploy**. En ese build se crean las tablas automáticamente.
4. Entrá a la URL del proyecto: te pide crear el primer administrador.

No hace falta ninguna otra variable de entorno. La clave de las sesiones se genera sola y queda guardada en la base.

### Variables opcionales

| Variable | Para qué |
| --- | --- |
| `DATABASE_URL` | Usar otra base Postgres en lugar de la de Supabase |
| `APP_URL` | Forzar el dominio de los links de las etiquetas (por defecto usa el dominio desde el que se entra al panel) |
| `APP_TZ` | Zona horaria de la granja (por defecto `America/Argentina/Buenos_Aires`) |

## Primeros pasos en la app

1. **Jaulas:** cargá las jaulas muestra (galpón, fila, rango de jaulas y aves por jaula).
2. **Usuarios:** creá a los operarios con un PIN inicial; lo cambian en el primer ingreso.
3. **Etiquetas:** generá códigos, grabá cada link en una etiqueta con NFC Tools, pegala y apoyá tu celular para asignarla a su jaula o como parche general.

## Desarrollo local

```bash
npm install
export DATABASE_URL=postgres://usuario@localhost:5432/gallinero
npm run migrate
npm run dev
```

## Reglas del sistema

- Los registros de jaulas y los movimientos de stock nunca se borran: un error se corrige anulándolo desde el panel, y queda tachado en el historial.
- Stock = último recuento + juntadas − salidas posteriores, en maples de 30 huevos.
- Aves de una jaula = último ajuste − mortandad posterior.
- Sesión de 30 días; 5 PIN incorrectos bloquean al usuario 15 minutos.
