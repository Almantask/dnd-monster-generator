// gemini-2.5-flash and gemini-2.0-flash return 404 ("no longer available") for new AI Studio keys.
export const GEMINI_STATBLOCK_MODELS = [
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
] as const

export const OPENROUTER_STATBLOCK_MODELS = [
  'openrouter/free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'nvidia/nemotron-3.5-lightning:free',
  'openai/gpt-oss-20b:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'liquid/lfm-2.5-2.6b:free',
] as const

/** Kept for backward compatibility */
export const STATBLOCK_MODELS = OPENROUTER_STATBLOCK_MODELS

/** Native Gemini image models (`:generateContent`). All require a billed AI Studio project. */
export const GEMINI_IMAGE_MODELS = [
  'gemini-3.1-flash-image',
  'gemini-2.5-flash-image',
  'gemini-3-pro-image',
] as const

/** Imagen models (`:predict`). Paid tier only; not listed at all for free-tier keys. */
export const IMAGEN_MODELS = [
  'imagen-4.0-generate-001',
  'imagen-4.0-fast-generate-001',
] as const

/**
 * Cloudflare Workers AI models, all drawing on the free 10,000 neurons/day allocation.
 * klein 4B takes width/height (portrait 768x1024, ~78 neurons); schnell is square-only (~58 neurons).
 */
export const CLOUDFLARE_IMAGE_MODELS = [
  '@cf/black-forest-labs/flux-2-klein-4b',
  '@cf/black-forest-labs/flux-1-schnell',
] as const

export const IMAGE_PROVIDERS = ['imagen', 'gemini', 'cloudflare', 'pollinations'] as const
