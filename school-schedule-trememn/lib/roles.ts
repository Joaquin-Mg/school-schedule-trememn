/**
 * Determina si un email pertenece a la lista de profesores del colegio.
 * La lista se configura via la variable de entorno TEACHER_EMAILS,
 * separada por comas. Ej: profe1@trememn.cl,profe2@trememn.cl
 *
 * Esta función es server-only: no expone la lista de emails al cliente.
 */
export function isTeacher(email: string | undefined): boolean {
  if (!email) return false
  const teacherEmails = (process.env.TEACHER_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  return teacherEmails.includes(email.toLowerCase())
}
