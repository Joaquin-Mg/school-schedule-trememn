'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Calendar, Clock, LogOut, CheckCircle, AlertTriangle, Loader2, History, Ticket, PlusCircle, Sparkles, ChevronRight, Info } from 'lucide-react'
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
  
  // Control de pestañas del panel lateral
  const [activeTab, setActiveTab] = useState<'reservar' | 'mis_reservas' | 'historial'>('reservar')

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
      setErrorMsg(error.message)
    } else {
      setSuccessMsg('¡Reserva confirmada con éxito! Tu comprobante QR ya está disponible en "Mis Reservas".')
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
      await actualizarReservas(user.id)
      
      // Opcional: Cambia automáticamente a la pestaña de Mis Reservas activas para que el alumno vea su ticket
      setTimeout(() => {
        setActiveTab('mis_reservas')
      }, 1500)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const formatFecha = (fechaStr: string) => {
    try {
      const date = new Date(fechaStr + 'T00:00:00')
      return date.toLocaleDateString('es-CL', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    } catch (e) {
      return fechaStr
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    )
  }

  const todayStr = new Date().toISOString().split('T')[0]
  
  // Dividir reservas en activas e historial
  const activeReservas = reservasSemanales.filter((r) => r.fecha >= todayStr)
  const pastReservas = reservasSemanales.filter((r) => r.fecha < todayStr)

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
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

      {/* DASHBOARD LAYOUT CON PANEL LATERAL */}
      <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto">
        
        {/* PANEL LATERAL DE NAVEGACIÓN */}
        <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200 p-4 md:p-6 shrink-0 md:sticky md:top-16 md:h-[calc(100vh-4rem)] flex flex-col justify-between">
          <div className="flex md:flex-col overflow-x-auto md:overflow-x-visible gap-2 pb-2 md:pb-0 scrollbar-none">
            
            <button
              onClick={() => setActiveTab('reservar')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition-all shrink-0 md:shrink ${
                activeTab === 'reservar'
                  ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <PlusCircle className="h-5 w-5" />
              <span>Reservar Espacio</span>
            </button>

            <button
              onClick={() => setActiveTab('mis_reservas')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition-all shrink-0 md:shrink relative ${
                activeTab === 'mis_reservas'
                  ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Ticket className="h-5 w-5" />
              <span>Mis Reservas Activas</span>
              {activeReservas.length > 0 && (
                <span className="ml-auto bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {activeReservas.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('historial')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition-all shrink-0 md:shrink ${
                activeTab === 'historial'
                  ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <History className="h-5 w-5" />
              <span>Historial</span>
            </button>
            
          </div>

          {/* Información del límite institucional al pie del menú lateral (solo desktop) */}
          <div className="hidden md:block p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
            <div className="flex items-center space-x-1.5 text-indigo-600">
              <Info className="h-4 w-4 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider">Normativa</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
              Máximo 1 reserva diaria por tipo de espacio y hasta 2 reservas por semana estudiantil.
            </p>
          </div>
        </aside>

        {/* ÁREA DE CONTENIDO DINÁMICO */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
          
          {/* PESTAÑA: RESERVAR ESPACIO */}
          {activeTab === 'reservar' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                    <Calendar className="h-5 w-5 text-indigo-600" />
                    <span>Reservar un Espacio Horario</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">Busca disponibilidad y asegura tu espacio escolar.</p>
                </div>

                {/* Mensajes de feedback */}
                {errorMsg && (
                  <div className="p-4 bg-red-50 border border-red-100 text-red-800 text-sm rounded-xl flex items-start space-x-2.5">
                    <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}
                {successMsg && (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm rounded-xl flex items-start space-x-2.5">
                    <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {/* Filtros */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">1. Selecciona el Espacio</label>
                    <select value={selectedEspacio} onChange={(e) => setSelectedEspacio(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold transition-all">
                      {espacios.map((esp) => (
                        <option key={esp.id} value={esp.id}>{esp.nombre}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">2. Selecciona la Fecha</label>
                    <input type="date" value={selectedFecha} onChange={(e) => setSelectedFecha(e.target.value)} className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold transition-all" />
                  </div>
                </div>

                {/* Bloques disponibles */}
                <div className="pt-4 border-t border-slate-100">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">3. Bloques Horarios Disponibles</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {bloques.map((b) => (
                      <div key={b.id} className="border border-slate-200 rounded-xl p-4 flex items-center justify-between hover:border-slate-300 transition-all bg-white shadow-sm">
                        <div className="flex items-center space-x-3">
                          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Clock className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{b.hora_inicio.slice(0, 5)} - {b.hora_fin.slice(0, 5)}</p>
                            <p className="text-[10px] text-slate-400 font-medium">Disponibilidad regulada</p>
                          </div>
                        </div>
                        <button onClick={() => handleReserva(b.id)} className="bg-indigo-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-indigo-700 active:scale-95 transition-all shadow-sm">
                          Reservar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PESTAÑA: MIS RESERVAS ACTIVAS */}
          {activeTab === 'mis_reservas' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                  <Ticket className="h-5 w-5 text-indigo-600" />
                  <span>Mis Reservas Activas</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">Presenta el código QR en tu móvil al inspector o encargado del recinto.</p>
              </div>

              {activeReservas.length === 0 ? (
                <div className="bg-white text-center py-16 px-4 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center space-y-3">
                  <Ticket className="h-10 w-10 text-slate-300" />
                  <p className="font-semibold">No tienes reservas activas para esta semana.</p>
                  <button onClick={() => setActiveTab('reservar')} className="mt-2 text-indigo-600 hover:text-indigo-700 font-bold text-xs underline">
                    Solicitar una reserva ahora
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {activeReservas.map((res) => (
                    <div key={res.id} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                      <div className="absolute top-0 right-0 bg-indigo-600 text-white font-bold text-[9px] uppercase px-3 py-1 rounded-bl-xl tracking-wider">
                        Válido
                      </div>
                      
                      <div className="flex justify-between items-start pt-2">
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-base">{res.categorias_espacios?.nombre}</h4>
                          <p className="text-xs text-slate-500 font-semibold mt-1 flex items-center">
                            <Calendar className="h-3.5 w-3.5 mr-1" />
                            {formatFecha(res.fecha)}
                          </p>
                          <p className="text-xs text-indigo-600 font-bold mt-1.5 flex items-center bg-indigo-55 px-2.5 py-1 rounded-lg w-max">
                            <Clock className="h-3.5 w-3.5 mr-1" />
                            {res.bloques_horarios?.hora_inicio.slice(0, 5)} - {res.bloques_horarios?.hora_fin.slice(0, 5)}
                          </p>
                        </div>
                      </div>
                      
                      {/* CÓDIGO QR GENERADO DIRECTAMENTE EN EL TICKET */}
                      <div className="flex flex-col items-center justify-center p-4 bg-slate-55 rounded-xl border border-slate-100">
                        <QRCodeSVG 
                          value={`${typeof window !== 'undefined' ? window.location.origin : ''}/validar/${res.codigo_qr_validador}`}
                          size={130}
                          level={"H"}
                        />
                        <span className="text-[9px] font-mono text-slate-400 mt-2.5">ID: {res.codigo_qr_validador.slice(0, 8)}...</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PESTAÑA: HISTORIAL */}
          {activeTab === 'historial' && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                  <History className="h-5 w-5 text-indigo-600" />
                  <span>Historial de Reservas</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1">Registro histórico de tus solicitudes pasadas en la institución.</p>
              </div>

              {pastReservas.length === 0 ? (
                <div className="bg-white text-center py-16 px-4 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center space-y-3">
                  <History className="h-10 w-10 text-slate-300" />
                  <p className="font-semibold">No se encontraron reservas archivadas.</p>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-left">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Espacio</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Bloque Horario</th>
                          <th className="px-6 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {pastReservas.map((res) => (
                          <tr key={res.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="whitespace-nowrap px-6 py-4">
                              <span className="font-bold text-slate-800 text-sm">{res.categorias_espacios?.nombre}</span>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4">
                              <span className="text-xs text-slate-600 font-semibold">{formatFecha(res.fecha)}</span>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4">
                              <span className="text-xs text-slate-650 font-medium">
                                {res.bloques_horarios?.hora_inicio.slice(0, 5)} - {res.bloques_horarios?.hora_fin.slice(0, 5)}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-6 py-4">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                Completado
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
