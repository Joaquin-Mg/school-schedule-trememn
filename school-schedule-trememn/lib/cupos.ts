/**
 * lib/cupos.ts
 * Constantes y utilidades de cupo para F-3 (validación API) y F-4 (UI grilla).
 */

export const CUPO_SEMANAL = 2  // reservas de un mismo curso por espacio por semana
export const CUPO_DIARIO  = 1  // reservas de un mismo curso por espacio por día

/**
 * Dado un string de fecha "YYYY-MM-DD", devuelve el lunes y el domingo
 * de la semana que contiene esa fecha (semana lunes–domingo).
 */
export function semanaDeUnaFecha(fecha: string): { inicio: string; fin: string } {
  // Forzar mediodía para evitar problemas de zona horaria al parsear solo la fecha
  const d = new Date(fecha + 'T12:00:00')
  // getDay(): 0=domingo, 1=lunes ... 6=sábado
  // Queremos que el lunes sea el día 0 de la semana
  const dow = d.getDay() === 0 ? 6 : d.getDay() - 1

  const lunes  = new Date(d)
  lunes.setDate(d.getDate() - dow)

  const domingo = new Date(lunes)
  domingo.setDate(lunes.getDate() + 6)

  return {
    inicio: lunes.toLocaleDateString('en-CA'),   // "YYYY-MM-DD"
    fin:    domingo.toLocaleDateString('en-CA'),
  }
}
