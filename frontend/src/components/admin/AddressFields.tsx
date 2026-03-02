import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AddressFieldsProps {
  region: string
  onRegionChange: (val: string) => void
  comuna: string
  onComunaChange: (val: string) => void
  street: string
  onStreetChange: (val: string) => void
  streetNumber: string
  onStreetNumberChange: (val: string) => void
  addressNotes: string
  onAddressNotesChange: (val: string) => void
}

export function AddressFields({
  region,
  onRegionChange,
  comuna,
  onComunaChange,
  street,
  onStreetChange,
  streetNumber,
  onStreetNumberChange,
  addressNotes,
  onAddressNotesChange,
}: AddressFieldsProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-muted-foreground border-b pb-1">Direccion</h4>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Region</Label>
          <Input
            value={region}
            onChange={(e) => onRegionChange(e.target.value)}
            placeholder="Ej: Region Metropolitana"
          />
        </div>
        <div>
          <Label>Comuna</Label>
          <Input
            value={comuna}
            onChange={(e) => onComunaChange(e.target.value)}
            placeholder="Ej: Santiago"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Calle</Label>
          <Input
            value={street}
            onChange={(e) => onStreetChange(e.target.value)}
            placeholder="Ej: Av. Libertador"
          />
        </div>
        <div>
          <Label>Numero</Label>
          <Input
            value={streetNumber}
            onChange={(e) => onStreetNumberChange(e.target.value)}
            placeholder="Ej: 1234"
          />
        </div>
      </div>
      <div>
        <Label>Notas de Direccion</Label>
        <Input
          value={addressNotes}
          onChange={(e) => onAddressNotesChange(e.target.value)}
          placeholder="Ej: Galpón 3, Bodega Norte"
        />
      </div>
    </div>
  )
}
