import { createHash } from 'node:crypto'

/**
 * Build-time tuning for react-ttrpg-dice.
 *
 * The library ships only a dist bundle and exposes no knobs for its throw,
 * renderer or lighting, so we rewrite those pieces as the module is loaded.
 * Every edit below is asserted — if an upgrade moves the code out from under a
 * replacement the build fails loudly instead of silently reverting to stock.
 */

type Edit = {
  /** Shown in the error when the edit no longer matches. */
  readonly name: string
  readonly find: string | RegExp
  readonly replace: string
}

/**
 * Dice are ~1.3 world units across but read as objects a couple of centimetres
 * wide, and real gravity at that scale looks like a slow-motion moon landing.
 * Roughly 3.3× gravity puts the arc, bounce cadence and settle time where a
 * thrown die actually lands — it also keeps the toss inside the tray instead of
 * sailing into the far wall.
 */
const GRAVITY = 32

const THROW_EDITS: Edit[] = [
  {
    name: 'calculateThrowVelocity',
    find: `function calculateThrowImpulse(mass) {
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
    replace: `function calculateThrowVelocity(spawnPosition) {
    // Returns velocities that are set on the body directly.  The stock throw
    // applied impulses scaled by the registry's mass (0.8–2.0), but the bodies
    // take their real mass from collider volume (0.2–0.9) — react-three-rapier
    // drops the mass prop — so every die left 2–3× faster than intended, the
    // small ones fastest.  A velocity is exact whatever the mass.
    //
    // Linear: toss each die from where it spawned toward the middle of the tray,
    // fanned a little sideways.  The aim comes from the spawn point rather than
    // shared state because React runs memos twice under StrictMode and keeps the
    // first result — an aim set as a side effect of the spawn memo ends up
    // pointing somewhere the dice were never laid out for.
    const x = spawnPosition?.[0] ?? 0;
    const z = spawnPosition?.[2] ?? 0;
    const distance = Math.hypot(x, z);
    const heading = distance > 0.01 ? Math.atan2(-z, -x) : Math.random() * Math.PI * 2;
    const aimX = Math.cos(heading);
    const aimZ = Math.sin(heading);
    // Speed scales with how far the die has to travel, so it lands short of the
    // centre and rolls in whatever the tray's size or aspect ratio.
    const lateral = Math.max(distance, 2.4) * (1.0 + Math.random() * 0.4);
    const lift = 1.4 + Math.random() * 2.2;
    const side = (Math.random() - 0.5) * 2;
    // Angular: a random tumble axis biased toward the horizontal — a die
    // spinning about its vertical axis reads as a spinning top, not a throw.
    // Kept moderate: on landing, friction turns spin into roll in whatever
    // direction the axis points, and once a die's surface outruns the throw
    // itself it gets flung into a random far corner.
    const axisY = (Math.random() - 0.5) * 1.1;
    const axisR = Math.sqrt(1 - axisY * axisY);
    const azimuth = Math.random() * Math.PI * 2;
    const spin = 6 + Math.random() * 6;
    return {
        linear: [
            aimX * lateral - aimZ * side,
            lift,
            aimZ * lateral + aimX * side
        ],
        angular: [
            spin * axisR * Math.cos(azimuth),
            spin * axisY,
            spin * axisR * Math.sin(azimuth)
        ]
    };
}`,
  },
  {
    name: 'throw velocity call site',
    find: `    const impulse = useMemo(()=>calculateThrowImpulse(definition.physics.mass), [
        definition.physics.mass
    ]);`,
    replace: `    const throwVelocity = useMemo(()=>calculateThrowVelocity(spawnPosition), [
        spawnPosition
    ]);`,
  },
  {
    name: 'throw velocity applied',
    find: `                rb.applyImpulse({
                    x: impulse.linear[0],
                    y: impulse.linear[1],
                    z: impulse.linear[2]
                }, true);
                rb.applyTorqueImpulse({
                    x: impulse.angular[0],
                    y: impulse.angular[1],
                    z: impulse.angular[2]
                }, true);`,
    replace: `                rb.setLinvel({
                    x: throwVelocity.linear[0],
                    y: throwVelocity.linear[1],
                    z: throwVelocity.linear[2]
                }, true);
                rb.setAngvel({
                    x: throwVelocity.angular[0],
                    y: throwVelocity.angular[1],
                    z: throwVelocity.angular[2]
                }, true);`,
  },
  {
    name: 'calculateSpawnPositions',
    find: `function calculateSpawnPositions(count, worldHalfX) {
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
    replace: `function calculateSpawnPositions(count, worldHalfX, worldHalfZ) {
    // The handful starts together, low, on one randomly chosen side of the tray.
    const angle = Math.random() * Math.PI * 2;
    const outX = Math.cos(angle);
    const outZ = Math.sin(angle);
    // Unit vector across the throw — the handful is laid out along this.
    const acrossX = -outZ;
    const acrossZ = outX;
    const halfZ = worldHalfZ ?? worldHalfX;
    const cols = Math.ceil(Math.sqrt(count));
    // At least 0.8 apart (a d6 is 0.6 across) even when a phone squeezes the tray.
    const spacing = Math.max(0.8, Math.min(1.25, Math.min(worldHalfX, halfZ) * 1.1 / Math.max(cols, 1)));
    const halfW = (cols - 1) * spacing / 2;
    // Start on the ellipse inscribed in the tray, so the origin is inside both
    // pairs of walls whatever the viewport's aspect ratio.
    const reachX = Math.max(worldHalfX * 0.6, 1.8);
    const reachZ = Math.max(halfZ * 0.6, 1.8);
    const jit = ()=>(Math.random() - 0.5) * spacing * 0.2;
    const layout = Array.from({
        length: count
    }, (_, i)=>{
        const row = Math.floor(i / cols);
        const across = i % cols * spacing - halfW + jit();
        const back = row * spacing * 1.2;
        return {
            row,
            x: outX * (reachX + back) + acrossX * across,
            z: outZ * (reachZ + back) + acrossZ * across
        };
    });
    // Keep every die a die-width clear of the walls — a hull spawned overlapping
    // a wall collider is ejected violently or trapped behind it.  Slide the
    // whole handful rather than clamping dice one by one: clamping squashed the
    // back rows onto one line, and overlapping hulls burst apart on the first
    // physics step hard enough to fling the lot into the far wall.
    const fit = (values, halfExtent)=>{
        const limit = Math.max(halfExtent - 0.8, 0.4);
        const lo = Math.min(...values);
        const hi = Math.max(...values);
        if (hi - lo > 2 * limit) return -(lo + hi) / 2;
        return hi > limit ? limit - hi : lo < -limit ? -limit - lo : 0;
    };
    const shiftX = fit(layout.map((d)=>d.x), worldHalfX);
    const shiftZ = fit(layout.map((d)=>d.z), halfZ);
    return layout.map((d)=>({
            position: [
                d.x + shiftX,
                2.0 + d.row * 0.35 + Math.random() * 1.6,
                d.z + shiftZ
            ],
            rotation: [
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            ]
        }));
}`,
  },
  {
    name: 'calculateSpawnPositions call site',
    find: 'calculateSpawnPositions(expandedDice.length, halfX)',
    replace: 'calculateSpawnPositions(expandedDice.length, halfX, halfZ)',
  },
  {
    // Walls sit a little inside the viewport so a die resting against one is
    // never cut off by the screen edge (the camera's tilt and the height scale
    // both push a die's silhouette slightly past its collider).
    name: 'tray walls inset from the viewport',
    find: `    const halfX = size.width / (2 * (cam.zoom || 60));
    const halfZ = size.height / (2 * (cam.zoom || 60));`,
    replace: `    const halfX = size.width / (2 * (cam.zoom || 60)) - 0.6;
    const halfZ = size.height / (2 * (cam.zoom || 60)) - 0.6;`,
  },
]

const PHYSICS_EDITS: Edit[] = [
  {
    name: 'world gravity and timestep',
    find: `            /*#__PURE__*/ jsxs(Physics, {
                gravity: [
                    0,
                    -9.81,
                    0
                ],
                children: [`,
    replace: `            /*#__PURE__*/ jsxs(Physics, {
                gravity: [
                    0,
                    -${GRAVITY},
                    0
                ],
                timeStep: 1 / 120,
                children: [`,
  },
  {
    name: 'tray floor material',
    find: `                        friction: 0.6,
                        restitution: 0.25`,
    replace: `                        friction: 0.85,
                        restitution: 0.32`,
  },
  // Peak impact speed under the tuned throw is ≈18 u/s, so 22 leaves the arc
  // untouched while still guarding against tunnelling (0.18 u per 1/120s step
  // against 1.5-unit-thick walls).
  { name: 'MAX_LIN_SPEED', find: /const MAX_LIN_SPEED = [\d.]+;/, replace: 'const MAX_LIN_SPEED = 22.0;' },
  // The throw aims for 16–30 rad/s; a 34 cap catches collision spikes without
  // flattening every die to the same spin rate.
  { name: 'MAX_ANG_SPEED', find: /const MAX_ANG_SPEED = [\d.]+;/, replace: 'const MAX_ANG_SPEED = 34.0;' },
  // Dice now come to rest in ~1.5s, so the damping ramp and the still-polling
  // fallback both start (and finish) far earlier than the stock 3.5s schedule.
  { name: 'DAMP_GRACE_S', find: /const DAMP_GRACE_S = [\d.]+;/, replace: 'const DAMP_GRACE_S = 1.0;' },
  { name: 'DAMP_RAMP_S', find: /const DAMP_RAMP_S = [\d.]+;/, replace: 'const DAMP_RAMP_S = 1.8;' },
  { name: 'BASE_DAMP', find: /const BASE_DAMP = [\d.]+;/, replace: 'const BASE_DAMP = 0.25;' },
  { name: 'EXTRA_DAMP', find: /const EXTRA_DAMP = [\d.]+;/, replace: 'const EXTRA_DAMP = 6.0;' },
  // The stock still-check counts frames, so the result arrived twice as late on
  // a 60Hz screen as on a 120Hz one. Seconds make it the same everywhere.
  // Rapier's own sleep needs ~2s of rest, so in practice this check is what
  // ends a throw: three still samples 0.12s apart, from 0.9s on.
  {
    name: 'GRACE_FRAMES',
    find: /\/\*\*[^*]*\*\/ const GRACE_FRAMES = \d+;/,
    replace: '/** Seconds before still-polling starts */ const SETTLE_GRACE_S = 0.9;',
  },
  {
    name: 'SAMPLE_EVERY',
    find: /\/\*\*[^*]*\*\/ const SAMPLE_EVERY = \d+;/,
    replace: '/** Seconds between still samples */ const SAMPLE_INTERVAL_S = 0.12;',
  },
  {
    name: 'time-based still sampling',
    find: `        if (frameCount.current < GRACE_FRAMES) return;
        if (frameCount.current % SAMPLE_EVERY !== 0) return;`,
    replace: `        if (elapsedTime.current < SETTLE_GRACE_S) return;
        if (elapsedTime.current - lastSample.current < SAMPLE_INTERVAL_S) return;
        lastSample.current = elapsedTime.current;`,
  },
  {
    // A cocked die is nudged to knock it flat.  Stock applied this as an
    // impulse, so with real masses of 0.2–0.9 a d6 hopped ten times higher than
    // a d20.  As a velocity every die hops the same ~0.12 units under the tuned
    // gravity — enough to fall off an edge, not enough to re-roll.
    name: 'cocked-die nudge',
    find: `const NUDGE = {
    x: 0,
    y: 0.5,
    z: 0.15
};`,
    replace: `const NUDGE = {
    x: 0.4,
    y: 2.8,
    z: 0.4
};`,
  },
  {
    name: 'cocked-die nudge applied',
    find: 'rb.applyImpulse(NUDGE, true);',
    replace: 'rb.setLinvel(NUDGE, true);',
  },
  {
    // Stock: when everything looked still it read every die and completed —
    // but a die cocked against another is nudged rather than read, so it was
    // silently left out of the result (a 20d6 throw that piled up in a corner
    // came back with 15 dice).  Wait for nudged dice to land again instead;
    // after MAX_NUDGE_TRIES the library commits its best reading anyway.
    name: 'still-check waits for cocked dice',
    find: `        // Confirmed still for STILL_REQUIRED consecutive samples → read & fire
        for (const [id, rb] of rbMap.current){
            resolveDie(id, rb);
        }`,
    replace: `        // Confirmed still for STILL_REQUIRED consecutive samples → read & fire
        for (const [id, rb] of rbMap.current){
            resolveDie(id, rb);
        }
        if (settledIds.current.size < expandedDice.length) {
            stillCount.current = 0;
            return;
        }`,
  },
  {
    // The hard timeout can still land while a die is unread (rocking, or
    // cocked on its last nudge).  Read it where it lies rather than dropping it.
    name: 'timeout reads unresolved dice',
    find: `    const fireComplete = useCallback(()=>{
        if (completed.current) return;
        completed.current = true;
        let result;`,
    replace: `    const fireComplete = useCallback(()=>{
        if (completed.current) return;
        completed.current = true;
        if (!isPredetermined) {
            for (const die of expandedDice){
                if (resolvedValues.current.has(die.id)) continue;
                const rb = rbMap.current.get(die.id);
                if (!rb) continue;
                const reading = readDieResult(rb, registry.get(die.registryId), geoNormals.get(die.registryId));
                resolvedValues.current.set(die.id, reading.value);
            }
        }
        let result;`,
  },
  {
    name: 'per-frame refs',
    find: `    const frameCount = useRef(0);
    const elapsedTime = useRef(0);
    const stillCount = useRef(0);`,
    replace: `    const frameCount = useRef(0);
    const elapsedTime = useRef(0);
    const stillCount = useRef(0);
    const lastDamp = useRef(-1);
    const lastSample = useRef(0);`,
  },
  {
    name: 'per-frame speed cap and damping loop',
    find: `        // ── 1. Speed cap + progressive damping (every frame, all bodies) ─────────
        for (const [, rb] of rbMap.current){`,
    replace: `        // ── 1. Speed cap + progressive damping (every frame, awake bodies) ──────
        // Damping is identical for every body, so derive it once per frame and
        // write it only when it has actually moved — each setter is a call across
        // the WASM boundary, and at 20 dice that is 40 crossings a frame.
        let linDamp = -1;
        let angDamp = -1;
        if (elapsedTime.current > DAMP_GRACE_S) {
            const t = Math.min((elapsedTime.current - DAMP_GRACE_S) / DAMP_RAMP_S, 1.0);
            linDamp = Math.round((BASE_DAMP + t * EXTRA_DAMP) * 4) / 4;
            angDamp = Math.round((BASE_DAMP + t * EXTRA_DAMP * 1.5) * 4) / 4; // spin stops faster than slide
        }
        const dampChanged = linDamp >= 0 && linDamp !== lastDamp.current;
        if (dampChanged) lastDamp.current = linDamp;
        for (const [, rb] of rbMap.current){
            // A sleeping die is done — touching it only costs round-trips.
            if (rb.isSleeping()) continue;`,
  },
  {
    name: 'progressive damping write',
    find: `            // --- Progressive damping ---
            // After DAMP_GRACE_S the physical simulation has let dice tumble freely.
            // Ramping damping up from there forces them to stop definitively,
            // preventing endless slow creep that would block result detection.
            if (elapsedTime.current > DAMP_GRACE_S) {
                const t = Math.min((elapsedTime.current - DAMP_GRACE_S) / DAMP_RAMP_S, 1.0);
                const linDamp = BASE_DAMP + t * EXTRA_DAMP;
                const angDamp = BASE_DAMP + t * EXTRA_DAMP * 1.5; // spin stops faster than slide
                rb.setLinearDamping(linDamp);
                rb.setAngularDamping(angDamp);
            }`,
    replace: `            // --- Progressive damping ---
            if (dampChanged) {
                rb.setLinearDamping(linDamp);
                rb.setAngularDamping(angDamp);
            }`,
  },
]

const RENDER_EDITS: Edit[] = [
  {
    // Every throw mounts a fresh WebGL context, so the face textures are uploaded
    // again on each one.  Supersampling the 512px artwork down to 256 once gives
    // crisper numbers than drawing at 256, stays above the ~150 device px a face
    // covers on screen, and cuts texture memory 4× — the stock cache held ~100MB
    // of face maps across two themes and never frees them.
    //
    // Both canvases stay GPU-backed so the per-throw upload is a GPU-side copy,
    // and the texture stays plain RGBA8 for the same reason; see 'sRGB face
    // decode' below.  (CPU-backed pixels or an sRGB format each measured
    // 80–500ms of extra stall at the start of every throw on Chrome/D3D11.)
    name: 'face texture upload',
    find: `function tex(canvas) {
    const t = new THREE.CanvasTexture(canvas);
    t.needsUpdate = true;
    return t;
}`,
    replace: `const TEX_SIZE = 256;
function tex(canvas) {
    const small = document.createElement('canvas');
    small.width = TEX_SIZE;
    small.height = TEX_SIZE;
    const ctx = small.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, TEX_SIZE, TEX_SIZE);
    const t = new THREE.CanvasTexture(small);
    t.anisotropy = 8; // clamped to the device maximum on upload
    t.needsUpdate = true;
    return t;
}`,
  },
  {
    // The canvas artwork is sRGB, but the stock materials sampled it as linear,
    // so every die rendered washed out.  Tagging the textures SRGBColorSpace is
    // the textbook fix, but on Chrome/D3D11 uploading into the sRGB format takes
    // a slow path that added a visible stall to every throw.  three.js already
    // ships an inline shader decode for exactly this (it uses it for video), so
    // switch that on and keep the fast RGBA8 upload.
    name: 'sRGB face decode',
    find: `    if (opts.theme.isGlass) {
        return new THREE.MeshPhysicalMaterial({
            ...base,
            color: '#c8e0ff',
            transmission: opts.theme.transmission ?? 0.88,
            ior: opts.theme.ior ?? 1.5,
            thickness: 1.5,
            envMapIntensity: 2.0
        });
    }
    return new THREE.MeshStandardMaterial(base);
}`,
    replace: `    const material = opts.theme.isGlass ? new THREE.MeshPhysicalMaterial({
        ...base,
        color: '#c8e0ff',
        transmission: opts.theme.transmission ?? 0.88,
        ior: opts.theme.ior ?? 1.5,
        thickness: 1.5,
        envMapIntensity: 2.0
    }) : new THREE.MeshStandardMaterial(base);
    // Added after construction: passing \`defines\` would replace STANDARD.
    material.defines.DECODE_VIDEO_TEXTURE = '';
    material.defines.DECODE_VIDEO_TEXTURE_EMISSIVE = '';
    return material;
}`,
  },
  {
    // logarithmicDepthBuffer writes gl_FragDepth per fragment, which disables
    // early-Z for no benefit under an orthographic camera spanning 0.1–100.
    // Capping dpr keeps MSAA affordable on a full-viewport overlay.
    name: 'renderer configuration',
    find: `                    gl: {
                        alpha: true,
                        antialias: true,
                        logarithmicDepthBuffer: true
                    },`,
    replace: `                    dpr: [
                        1,
                        1.5
                    ],
                    gl: {
                        alpha: true,
                        antialias: true,
                        powerPreference: 'high-performance'
                    },`,
  },
  {
    name: 'tone mapping exposure',
    find: 'gl.toneMappingExposure = 1.0;',
    replace: 'gl.toneMappingExposure = 1.15;',
  },
  {
    // Zoom trades die size against tray size, so scaling it with the viewport
    // keeps dice chunky on a desktop without shrinking a phone's tray below what
    // a fistful of dice needs.
    name: 'camera zoom',
    find: `                        position: cameraPosition,
                        zoom: 60,`,
    replace: `                        position: cameraPosition,
                        zoom: Math.max(52, Math.min(78, (typeof window === 'undefined' ? 1280 : window.innerWidth) * 0.055)),`,
  },
  {
    // Stock lighting is mostly fill (hemisphere 1.2 + ambient 0.4), which flattens
    // faceted dice into featureless blobs. A dominant key with a cool rim and a
    // warm kicker gives every plate its own value — and drops a light doing it.
    name: 'scene lighting',
    find: `            /*#__PURE__*/ jsx("hemisphereLight", {
                args: [
                    '#c8d8ff',
                    '#4a3a20',
                    1.2
                ]
            }),
            /*#__PURE__*/ jsx("ambientLight", {
                intensity: 0.4
            }),
            /*#__PURE__*/ jsx("directionalLight", {
                position: [
                    5,
                    12,
                    3
                ],
                intensity: 2.0
            }),
            /*#__PURE__*/ jsx("pointLight", {
                position: [
                    -6,
                    8,
                    -5
                ],
                intensity: 0.8,
                color: "#c0a0ff"
            }),
            /*#__PURE__*/ jsx("pointLight", {
                position: [
                    6,
                    6,
                    5
                ],
                intensity: 0.5,
                color: "#ffeecc"
            }),`,
    replace: `            /*#__PURE__*/ jsx("hemisphereLight", {
                args: [
                    '#dfe7ff',
                    '#2a1d10',
                    0.55
                ]
            }),
            /*#__PURE__*/ jsx("directionalLight", {
                position: [
                    5,
                    12,
                    3
                ],
                intensity: 2.6
            }),
            /*#__PURE__*/ jsx("directionalLight", {
                position: [
                    -7,
                    6,
                    -6
                ],
                intensity: 0.75,
                color: "#9fb4ff"
            }),
            /*#__PURE__*/ jsx("pointLight", {
                position: [
                    0,
                    5,
                    7
                ],
                intensity: 0.45,
                color: "#ffd9a8"
            }),`,
  },
  // Numbers were glowing nearly as hard as the key light, which read as stickers
  // rather than ink. Halving it lets the (now correctly decoded) albedo show.
  {
    name: 'OPAQUE_EMISSIVE_INTENSITY',
    find: /const OPAQUE_EMISSIVE_INTENSITY = [\d.]+;/,
    replace: 'const OPAQUE_EMISSIVE_INTENSITY = 0.55;',
  },
  // A tight, dark contact shadow that thins out quickly as the die leaves the
  // table is what makes it read as resting on a surface, not floating above one.
  { name: 'BASE_RADIUS', find: /const BASE_RADIUS = [\d.]+;/, replace: 'const BASE_RADIUS = 0.5;' },
  { name: 'SPREAD_RATE', find: /const SPREAD_RATE = [\d.]+;/, replace: 'const SPREAD_RATE = 0.3;' },
  { name: 'MAX_OPACITY', find: /const MAX_OPACITY = [\d.]+;/, replace: 'const MAX_OPACITY = 0.5;' },
  // Dice are thrown from 2–4 units now, not 8. Under the stock 10-unit fade and
  // (1 − t²) curve a die in flight kept most of its shadow, and a fistful of
  // them smeared into one dark cloud. (1 − t)² drops off from the first bounce.
  { name: 'FADE_HEIGHT', find: /const FADE_HEIGHT = [\d.]+;/, replace: 'const FADE_HEIGHT = 5;' },
  {
    name: 'shadow falloff curve',
    find: 'material.opacity = MAX_OPACITY * (1 - t * t); // quadratic falloff',
    replace: 'material.opacity = MAX_OPACITY * (1 - t) * (1 - t);',
  },
  // The camera is top-down, so height reads almost entirely as scale.
  { name: 'SCALE_FACTOR', find: /const SCALE_FACTOR = [\d.]+;/, replace: 'const SCALE_FACTOR = 0.045;' },
]

export const DICE_PATCH_EDITS: readonly Edit[] = [...THROW_EDITS, ...PHYSICS_EDITS, ...RENDER_EDITS]

/**
 * Short content hash of the edits. Vite keys its dependency pre-bundle on
 * plugin names, not behaviour, so the plugin name carries this to invalidate a
 * stale pre-bundle whenever the tuning changes.
 */
export function dicePatchFingerprint(): string {
  const serialized = JSON.stringify(DICE_PATCH_EDITS, (_, value: unknown) =>
    value instanceof RegExp ? value.toString() : value,
  )
  return createHash('sha256').update(serialized).digest('hex').slice(0, 10)
}

/** Present only in patched output — makes the transform idempotent. */
const PATCH_MARKER = 'calculateThrowVelocity'

/**
 * Rewrites react-ttrpg-dice's throw, physics, renderer and lighting.
 * @throws if any edit no longer matches the library source.
 */
export function patchTtrpgDiceThrow(code: string): string {
  if (code.includes(PATCH_MARKER)) return code

  let next = code
  const stale: string[] = []
  for (const edit of DICE_PATCH_EDITS) {
    // A function replacer keeps `$` sequences in the replacement literal.
    const applied = next.replace(edit.find as RegExp, () => edit.replace)
    if (applied === next) stale.push(edit.name)
    next = applied
  }

  if (stale.length > 0) {
    throw new Error(
      `patchTtrpgDiceThrow: ${stale.length} edit(s) no longer match react-ttrpg-dice — ` +
        `re-derive them against the installed version: ${stale.join(', ')}`,
    )
  }

  return next
}
