import { useEffect, useRef } from 'react'
import { useDiceRoll } from 'react-ttrpg-dice'
import type { PhysicsGroup, PhysicsSettleResult } from '@shared/physicalDice.ts'

const CHECK_THEME = {
  theme: 'crimson' as const,
  dieColor: '#822000',
  numberColor: '#fdf1dc',
  accentColor: '#5c0000',
}

const DAMAGE_THEME = {
  theme: 'ivory' as const,
  dieColor: '#fdf1dc',
  numberColor: '#822000',
  accentColor: '#922610',
}

export function DicePhysics({
  groups,
  onComplete,
}: {
  groups: PhysicsGroup[]
  onComplete: (result: PhysicsSettleResult) => void
}) {
  const launched = useRef(false)
  const { rollGroups, DiceOverlayPortal } = useDiceRoll({
    config: DAMAGE_THEME,
    sound: { volume: 0.35 },
    cameraAngle: { x: 2, z: 3 },
    zIndex: 81,
    onRollComplete: onComplete,
  })

  useEffect(() => {
    if (launched.current || groups.length === 0) return
    launched.current = true
    rollGroups(
      groups.map((group) => ({
        notation: group.notation,
        label: group.label,
        config: group.kind === 'check' ? CHECK_THEME : DAMAGE_THEME,
      })),
    )
  }, [groups, rollGroups])

  return <>{DiceOverlayPortal}</>
}
