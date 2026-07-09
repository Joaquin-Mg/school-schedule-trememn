'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Calendar, Clock, LogOut, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import confetti from 'canvas-confetti'

interface Espacio {
  id: string
  nombre: string
  descripcion: string
}

interface Bloque {
  id: string
  hora_inicio: string
  hora_fin: string
}

interface Reserva {
  id: string
  fecha: string
  codigo_qr_validador: string
  categorias_espacios: { nombre: string }
  bloques_horarios: { hora_inicio: string; hora_fin: string }
}

export default function Dashboard() {
  const supabase = createClient()
  const router = useRouter()

  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [espacios, setEspacios] = useState<Espacio[]>([])
  const [bloques, setBloques] = useState<Bloque[]>([])
  const [reservasSemanales, setReservasSemanales] = useState<Reserva[]>([])

  const [selectedEspacio, setSelectedEspacio] = useState<string>('')
  const [selectedFecha, setSelectedFecha] = useState<string>(new Date().toISOString().split('T')[0])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
      } else {
        setUser(user)
        await cargarDatosIniciales(user.id)
      }
      setLoading(false)
    }
    checkUser()
  }, [])

  const cargarDatosIniciales = async (userId: string) => {
    // 1. Obtener Espacios
    const { data: esp } = await supabase.from('categorias_espacios').select('*')
    setEspacios(esp || [])
    if (esp && esp.length > 0) setSelectedEspacio(esp[0].id)

    // 2. Obtener Bloques fijos
    const { data: blq } = await supabase.from('bloques_horarios').select('*').order('hora_inicio')
    setBloques(blq || [])

    // 3. Obtener reservas del alumno de la semana actual
    await actualizarReservas(userId)
  }

  const actualizarReservas = async (userId: string) => {
    const { data: res } = await supabase
      .from('reservas')
      .select(`
        id, fecha, codigo_qr_validador,
        categorias_espacios(nombre),
        bloques_horarios(hora_inicio, hora_fin)
      `)
      .eq('usuario_id', userId)
      .order('fecha', { ascending: true })

    setReservasSemanales(res as unknown as Reserva[] || [])
  }

  const handleReserva = async (bloqueId: string) => {
    setErrorMsg(null)
    setSuccessMsg(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('reservas').insert([
      {
        usuario_id: user.id,
        usuario_email: user.email,
        espacio_id: selectedEspacio,
        bloque_id: bloqueId,
        fecha: selectedFecha
      }
    ])

    if (error) {
      // Captura los mensajes personalizados enviados por nuestros Triggers de Supabase
      setErrorMsg(error.message)
    } else {
      setSuccessMsg('¡Reserva confirmada con éxito! Tu comprobante QR ya está disponible.')
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
      await actualizarReservas(user.id)
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
    <div className="min-h-screen bg-slate-50">
      {/* NAVBAR */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-xl text-indigo-600 tracking-tight">Trememn Reservas</span>
            <span className="text-xs bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md font-medium hidden sm:inline-block">Alumno</span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-slate-600 font-medium hidden md:inline-block">{user?.email}</span>
            <button onClick={handleLogout} className="inline-flex items-center space-x-1.5 px-3 py-2 border border-slate-200 text-sm font-medium rounded-xl text-slate-700 hover:bg-slate-50 transition-colors">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* COLUMNA IZQUIERDA Y CENTRAL: SELECTOR DE RESERVAS */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-indigo-600" />
              <span>Solicitar un Espacio Horario</span>
            </h2>

            {/* FEEDBACK DE ACCIONES */}
            {errorMsg && (
              <div className="p-4 bg-red-50 border border-red-100 text-red-800 text-sm rounded-xl flex items-start space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm rounded-xl flex items-start space-x-2">
                <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* CONFIGURACIÓN FILTROS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">1. Selecciona el Espacio</label>
                <select value={selectedEspacio} onChange={(e) => setSelectedEspacio(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium">
                  {espacios.map((esp) => (
                    <option key={esp.id} value={esp.id}>{esp.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">2. Selecciona la Fecha</label>
                <input type="date" value={selectedFecha} onChange={(e) => setSelectedFecha(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium" />
              </div>
            </div>

            {/* GRILLA DE BLOQUES HORARIOS */}
            <div className="pt-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">3. Bloques Horarios Disponibles para este día</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {bloques.map((b) => (
                  <div key={b.id} className="border border-slate-200 rounded-xl p-4 flex items-center justify-between hover:border-slate-300 transition-all bg-white shadow-sm">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                        <Clock className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{b.hora_inicio.slice(0, 5)} - {b.hora_fin.slice(0, 5)}</p>
                        <p className="text-xs text-slate-400">Cupos limitados por normativa</p>
                      </div>
                    </div>
                    <button onClick={() => handleReserva(b.id)} className="bg-indigo-600 text-white font-medium text-xs px-4 py-2.5 rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shadow-sm">
                      Reservar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: MIS COMPROBANTES / QR DE LA SEMANA */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-xl font-bold text-slate-900">Mis Reservas Activas</h2>
            <p className="text-xs text-slate-500">Recuerda que tienes un cupo de un máximo de 2 reservas a la semana.</p>

            {reservasSemanales.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-xl">
                No tienes reservas registradas para esta semana.
              </div>
            ) : (
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {reservasSemanales.map((res) => (
                  <div key={res.id} className="border border-slate-100 rounded-xl p-4 bg-slate-50 space-y-3 shadow-inner">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">{res.categorias_espacios?.nombre}</h4>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">{res.fecha}</p>
                        <p className="text-xs text-indigo-600 font-semibold mt-1 flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          {res.bloques_horarios?.hora_inicio.slice(0, 5)} - {res.bloques_horarios?.hora_fin.slice(0, 5)}
                        </p>
                      </div>
                    </div>

                    {/* CODIGO QR IMPRESO EN PANTALLA COMO COMPROBANTE INMEDIATO */}
                    <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-slate-200">
                      <QRCodeSVG
                        value={`${typeof window !== 'undefined' ? window.location.origin : ''}/validar/${res.codigo_qr_validador}`}
                        size={120}
                        level={"H"}
                      />
                      <span className="text-[10px] font-mono text-slate-400 mt-2">ID: {res.codigo_qr_validador.slice(0, 8)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
