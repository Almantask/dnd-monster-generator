import { Dices } from 'lucide-react'

export function DiceMarker() {
  return (
    <span data-dice-marker="" className="ml-0.5 inline-flex align-[-0.125em]" aria-hidden="true">
      <Dices className="size-[0.85em] text-oxblood/75" strokeWidth={2.25} />
    </span>
  )
}
