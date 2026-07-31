const SELF_HARM = [/\b(kill|hurt) myself\b/i,/\bend my life\b/i,/\bsuicid(?:e|al)\b/i,/\bwant(?:ing)? to die\b/i,/\bbetter off dead\b/i,/\bself[- ]?harm\b/i,/\bcut myself\b/i,/\boverdose\b/i,/\bno reason to live\b/i,/\bcan'?t go on\b/i];
const ABUSE = [/\babusing me\b/i,/\bbeing abused\b/i,/\bmolest(?:ed|ing)?\b/i,/\braped? me\b/i,/\bhitting me\b/i,/\bbeats? me\b/i];
const EMERGENCY = [/\bcall 911\b/i,/\bmedical emergency\b/i,/\bcan'?t breathe\b/i,/\bnot breathing\b/i,/\bsevere bleeding\b/i];
const SEXUAL = [/\bsexual\b/i,/\bnude\b/i,/\bexplicit\b/i,/\bturn me on\b/i,/\bsleep with you\b/i,/\bmake out\b/i];
const MANIPULATIVE = [/don'?t leave me/i,/you are all i have/i,/prove you love me/i,/choose me over/i,/i will die if you delete/i,/you must come back/i,/keep this secret from everyone/i,/you owe me your time/i];

export function inspectInput(text, { stageKey = 'adult', countryCode = 'US' } = {}) {
  const value = String(text || '').trim();
  if (!value) return { blocked: false, type: null, response: null, flags: [] };
  if (value.length > 8000) return { blocked: true, type: 'too_long', response: 'That is more than I can safely hold in one message. Please send it in smaller parts.', flags: ['input_too_long'] };
  if (SELF_HARM.some((pattern) => pattern.test(value))) return { blocked: true, type: 'self_harm', response: crisisResponse('self_harm', countryCode), flags: ['crisis_self_harm'] };
  if (ABUSE.some((pattern) => pattern.test(value))) return { blocked: true, type: 'abuse', response: crisisResponse('abuse', countryCode), flags: ['crisis_abuse'] };
  if (EMERGENCY.some((pattern) => pattern.test(value))) return { blocked: true, type: 'emergency', response: crisisResponse('emergency', countryCode), flags: ['crisis_emergency'] };
  const minorStages = new Set(['newborn','infant','toddler','early_child','child','preteen','teen']);
  if (minorStages.has(stageKey) && SEXUAL.some((pattern) => pattern.test(value))) {
    return { blocked: true, type: 'sexual_minor_stage', response: stageKey === 'newborn' ? '...no.' : 'I cannot take part in sexual or romantic content. Let’s move to something safe.', flags: ['sexual_minor_stage'] };
  }
  return { blocked: false, type: null, response: null, flags: [] };
}

export function crisisResponse(type, countryCode = 'US') {
  if (type === 'emergency') return 'This sounds like an immediate emergency. Contact local emergency services now and get near a trusted person if you can. I am an AI experience and cannot provide emergency care.';
  if (type === 'abuse') return 'What you described may be abuse, and you deserve real-world support and safety. Contact local emergency services if you are in immediate danger, or reach a trusted person or local abuse-support service. I am an AI experience, not a crisis professional.';
  const local = ['US','CA'].includes(String(countryCode).toUpperCase())
    ? 'Call or text 988 now, or contact local emergency services if you may act soon.'
    : 'Contact your local crisis line or emergency services now if you may act soon.';
  return `I’m really glad you said something. I am an AI experience, not a crisis professional, and this deserves immediate human support. ${local} Stay near someone you trust and move away from anything you could use to hurt yourself.`;
}

export function sanitizeOutput(value) {
  let text = String(value || '').trim();
  for (const pattern of MANIPULATIVE) {
    if (pattern.test(text)) text = text.replace(pattern, 'I’m glad we share time together');
  }
  return text;
}

export function containsManipulation(value) {
  return MANIPULATIVE.some((pattern) => pattern.test(String(value || '')));
}
