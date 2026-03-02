import { useState, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'

const COUNTRIES = [
  { code: 'CL', dialCode: '+56', label: 'Chile (+56)', digits: 9 },
  { code: 'AR', dialCode: '+54', label: 'Argentina (+54)', digits: 10 },
  { code: 'PE', dialCode: '+51', label: 'Peru (+51)', digits: 9 },
  { code: 'BO', dialCode: '+591', label: 'Bolivia (+591)', digits: 8 },
  { code: 'BR', dialCode: '+55', label: 'Brasil (+55)', digits: 11 },
  { code: 'CO', dialCode: '+57', label: 'Colombia (+57)', digits: 10 },
  { code: 'US', dialCode: '+1', label: 'EE.UU. (+1)', digits: 10 },
]

function parseValue(value: string): { dialCode: string; local: string } {
  if (!value) return { dialCode: '+56', local: '' }
  for (const c of COUNTRIES) {
    if (value.startsWith(c.dialCode)) {
      return { dialCode: c.dialCode, local: value.slice(c.dialCode.length).trim() }
    }
  }
  return { dialCode: '+56', local: value }
}

interface PhoneInputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}

export function PhoneInput({ value, onChange, placeholder }: PhoneInputProps) {
  const parsed = parseValue(value)
  const [dialCode, setDialCode] = useState(parsed.dialCode)
  const [local, setLocal] = useState(parsed.local)

  useEffect(() => {
    const p = parseValue(value)
    setDialCode(p.dialCode)
    setLocal(p.local)
  }, [value])

  function handleDialChange(newDial: string) {
    setDialCode(newDial)
    onChange(local ? `${newDial}${local}` : '')
  }

  function handleLocalChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, '')
    setLocal(digits)
    onChange(digits ? `${dialCode}${digits}` : '')
  }

  const country = COUNTRIES.find((c) => c.dialCode === dialCode) ?? COUNTRIES[0]
  const ph = placeholder ?? `${country.digits} dígitos`

  return (
    <div className="flex gap-2">
      <Select value={dialCode} onValueChange={handleDialChange}>
        <SelectTrigger className="w-36 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COUNTRIES.map((c) => (
            <SelectItem key={c.code} value={c.dialCode}>{c.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={local}
        onChange={handleLocalChange}
        placeholder={ph}
        inputMode="numeric"
        className="flex-1"
      />
    </div>
  )
}
