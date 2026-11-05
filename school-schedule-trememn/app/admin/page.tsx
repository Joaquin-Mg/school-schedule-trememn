'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Upload, Loader2, CheckCircle, AlertTriangle, LogOut, Users, ArrowLeft, AlertOctagon } from 'lucide-react'

interface ResultadoCarga {
  actualizados: number
  errores: string[]
}

interface AfectadoNoShow {
  usuario_email: string
  reserva_id: string
  suspendido_hasta: string
}

interface ResultadoNoShows {
  procesados: number
  afectados: AfectadoNoShow[]
}

export default function AdminPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [esProfesor, setEsProfesor] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [resultado, setResultado] = useState<ResultadoCarga | null>(null)
  const [errorGlobal, setErrorGlobal] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [registrandoNoShows, setRegistrandoNoShows] = useState(false)
  const [resultadoNoShows, setResultadoNoShows] = useState<ResultadoNoShows | null>(null)
  const [errorNoShows, setErrorNoShows] = useState<string | null>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Verificar rol desde la API (el servidor valida isTeacher)
      const res = await fetch('/api/spaces')
      const json = await res.json()
      if (!json.esProfesor) {
        router.push('/dashboard')
        return
      }
      setEsProfesor(true)
      setLoading(false)
    }
    init()
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setResultado(null)
    setErrorGlobal(null)
  }

  const handleUpload = async () => {
    if (!file) return

    setSubiendo(true)
    setResultado(null)
    setErrorGlobal(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/admin/upload-cursos', {
        method: 'POST',
        body: formData,
      })

      const json = await res.json()
      if (!res.ok) {
        setErrorGlobal(json.error ?? 'Error desconocido al procesar el archivo')
      } else {
        setResultado(json)
        setFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    } catch {
      setErrorGlobal('Error de red. Intenta nuevamente.')
    } finally {
      setSubiendo(false)
    }
  }

  const handleRegistrarNoShows = async () => {
    const confirmado = window.confirm(
      '¿Registrar no-shows de ayer?\n\nEsto marcará como suspendidos (7 días) a todos los alumnos que tenían reserva activa ayer y no validaron el QR.\n\nEsta acción no se puede deshacer.'
    )
    if (!confirmado) return

    setRegistrandoNoShows(true)
    setResultadoNoShows(null)
    setErrorNoShows(null)

    try {
      const res = await fetch('/api/admin/registrar-no-shows', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setErrorNoShows(json.error ?? 'Error al registrar no-shows')
      } else {
        setResultadoNoShows(json)
      }
    } catch {
      setErrorNoShows('Error de red. Intenta nuevamente.')
    } finally {
      setRegistrandoNoShows(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* NAVBAR */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="font-bold text-xl text-indigo-600 tracking-tight">Panel Admin</span>
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md font-medium hidden sm:inline-block">
              Profesor
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="inline-flex items-center space-x-1.5 px-3 py-2 border border-slate-200 text-sm font-medium rounded-xl text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Cerrar Sesión</span>
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* SECCIÓN: ASIGNAR CURSOS VÍA CSV */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Asignar Cursos</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Sube un CSV con formato <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-mono text-xs">email,curso</code> para actualizar los cursos de los alumnos.
              </p>
            </div>
          </div>

          {/* Ejemplo CSV */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Formato esperado</p>
            <pre className="text-xs font-mono text-slate-700 leading-relaxed">
{`email,curso
juan.perez@trememn.cl,I°M
maria.soto@trememn.cl,II°A
pedro.mena@trememn.cl,I°M`}
            </pre>
          </div>

          {/* Input de archivo */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Selecciona el archivo CSV
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer"
            />
            {file && (
              <p className="text-xs text-slate-500 mt-1.5">
                Archivo seleccionado: <span className="font-semibold text-slate-700">{file.name}</span> ({Math.round(file.size / 1024)} KB)
              </p>
            )}
          </div>

          {/* Error global */}
          {errorGlobal && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-800 text-sm rounded-xl flex items-start space-x-2.5">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <span>{errorGlobal}</span>
            </div>
          )}

          {/* Resultado de carga */}
          {resultado && (
            <div className="space-y-3">
              <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm rounded-xl flex items-start space-x-2.5">
                <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <span className="font-bold">{resultado.actualizados} alumno{resultado.actualizados !== 1 ? 's' : ''}</span> actualizado{resultado.actualizados !== 1 ? 's' : ''} correctamente.
                  {resultado.errores.length > 0 && (
                    <span className="ml-1 text-amber-700">{resultado.errores.length} fila{resultado.errores.length !== 1 ? 's' : ''} con error.</span>
                  )}
                </span>
              </div>
              {resultado.errores.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Filas con error</p>
                  <ul className="space-y-1">
                    {resultado.errores.map((e, i) => (
                      <li key={i} className="text-xs text-amber-800 font-mono">• {e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Botón cargar */}
          <button
            onClick={handleUpload}
            disabled={!file || subiendo}
            className="inline-flex items-center space-x-2 bg-indigo-600 text-white font-bold text-sm px-6 py-3 rounded-xl hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 shadow-sm"
          >
            {subiendo ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Procesando...</span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                <span>Cargar CSV</span>
              </>
            )}
          </button>
        </div>

        {/* SECCIÓN: REGISTRAR NO-SHOWS */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-red-50 text-red-600 rounded-xl">
              <AlertOctagon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Registrar No-Shows</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Aplica suspensión de 7 días a alumnos que tuvieron reserva ayer y no validaron el QR.
              </p>
            </div>
          </div>

          {errorNoShows && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-800 text-sm rounded-xl flex items-start space-x-2.5">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <span>{errorNoShows}</span>
            </div>
          )}

          {resultadoNoShows && (
            <div className="space-y-3">
              <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm rounded-xl flex items-start space-x-2.5">
                <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  {resultadoNoShows.procesados === 0
                    ? 'Sin no-shows ayer. Ningún alumno fue suspendido.'
                    : (
                      <>
                        <span className="font-bold">{resultadoNoShows.procesados} alumno{resultadoNoShows.procesados !== 1 ? 's' : ''}</span> suspendido{resultadoNoShows.procesados !== 1 ? 's' : ''} por 7 días.
                      </>
                    )
                  }
                </span>
              </div>
              {resultadoNoShows.afectados.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                  <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Alumnos suspendidos</p>
                  <ul className="space-y-1">
                    {resultadoNoShows.afectados.map((a, i) => (
                      <li key={i} className="text-xs text-amber-800 font-mono">
                        • {a.usuario_email} — hasta {a.suspendido_hasta}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleRegistrarNoShows}
            disabled={registrandoNoShows}
            className="inline-flex items-center space-x-2 bg-red-600 text-white font-bold text-sm px-6 py-3 rounded-xl hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 shadow-sm"
          >
            {registrandoNoShows ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Procesando...</span>
              </>
            ) : (
              <>
                <AlertOctagon className="h-4 w-4" />
                <span>Registrar No-Shows de Ayer</span>
              </>
            )}
          </button>
        </div>

        {/* PLACEHOLDER: estadísticas futuras */}
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-6 text-center text-slate-400">
          <p className="text-sm font-medium">Estadísticas y otras herramientas admin — próximamente</p>
        </div>
      </main>
    </div>
  )
}
