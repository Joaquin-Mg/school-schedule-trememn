'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { GraduationCap, Mail, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    // 1. Validación estricta en el cliente antes de consultar la API
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail.endsWith('@trememn.cl')) {
      setMessage({
        type: 'error',
        text: 'Acceso denegado. Debes utilizar exclusivamente tu correo institucional asignado (@trememn.cl).',
      })
      setLoading(false)
      return
    }

    // 2. Despachar solicitud de enlace mágico a Supabase Auth
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        // Redirección automática tras pulsar el enlace en el correo electrónico
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    })

    if (error) {
      setMessage({
        type: 'error',
        text: `No se pudo enviar el enlace: ${error.message}`,
      })
    } else {
      setMessage({
        type: 'success',
        text: '¡Enlace enviado! Por favor, revisa la bandeja de entrada de tu correo institucional para acceder.',
      })
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-indigo-600 text-white shadow-lg mb-4">
          <GraduationCap className="h-9 w-9" />
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          Colegio Trememn
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Gestión y Reserva Institucional de Espacios Horarios
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl rounded-2xl sm:px-10 border border-slate-100">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
                Dirección de Correo Institucional
              </label>
              <div className="mt-2 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-5 w-5" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alumno@trememn.cl"
                  disabled={loading}
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl bg-slate-50 placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all"
                />
              </div>
            </div>

            {message && (
              <div
                className={`p-4 rounded-xl flex items-start space-x-3 text-sm ${
                  message.type === 'error'
                    ? 'bg-red-50 text-red-800 border border-red-100'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                }`}
              >
                {message.type === 'error' ? (
                  <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
                )}
                <span>{message.text}</span>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Validando dominio...' : 'Solicitar Enlace de Acceso'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <span className="text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full inline-block font-mono">
              Acceso exclusivo dominio @trememn.cl
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
