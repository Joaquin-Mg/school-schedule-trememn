'use client'

import { use } from 'react'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function Validar({ params }: PageProps) {
  const resolvedParams = use(params)
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <h1 className="text-2xl font-bold text-slate-800">
        Validación de Reserva ID: {resolvedParams.id}
      </h1>
    </div>
  )
}
