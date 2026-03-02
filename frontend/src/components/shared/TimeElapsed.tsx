import { useState, useEffect } from 'react'
import { differenceInMinutes, differenceInHours } from 'date-fns'

export function TimeElapsed({ since }: { since: string | null }) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000)
    return () => clearInterval(interval)
  }, [])

  if (!since) return null

  const now = new Date()
  const start = new Date(since)
  const hours = differenceInHours(now, start)
  const minutes = differenceInMinutes(now, start) % 60

  const isLong = hours >= 2

  return (
    <span className={`text-xs font-mono ${isLong ? 'text-destructive font-bold' : 'text-muted-foreground'}`}>
      {hours > 0 ? `${hours}h ` : ''}{minutes}m
    </span>
  )
}
