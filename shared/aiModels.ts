export const GEMINI_STATBLOCK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
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

export const IMAGEN_MODELS = [
  'imagen-4.0-generate-preview',
  'imagen-3.0-generate-002',
  'imagen-3.0-generate-001',
] as const

export const IMAGE_PROVIDERS = ['imagen', 'gemini', 'pollinations', 'huggingface'] as const


