/** Rewrites react-ttrpg-dice so rolls toss sideways with spin instead of dropping. */
export function patchTtrpgDiceThrow(code: string): string {
  if (code.includes('_throwAim')) return code

  let next = code.replace(
    `function calculateThrowImpulse(mass) {
    const s = mass * 2; // reduced from ×3 — keeps velocity within CCD safe range
    const rand = ()=>(Math.random() - 0.5) * 12;
    return {
        linear: [
            (Math.random() - 0.5) * s * 0.3,
            -s * 1.2,
            (Math.random() - 0.5) * s * 0.3
        ],
        angular: [
            rand(),
            rand(),
            rand()
        ]
    };
}`,
    `var _throwAim = { x: 1, z: 0 };
function calculateThrowImpulse(mass) {
    const lateral = (9 + Math.random() * 8) * mass;
    const spread = (n) => (Math.random() - 0.5) * n * mass;
    const spin = () => (Math.random() - 0.5) * 34;
    return {
        linear: [
            _throwAim.x * lateral + spread(6),
            (2 + Math.random() * 5) * mass,
            _throwAim.z * lateral + spread(6)
        ],
        angular: [
            spin(),
            spin(),
            spin()
        ]
    };
}`,
  )

  next = next.replace(
    `function calculateSpawnPositions(count, worldHalfX) {
    const cols = Math.ceil(Math.sqrt(count));
    const spacing = Math.min(2.0, worldHalfX * 1.6 / Math.max(cols, 1));
    const halfW = (cols - 1) * spacing / 2;
    const jit = ()=>(Math.random() - 0.5) * 0.3;
    return Array.from({
        length: count
    }, (_, i)=>({
            position: [
                i % cols * spacing - halfW + jit(),
                8 + Math.floor(i / cols) * 0.6 + Math.random() * 1.5,
                jit()
            ],
            rotation: [
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            ]
        }));
}`,
    `function calculateSpawnPositions(count, worldHalfX) {
    const cols = Math.ceil(Math.sqrt(count));
    const spacing = Math.min(1.35, worldHalfX * 1.2 / Math.max(cols, 1));
    const halfW = (cols - 1) * spacing / 2;
    const jit = () => (Math.random() - 0.5) * 0.55;
    const angle = Math.random() * Math.PI * 2;
    _throwAim = { x: Math.cos(angle), z: Math.sin(angle) };
    const reach = Math.max(worldHalfX * 0.72, 2.8);
    const originX = -_throwAim.x * reach;
    const originZ = -_throwAim.z * reach * 0.65;
    return Array.from({
        length: count
    }, (_, i)=>({
            position: [
                originX + i % cols * spacing - halfW + jit(),
                1.6 + Math.random() * 2.4 + Math.floor(i / cols) * 0.4,
                originZ + Math.floor(i / cols) * spacing + jit()
            ],
            rotation: [
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            ]
        }));
}`,
  )

  next = next.replace('const MAX_LIN_SPEED = 7.0;', 'const MAX_LIN_SPEED = 14.0;')
  next = next.replace('const MAX_ANG_SPEED = 18.0;', 'const MAX_ANG_SPEED = 30.0;')
  return next
}
