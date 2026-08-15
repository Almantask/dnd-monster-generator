import type { ReactNode } from 'react'
import { cn } from '@/lib/utils.ts'
import { DiceMarker } from './DiceMarker.tsx'

export function DiceHotButton({
  children,
  onClick,
  className,
}: {
  children: ReactNode
  onClick: () => void
  className?: string
}) {
  return (
    <button type="button" className={cn('dice-hot', className)} onClick={onClick}>
      {children}
      <DiceMarker />
    </button>
  )
}
