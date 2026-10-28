-- Migración 008: quitar acceso público a reservas (el validador ahora usa validar_reserva)
DROP POLICY IF EXISTS "reservas: validación QR pública" ON reservas;
