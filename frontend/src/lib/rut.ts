/**
 * Utilidades para validar y formatear RUT chileno.
 * Formato esperado: 00.000.000-0 (con puntos y guion)
 */

/** Elimina puntos, guiones y espacios del RUT */
export function cleanRut(rut: string): string {
  return rut.replace(/[\s.\-]/g, '').toUpperCase()
}

/** Formatea un RUT limpio a formato 00.000.000-0 */
export function formatRut(rut: string): string {
  const clean = cleanRut(rut)
  if (clean.length < 2) return rut

  const dv = clean.slice(-1)
  const body = clean.slice(0, -1)

  // Agregar puntos cada 3 digitos de derecha a izquierda
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  return `${formatted}-${dv}`
}

/**
 * Valida un RUT chileno usando algoritmo Modulo 11.
 * Acepta cualquier formato (con o sin puntos/guion).
 */
export function validateRut(rut: string): boolean {
  const clean = cleanRut(rut)
  if (clean.length < 2) return false

  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)

  // El cuerpo debe ser solo digitos
  if (!/^\d+$/.test(body)) return false
  // El DV debe ser digito o K
  if (!/^[\dK]$/.test(dv)) return false

  // Algoritmo Modulo 11
  let sum = 0
  let multiplier = 2

  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier
    multiplier = multiplier === 7 ? 2 : multiplier + 1
  }

  const remainder = 11 - (sum % 11)
  let expectedDv: string

  if (remainder === 11) expectedDv = '0'
  else if (remainder === 10) expectedDv = 'K'
  else expectedDv = String(remainder)

  return dv === expectedDv
}
