import AIProfile from '../models/AIProfile.js';
import AISession from '../models/AISession.js';
import AppError from '../utils/AppError.js';
import {
  AI_PERSONA_KEYS,
  AI_PERSONA_TEXT_KEYS,
  compactPersona,
  resolvePersonaConfig,
  sanitizePersonaInput,
} from './aiPersonaConfig.js';

function toPlainPersona(persona, options = {}) {
  if (!persona) {
    return {};
  }

  if (typeof persona.toObject === 'function') {
    return compactPersona(persona.toObject(), options);
  }

  return compactPersona(persona, options);
}

function applySessionPersonaPatch(currentPersona = {}, personaPatch = {}, rawInput = {}) {
  const nextPersona = { ...currentPersona };

  for (const key of AI_PERSONA_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(rawInput, key)) {
      continue;
    }

    const value = personaPatch[key];

    if (value === undefined) {
      delete nextPersona[key];
      continue;
    }

    if (value === '') {
      if (AI_PERSONA_TEXT_KEYS.includes(key)) {
        nextPersona[key] = value;
      } else {
        delete nextPersona[key];
      }
      continue;
    }

    nextPersona[key] = value;
  }

  return nextPersona;
}

async function getOwnedSession(userId, sessionId) {
  const session = await AISession.findOne({ _id: sessionId, user: userId });
  if (!session) {
    throw new AppError('会话不存在', 404, 'SESSION_NOT_FOUND');
  }
  return session;
}

export async function getProfile(userId) {
  const profile = await AIProfile.findOne({ user: userId }).lean();
  const persona = compactPersona(profile?.persona || {});

  return {
    persona,
    effectivePersona: resolvePersonaConfig(persona),
  };
}

export async function updateProfile(userId, personaInput) {
  const persona = compactPersona(sanitizePersonaInput(personaInput));

  await AIProfile.findOneAndUpdate(
    { user: userId },
    { user: userId, persona },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return getProfile(userId);
}

export async function getSessionPersona(userId, sessionId) {
  const session = await getOwnedSession(userId, sessionId);
  const { effectivePersona: defaultPersona } = await getProfile(userId);
  const persona = toPlainPersona(session.aiPersona, { preserveEmptyText: true });

  return {
    persona,
    effectivePersona: resolvePersonaConfig(defaultPersona, persona),
  };
}

export async function updateSessionPersona(userId, sessionId, personaInput) {
  const session = await getOwnedSession(userId, sessionId);
  const { effectivePersona: defaultPersona } = await getProfile(userId);
  const currentPersona = toPlainPersona(session.aiPersona, { preserveEmptyText: true });
  const submittedPersona = sanitizePersonaInput(personaInput, {
    preserveEmptyText: true,
    preserveEmptyEnum: true,
  });
  const nextPersona = compactPersona(
    applySessionPersonaPatch(currentPersona, submittedPersona, personaInput),
    { preserveEmptyText: true }
  );

  session.aiPersona = Object.keys(nextPersona).length > 0 ? nextPersona : undefined;
  session.updatedAt = new Date();
  await session.save();

  return {
    persona: toPlainPersona(session.aiPersona, { preserveEmptyText: true }),
    effectivePersona: resolvePersonaConfig(
      defaultPersona,
      toPlainPersona(session.aiPersona, { preserveEmptyText: true })
    ),
  };
}

export async function resolveEffectivePersona(userId, sessionOrPersonaSource = null) {
  const { effectivePersona: defaultPersona } = await getProfile(userId);

  if (!sessionOrPersonaSource) {
    return defaultPersona;
  }

  if (typeof sessionOrPersonaSource === 'string') {
    const sessionPersona = await getSessionPersona(userId, sessionOrPersonaSource);
    return sessionPersona.effectivePersona;
  }

  return resolvePersonaConfig(
    defaultPersona,
    toPlainPersona(sessionOrPersonaSource.aiPersona, { preserveEmptyText: true })
  );
}
