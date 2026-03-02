import { PatioKanban } from '@/components/patio/PatioKanban'

export default function PatioPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Control de Patio</h1>
      <PatioKanban />
    </div>
  )
}
