import AppError from '../utils/AppError.js';

export const AI_DIRECTNESS_OPTIONS = ['soft', 'balanced', 'straight'];
export const AI_VERBOSITY_OPTIONS = ['short', 'medium', 'detailed'];
export const AI_PERSONA_TEXT_KEYS = ['role', 'persona', 'tone', 'customInstruction'];
export const AI_PERSONA_ENUM_KEYS = ['directness', 'verbosity'];

export const AI_PERSONA_TEXT_LIMITS = {
  role: 16,
  persona: 120,
  tone: 80,
  customInstruction: 120,
};

export const DEFAULT_AI_PERSONA = {
  role: '',
  persona: '',
  tone: '',
  directness: 'balanced',
  verbosity: 'medium',
  customInstruction: '',
};

export const AI_PERSONA_KEYS = Object.keys(DEFAULT_AI_PERSONA);

export const aiPersonaFieldDefinitions = {
  role: {
    type: String,
    trim: true,
    maxlength: [AI_PERSONA_TEXT_LIMITS.role, `角色最多 ${AI_PERSONA_TEXT_LIMITS.role} 个字符`],
  },
  persona: {
    type: String,
    trim: true,
    maxlength: [AI_PERSONA_TEXT_LIMITS.persona, `人设最多 ${AI_PERSONA_TEXT_LIMITS.persona} 个字符`],
  },
  tone: {
    type: String,
    trim: true,
    maxlength: [AI_PERSONA_TEXT_LIMITS.tone, `语气最多 ${AI_PERSONA_TEXT_LIMITS.tone} 个字符`],
  },
  directness: {
    type: String,
    enum: AI_DIRECTNESS_OPTIONS,
  },
  verbosity: {
    type: String,
    enum: AI_VERBOSITY_OPTIONS,
  },
  customInstruction: {
    type: String,
    trim: true,
    maxlength: [AI_PERSONA_TEXT_LIMITS.customInstruction, `额外要求最多 ${AI_PERSONA_TEXT_LIMITS.customInstruction} 个字符`],
  },
};

function normalizeOptionalText(value, field, label, preserveEmpty = false) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new AppError(`${label}格式无效`, 400, 'INVALID_AI_PERSONA');
  }

  const sanitized = value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (!sanitized) {
    return preserveEmpty ? '' : undefined;
  }

  if (sanitized.length > AI_PERSONA_TEXT_LIMITS[field]) {
    throw new AppError(`${label}最多 ${AI_PERSONA_TEXT_LIMITS[field]} 个字符`, 400, 'INVALID_AI_PERSONA');
  }

  return sanitized;
}

function normalizeEnum(value, options, label, preserveEmpty = false) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (value === '') {
    return preserveEmpty ? '' : undefined;
  }

  if (typeof value !== 'string' || !options.includes(value)) {
    throw new AppError(`${label}无效`, 400, 'INVALID_AI_PERSONA');
  }

  return value;
}

export function sanitizePersonaInput(input = {}, options = {}) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new AppError('AI persona 配置格式无效', 400, 'INVALID_AI_PERSONA');
  }

  const {
    preserveEmptyText = false,
    preserveEmptyEnum = false,
  } = options;

  return {
    role: normalizeOptionalText(input.role, 'role', '角色', preserveEmptyText),
    persona: normalizeOptionalText(input.persona, 'persona', '人设', preserveEmptyText),
    tone: normalizeOptionalText(input.tone, 'tone', '语气', preserveEmptyText),
    directness: normalizeEnum(input.directness, AI_DIRECTNESS_OPTIONS, '直接程度', preserveEmptyEnum),
    verbosity: normalizeEnum(input.verbosity, AI_VERBOSITY_OPTIONS, '回复长度', preserveEmptyEnum),
    customInstruction: normalizeOptionalText(input.customInstruction, 'customInstruction', '额外要求', preserveEmptyText),
  };
}

export function compactPersona(persona = {}, options = {}) {
  const { preserveEmptyText = false } = options;

  return AI_PERSONA_KEYS.reduce((result, key) => {
    const value = persona[key];
    if (value === undefined || value === null) {
      return result;
    }

    if (value === '') {
      if (preserveEmptyText && AI_PERSONA_TEXT_KEYS.includes(key)) {
        result[key] = value;
      }
      return result;
    }

    if (value !== '') {
      result[key] = value;
    }
    return result;
  }, {});
}

export function resolvePersonaConfig(...layers) {
  const merged = { ...DEFAULT_AI_PERSONA };

  for (const layer of layers) {
    if (!layer || typeof layer !== 'object') {
      continue;
    }

    for (const key of AI_PERSONA_KEYS) {
      const value = layer[key];
      if (value === undefined || value === null) {
        continue;
      }

      if (value === '') {
        if (AI_PERSONA_TEXT_KEYS.includes(key)) {
          merged[key] = value;
        }
        continue;
      }

      merged[key] = value;
    }
  }

  return merged;
}

export function diffPersonaConfig(target = {}, base = DEFAULT_AI_PERSONA) {
  return AI_PERSONA_KEYS.reduce((result, key) => {
    if (target[key] !== undefined && target[key] !== base[key]) {
      result[key] = target[key];
    }
    return result;
  }, {});
}
