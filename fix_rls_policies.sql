-- ==========================================
-- SCRIPT PARA CORREGIR POLÍTICAS DE RLS
-- Ejecutar este script en el SQL Editor de Supabase
-- ==========================================

-- 1. Asegurar acceso total para usuarios autenticados en tabla de Sucursales
-- Esto permite que el UPSERT funcione correctamente
DROP POLICY IF EXISTS "Authenticated users can view branches" ON public.branches;
DROP POLICY IF EXISTS "Authenticated users can insert branches" ON public.branches;
DROP POLICY IF EXISTS "Authenticated users can update branches" ON public.branches;

CREATE POLICY "Sync access for authenticated users" ON public.branches
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Asegurar acceso total en tabla de Camiones
DROP POLICY IF EXISTS "Authenticated users full access" ON public.trucks;
CREATE POLICY "Sync access for authenticated users" ON public.trucks
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Asegurar acceso total en tabla de Choferes
DROP POLICY IF EXISTS "Authenticated users full access" ON public.drivers;
CREATE POLICY "Sync access for authenticated users" ON public.drivers
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. Asegurar acceso total en tabla de Programaciones
DROP POLICY IF EXISTS "Authenticated users full access" ON public.schedules;
CREATE POLICY "Sync access for authenticated users" ON public.schedules
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- NOTA: Estos cambios permiten que cualquier usuario logueado pueda crear/editar estos registros,
-- lo cual es necesario para la sincronización offline-first cuando los datos se crean localmente.
