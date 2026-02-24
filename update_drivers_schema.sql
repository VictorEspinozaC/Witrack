-- =============================================
-- SCRIPT DE MIGRACIÓN: EXPANSIÓN DE PERFIL DE CHOFER
-- Ejecutar en el Editor SQL de Supabase
-- =============================================

-- Agregar campos de fecha a la tabla de choferes
ALTER TABLE public.drivers 
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS license_expiry_date DATE;

-- Comentario para documentación
COMMENT ON COLUMN public.drivers.birth_date IS 'Fecha de nacimiento del chofer';
COMMENT ON COLUMN public.drivers.license_expiry_date IS 'Fecha de vencimiento de la licencia de conducir';
