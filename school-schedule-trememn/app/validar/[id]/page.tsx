'use client'

import { useEffect, useState, use } from 'react'
import { createClient } from '@/lib/supabase'
import { CheckCircle2, XCircle, User, MapPin, Calendar, Clock, Loader2, ShieldCheck, RefreshCw } from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

interface ReservaDetalle {
  id: string
  fecha: string
  usuario_email: string
  codigo_qr_validador: string
  categorias_espacios: { nombre: string } | null
  bloques_horarios: { hora_inicio: string; hora_fin: string } | null
}

export default function Validar({ params }: PageProps) {
  const { id } = use(params)
  const supabase = createClient()

  const [reserva, setReserva] = useState<ReservaDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [scanTime, setScanTime] = useState<string>('')

  const fetchReserva = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const { data, error } = await supabase
        .from('reservas')
        .select(`
          id,
          fecha,
          usuario_email,
          codigo_qr_validador,
          categorias_espacios (nombre),
          bloques_horarios (hora_inicio, hora_fin)
        `)
        .eq('codigo_qr_validador', id)
        .maybeSingle()

      if (error) {
        throw new Error(error.message)
      }

      if (!data) {
        setErrorMsg('Reserva no encontrada. El código QR no es válido o ha expirado.')
      } else {
        setReserva(data as unknown as ReservaDetalle)
        setScanTime(new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con el servidor.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) {
      fetchReserva()
    }
  }, [id])

  const formatEmailToName = (email: string) => {
    if (!email) return 'Alumno'
    const namePart = email.split('@')[0]
    return namePart
      .split('.')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const formatFecha = (fechaStr: string) => {
    try {
      const date = new Date(fechaStr + 'T00:00:00')
      return date.toLocaleDateString('es-CL', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } catch (e) {
      return fechaStr
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-500" />
          <p className="text-slate-400 font-medium animate-pulse text-sm">Consultando validador...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 relative select-none">
      {/* Fondo estético con gradiente radial */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08),transparent_65%)] pointer-events-none" />

      {/* Tarjeta Validadora estilo Ticket Pass */}
      <div className="relative w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl overflow-hidden shadow-2xl shadow-indigo-950/20">
        
        {/* Cabecera Estado */}
        {!errorMsg && reserva ? (
          <div className="bg-gradient-to-b from-emerald-500/20 to-emerald-500/5 p-8 flex flex-col items-center text-center border-b border-slate-800/60 relative">
            <div className="absolute top-4 right-4">
              <span className="flex h-3.5 w-3.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
              </span>
            </div>
            <div className="h-20 w-20 rounded-2xl bg-emerald-500 flex items-center justify-center text-slate-950 shadow-[0_0_30px_rgba(16,185,129,0.35)] mb-4 animate-scale-up">
              <ShieldCheck className="h-11.5 w-11.5" />
            </div>
            <h1 className="text-2xl font-extrabold text-emerald-400 tracking-tight">Acceso Autorizado</h1>
            <p className="text-emerald-200/50 text-xs font-semibold mt-1 uppercase tracking-widest">Reserva Validada con Éxito</p>
          </div>
        ) : (
          <div className="bg-gradient-to-b from-red-500/20 to-red-500/5 p-8 flex flex-col items-center text-center border-b border-slate-800/60 relative">
            <div className="h-20 w-20 rounded-2xl bg-red-500 flex items-center justify-center text-slate-950 shadow-[0_0_30px_rgba(239,68,68,0.35)] mb-4">
              <XCircle className="h-11.5 w-11.5" />
            </div>
            <h1 className="text-2xl font-extrabold text-red-400 tracking-tight">Acceso Denegado</h1>
            <p className="text-red-200/50 text-xs font-semibold mt-1 uppercase tracking-widest">Reserva Inválida</p>
          </div>
        )}

        {/* Detalles del Ticket */}
        <div className="p-6 sm:p-8 space-y-6 relative">
          
          {/* Muescas laterales estilo boleto físico */}
          <div className="absolute -left-3.5 top-1/2 -translate-y-1/2 w-7 h-7 bg-slate-950 rounded-full border border-slate-800 border-l-transparent z-10" />
          <div className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 bg-slate-950 rounded-full border border-slate-800 border-r-transparent z-10" />

          {!errorMsg && reserva ? (
            <div className="space-y-6">
              
              {/* Alumno */}
              <div className="flex items-start space-x-3.5">
                <div className="p-2.5 bg-slate-800 text-slate-300 rounded-xl mt-0.5">
                  <User className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Alumno</p>
                  <p className="text-base font-bold text-slate-100 truncate mt-0.5">
                    {formatEmailToName(reserva.usuario_email)}
                  </p>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{reserva.usuario_email}</p>
                </div>
              </div>

              {/* Lugar de Reserva */}
              <div className="flex items-start space-x-3.5">
                <div className="p-2.5 bg-slate-800 text-slate-300 rounded-xl mt-0.5">
                  <MapPin className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Espacio Reservado</p>
                  <p className="text-base font-bold text-slate-100 mt-0.5">
                    {reserva.categorias_espacios?.nombre || 'Espacio no especificado'}
                  </p>
                </div>
              </div>

              {/* Línea divisoria punteada estilo cupón */}
              <div className="border-t border-dashed border-slate-800 my-4" />

              {/* Fecha y Horario */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-slate-800 text-slate-300 rounded-lg mt-0.5">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Fecha</p>
                    <p className="text-xs font-bold text-slate-200 mt-0.5 capitalize">{formatFecha(reserva.fecha)}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-slate-800 text-slate-300 rounded-lg mt-0.5">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Horario</p>
                    <p className="text-xs font-bold text-slate-200 mt-0.5">
                      {reserva.bloques_horarios
                        ? `${reserva.bloques_horarios.hora_inicio.slice(0, 5)} - ${reserva.bloques_horarios.hora_fin.slice(0, 5)}`
                        : 'Horario no definido'}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center py-6 space-y-4">
              <p className="text-slate-300 font-medium text-sm">
                {errorMsg || 'No se pudo cargar la información de validación.'}
              </p>
              <button
                onClick={fetchReserva}
                className="inline-flex items-center space-x-2 px-4 py-2 border border-slate-800 hover:border-slate-700 text-sm font-medium rounded-xl text-slate-300 hover:bg-slate-800/50 transition-all bg-slate-900 shadow-sm"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Reintentar Lectura</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer del Ticket */}
        <div className="bg-slate-950 p-6 flex flex-col sm:flex-row items-center justify-between border-t border-slate-800/40 text-center sm:text-left gap-4">
          <div>
            <div className="flex items-center justify-center sm:justify-start space-x-2 text-indigo-400">
              <span className="font-bold text-sm tracking-tight text-indigo-400">Colegio Trememn</span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">ID: {id.slice(0, 18)}...</p>
          </div>
          {!errorMsg && (
            <div className="bg-slate-900 border border-slate-850 px-3 py-1.5 rounded-xl font-mono text-[10px] text-slate-400">
              Escaneado: {scanTime}
            </div>
          )}
        </div>
      </div>
      
      {/* Botón flotante para volver atrás */}
      <button 
        onClick={() => window.history.back()}
        className="mt-6 text-xs text-slate-500 hover:text-slate-300 transition-colors uppercase tracking-wider font-semibold border-b border-transparent hover:border-slate-500"
      >
        ← Volver
      </button>
    </div>
  )
}
