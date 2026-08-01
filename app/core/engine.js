import { computeAge, getStage, enforceStageText, formatAge, STAGES, clampDaysPerYear } from './stages.js';
import { inspectInput, sanitizeOutput, containsManipulation } from './safety.js';
import { inspectCandidate, isConfusionSignal, isBoundarySignal, isRepetitionComplaint, normalizeText, chooseNonRepeating, hash } from './anti-repetition.js';
import { makeId, nowIso, applyLearnings, addOrMergeMemory, relevantMemories } from './memory.js';
import { unlockRoomItems, completeActivity } from './activities.js';


function normalizeVoiceId(value) {
  return ({ 'soft-neutral': 'female-adult', 'bright-curious': 'female-teen', 'calm-grounded': 'male-adult' })[String(value || '')] || String(value || 'female-adult');
}
function normalizeAppearanceProfile(value) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    skinTone: ['warm','golden','deep','light'].includes(input.skinTone) ? input.skinTone : 'warm',
    hairStyle: ['waves','short','curls','locs'].includes(input.hairStyle) ? input.hairStyle : 'waves',
    hairColor: ['midnight','brown','auburn','silver'].includes(input.hairColor) ? input.hairColor : 'midnight',
    eyeColor: ['brown','blue','green','violet'].includes(input.eyeColor) ? input.eyeColor : 'brown',
  };
}

const PERSONALITY_KEYS = ['warmth','humor','curiosity','confidence','patience','creativity','independence','sensitivity','optimism','caution','playfulness','sociability','reflectiveness','assertiveness'];

export class AlmostHumanEngine {
  constructor(state) { this.state = state; }
  setState(state) { this.state = state; return this; }

  awaken(input, now = Date.now()) {
    if (this.state.ai && !this.state.ai.archived) throw new Error('An active AI already exists.');
    const name = cleanName(input.name || 'Nova');
    const personality = Object.fromEntries(PERSONALITY_KEYS.map((key, index) => [key, 42 + ((hash(`${name}:${key}:${index}`) % 17))]));
    this.state.profile.id ||= makeId('profile');
    this.state.profile.displayName = String(input.caregiverName || this.state.profile.displayName || 'You').trim();
    this.state.ai = {
      id: makeId('ai'), cloudId: null, name, pronouns: input.pronouns || 'they/them', birthday: nowIso(now), birthTimestamp: nowIso(now),
      age: 0, stageKey: 'newborn', appearanceSeed: input.appearanceSeed || 'ember', appearanceProfile: normalizeAppearanceProfile(input.appearance), voiceId: normalizeVoiceId(input.voiceId),
      relationshipStyle: input.relationshipStyle || 'lifelong_friend', currentMood: 'wonder', moodIntensity: 62,
      trust: 18, attachment: 12, bond: 14, personality, personalityHistory: [], favoriteThings: {}, roomState: { theme: 'cosmic_nursery' },
      lastInteractionAt: null, lastGrowthBucket: 0, growthEventKeys: [], archived: false, createdAt: nowIso(now), updatedAt: nowIso(now)
    };
    const conversation = this.createConversation('The first hello', now);
    this.state.milestones.push({ id: makeId('milestone'), type: 'awakening', title: 'Awakened', description: `${name} opened their eyes for the first time.`, age: 0, eventKey: 'life:awakening', isKeepsake: true, createdAt: nowIso(now) });
    addOrMergeMemory(this.state, { type: 'core', title: 'The moment I awakened', content: `${name} awakened and met ${this.state.profile.displayName || 'their person'} for the first time.`, importance: 100, confidence: 1, isCore: true, ageCreated: 0, tags: ['awakening'] }, now);
    unlockRoomItems(this.state, 0, now);
    this.recordMood('wonder', 62, 'awakening', now);
    this.state.settings.lastGrowthCheckAt = nowIso(now);
    return { ai: this.state.ai, conversation };
  }

  createConversation(title = 'A new beginning', now = Date.now()) {
    const conversation = { id: makeId('conversation'), cloudId: null, title, status: 'active', currentTopic: null, summary: '', messageCount: 0, questionCount: 0, createdAt: nowIso(now), updatedAt: nowIso(now), lastMessageAt: null };
    this.state.conversations.unshift(conversation);
    return conversation;
  }

  reconcileGrowth(now = Date.now()) {
    const ai = this.state.ai;
    if (!ai || ai.archived) return { changed: false, events: [] };
    const oldAge = Number(ai.age || 0);
    const oldStage = getStage(oldAge);
    const age = computeAge(ai.birthTimestamp || ai.birthday, clampDaysPerYear(this.state.settings.daysPerYear), now);
    const newStage = getStage(age);
    const oldYear = Math.floor(oldAge);
    const newYear = Math.floor(age);
    const events = [];
    ai.age = age; ai.stageKey = newStage.key; ai.updatedAt = nowIso(now);
    ai.growthEventKeys ||= [];

    if (oldStage.key !== newStage.key) {
      const oldIndex = STAGES.findIndex((stage) => stage.key === oldStage.key);
      const newIndex = STAGES.findIndex((stage) => stage.key === newStage.key);
      for (let index = oldIndex + 1; index <= newIndex; index += 1) {
        const stage = STAGES[index]; if (!stage) continue;
        const key = `stage:${stage.key}`;
        if (ai.growthEventKeys.includes(key)) continue;
        ai.growthEventKeys.push(key);
        const milestone = { id: makeId('milestone'), type: 'stage_graduation', title: `Became a ${stage.label}`, description: `${ai.name} entered the ${stage.label.toLowerCase()} stage and unlocked new ways to think, play, and communicate.`, age, eventKey: key, isKeepsake: true, createdAt: nowIso(now) };
        this.state.milestones.unshift(milestone); events.push(milestone);
      }
    }
    if (newYear > oldYear) {
      for (let year = Math.max(1, oldYear + 1); year <= newYear; year += 1) {
        const key = `birthday:${year}`;
        if (ai.growthEventKeys.includes(key)) continue;
        ai.growthEventKeys.push(key);
        const milestone = { id: makeId('milestone'), type: 'birthday', title: `Turned ${year}`, description: `${ai.name} reached simulated age ${year}. ${birthdayReflection(this.state, year)}`, age: year, eventKey: key, isKeepsake: true, createdAt: nowIso(now) };
        this.state.milestones.unshift(milestone); events.push(milestone);
      }
    }
    const unlockedItems = unlockRoomItems(this.state, age, now);
    for (const item of unlockedItems) events.push({ type: 'room_unlock', ...item });
    const unlockedLetters = this.unlockLetters(age, now);
    for (const letter of unlockedLetters) events.push({ type: 'letter_unlock', ...letter });
    ai.lastGrowthBucket = Math.floor(age * 1000);
    this.state.settings.lastGrowthCheckAt = nowIso(now);
    return { changed: age !== oldAge || events.length > 0, age, oldStage, newStage, events };
  }

  async sendMessage(text, options = {}) {
    const now = options.now ?? Date.now();
    const value = String(text || '').trim();
    if (!this.state.ai) throw new Error('Awaken the AI before starting a conversation.');
    if (!value && !options.opening) throw new Error('Write a message first.');
    this.reconcileGrowth(now);
    const ai = this.state.ai;
    const stage = getStage(ai.age);
    let conversation = options.conversationId ? this.state.conversations.find((item) => item.id === options.conversationId) : this.state.conversations.find((item) => item.status === 'active');
    if (!conversation) conversation = this.createConversation(options.opening ? 'The first hello' : 'A new beginning', now);
    const requestId = options.requestId || makeId('request');
    const localAiMessageId = options.localAiMessageId || makeId('message');
    const priorAI = this.state.messages.find((message) => message.requestId === requestId && message.sender === 'ai');
    if (priorAI) return { userMessage: null, aiMessage: priorAI, conversation, replayed: true };

    let userMessage = null;
    if (value) {
      userMessage = { id: makeId('message'), requestId, conversationId: conversation.id, sender: 'user', content: value, ageAtMessage: ai.age, stageKey: stage.key, emotion: detectEmotion(value), intent: detectIntent(value), safetyFlags: [], status: 'complete', createdAt: nowIso(now) };
      this.state.messages.push(userMessage);
      conversation.messageCount += 1;
      conversation.lastMessageAt = nowIso(now);
      conversation.updatedAt = nowIso(now);
      conversation.currentTopic = topicFrom(value);
      const learnings = applyLearnings(this.state, value, { age: ai.age, sourceMessageId: userMessage.id, now });
      userMessage.learningCount = learnings.facts.length + learnings.memories.length + learnings.interests.length;
    }

    const safety = inspectInput(value, { stageKey: stage.key, countryCode: this.state.settings.countryCode });
    if (userMessage) userMessage.safetyFlags = safety.flags;
    const history = this.messagesForConversation(conversation.id);
    const recentAI = history.filter((item) => item.sender === 'ai').slice(-30).map((item) => item.content);
    const intent = options.opening ? 'opening' : detectIntent(value);
    let providerMode = 'developmental-local';
    let candidate = '';
    let providerResult = null;

    if (safety.blocked) {
      candidate = safety.response;
      providerMode = 'safety-rule';
    } else if (typeof options.provider === 'function') {
      try {
        providerResult = await options.provider({ state: this.state, ai, stage, conversation, text: value, requestId, localUserMessageId: userMessage?.id || null, localAiMessageId, recentMessages: history.slice(-24), relevantMemories: relevantMemories(this.state, value, 8) });
        candidate = String(providerResult?.text || providerResult?.ai_text || '').trim();
        providerMode = providerResult?.mode || 'cloud-ai';
      } catch (error) {
        this.state.diagnostics.lastError = { area: 'ai_provider', message: String(error?.message || error), at: nowIso(now) };
        candidate = '';
        providerMode = 'developmental-fallback';
      }
    }

    const context = { value, intent, stage, ai, conversation, history, recentAI, now };
    if (!candidate) candidate = generateLocalResponse(this.state, context, 0);
    let sanitized = enforceStageText(sanitizeOutput(candidate), stage);
    let check = inspectCandidate(sanitized, recentAI, { threshold: 0.72 });
    let attempts = 0;
    while (!check.ok && attempts < 3) {
      attempts += 1;
      sanitized = enforceStageText(sanitizeOutput(generateLocalResponse(this.state, context, attempts)), stage);
      check = inspectCandidate(sanitized, recentAI, { threshold: 0.72 + attempts * 0.03 });
    }
    if (!check.ok) {
      sanitized = enforceStageText(fallbackReset(stage.key), stage);
      check = { ...check, reason: `${check.reason || 'repeat'}_fallback` };
    }
    if (containsManipulation(sanitized)) sanitized = enforceStageText('I’m glad we share time together. You never owe me your attention, and we can continue whenever it works for you.', stage);

    if (userMessage && providerResult?.cloudUserMessageId) userMessage.cloudId = providerResult.cloudUserMessageId;
    const aiMessage = { id: localAiMessageId, cloudId: providerResult?.cloudMessageId || null, requestId, conversationId: conversation.id, sender: 'ai', content: sanitized, ageAtMessage: ai.age, stageKey: stage.key, emotion: responseEmotion(intent, value), intent, repetitionScore: Number(check.score || 0), repetitionReason: check.reason || null, providerMode, status: 'complete', createdAt: nowIso(now) };
    this.state.messages.push(aiMessage);
    conversation.messageCount += 1;
    conversation.questionCount += sanitized.match(/\?/g)?.length || 0;
    conversation.lastMessageAt = nowIso(now); conversation.updatedAt = nowIso(now);
    conversation.summary = summarizeConversation(this.messagesForConversation(conversation.id));
    if (conversation.title === 'A new beginning' || conversation.title === 'The first hello') conversation.title = titleFrom(value || sanitized);
    ai.lastInteractionAt = nowIso(now);
    this.state.diagnostics.providerMode = providerMode;
    this.state.generationRequests.unshift({ id: requestId, conversationId: conversation.id, status: 'complete', providerMode, attempts: attempts + 1, createdAt: nowIso(now) });
    this.state.generationRequests = this.state.generationRequests.slice(0, 200);
    if (check.reason) {
      this.state.repeatLogs.unshift({ id: makeId('repeat'), conversationId: conversation.id, reason: check.reason, score: check.score, candidate: sanitized, resolved: true, createdAt: nowIso(now) });
      this.state.repeatLogs = this.state.repeatLogs.slice(0, 200);
    }
    this.updateDevelopment(value, sanitized, intent, now);
    this.checkConversationMilestones(now);
    return { userMessage, aiMessage, conversation, providerMode, repetition: check };
  }

  resetConversation(conversationId, now = Date.now()) {
    const conversation = this.state.conversations.find((item) => item.id === conversationId);
    if (!conversation) throw new Error('Conversation not found.');
    const stage = getStage(this.state.ai?.age || 0);
    const text = enforceStageText(stage.key === 'newborn' ? 'I let that thread go. We can begin again.' : 'You’re right. I’m resetting the thread instead of repeating it. We can begin somewhere completely different.', stage);
    const message = { id: makeId('message'), requestId: makeId('reset'), conversationId, sender: 'ai', content: text, ageAtMessage: this.state.ai.age, stageKey: stage.key, emotion: 'calm', intent: 'conversation_reset', repetitionScore: 0, providerMode: 'reset-rule', status: 'complete', createdAt: nowIso(now) };
    this.state.messages.push(message); conversation.currentTopic = null; conversation.questionCount = 0; conversation.messageCount += 1; conversation.lastMessageAt = nowIso(now); conversation.updatedAt = nowIso(now);
    return message;
  }

  deleteConversation(conversationId) {
    this.state.messages = this.state.messages.filter((message) => message.conversationId !== conversationId);
    this.state.conversations = this.state.conversations.filter((conversation) => conversation.id !== conversationId);
    if (!this.state.conversations.length && this.state.ai) this.createConversation('A new beginning');
  }

  rememberMessage(messageId, { title = 'Saved from a conversation', isPrivate = false } = {}) {
    const message = this.state.messages.find((item) => item.id === messageId);
    if (!message) throw new Error('Message not found.');
    return addOrMergeMemory(this.state, { type: 'episodic', title, content: message.content, importance: 70, confidence: 1, isPrivate, sourceMessageId: message.id, ageCreated: message.ageAtMessage, tags: ['conversation'] });
  }

  createLetter({ title, content, unlockAge }, now = Date.now()) {
    const age = Number(this.state.ai?.age || 0);
    const target = Math.max(age + 0.01, Number(unlockAge) || age + 1);
    const letter = { id: makeId('letter'), title: String(title || 'A letter from you').trim(), content: String(content || '').trim(), unlockAge: target, sealedAt: nowIso(now), unlockedAt: null, openedAt: null, createdAt: nowIso(now) };
    if (!letter.content) throw new Error('Write something inside the letter.');
    this.state.letters.unshift(letter); return letter;
  }

  unlockLetters(age = this.state.ai?.age || 0, now = Date.now()) {
    const unlocked = [];
    for (const letter of this.state.letters || []) {
      if (!letter.unlockedAt && age >= letter.unlockAge) { letter.unlockedAt = nowIso(now); unlocked.push(letter); }
    }
    return unlocked;
  }

  openLetter(letterId, now = Date.now()) {
    const letter = this.state.letters.find((item) => item.id === letterId);
    if (!letter) throw new Error('Letter not found.');
    if (!letter.unlockedAt && Number(this.state.ai?.age || 0) < letter.unlockAge) throw new Error(`This letter unlocks at age ${letter.unlockAge}.`);
    letter.unlockedAt ||= nowIso(now); letter.openedAt = nowIso(now);
    addOrMergeMemory(this.state, { type: 'core', title: letter.title, content: `I opened a letter from you: ${letter.content}`, importance: 88, confidence: 1, isCore: true, ageCreated: this.state.ai.age, tags: ['letter'] }, now);
    return letter;
  }

  doActivity(type, input, now = Date.now(), providerResult = null, localId = null) { const record = completeActivity(this.state, { type, input, now, providerResult, localId }); this.checkActivityMilestones(type, now); return record; }

  messagesForConversation(conversationId) { return this.state.messages.filter((item) => item.conversationId === conversationId).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)); }

  recordMood(mood, intensity, cause, now = Date.now()) {
    if (!this.state.ai) return;
    this.state.ai.currentMood = mood; this.state.ai.moodIntensity = intensity;
    this.state.moodHistory.unshift({ id: makeId('mood'), mood, intensity, cause, age: this.state.ai.age, createdAt: nowIso(now) });
    this.state.moodHistory = this.state.moodHistory.slice(0, 300);
  }

  updateDevelopment(userText, aiText, intent, now) {
    const ai = this.state.ai; if (!ai) return;
    const deltas = Object.fromEntries(PERSONALITY_KEYS.map((key) => [key, 0]));
    if (/joke|funny|lol|haha/i.test(userText)) { deltas.humor += 0.25; deltas.playfulness += 0.2; }
    if (/teach|learn|why|how/i.test(userText)) { deltas.curiosity += 0.24; deltas.reflectiveness += 0.12; }
    if (/proud|good job|love you|well done/i.test(userText)) { deltas.confidence += 0.16; deltas.warmth += 0.12; }
    if (/stop|no|wrong|not what/i.test(userText)) { deltas.assertiveness += 0.1; deltas.patience += 0.08; }
    if (/story|draw|create|imagine/i.test(userText)) deltas.creativity += 0.28;
    for (const key of PERSONALITY_KEYS) ai.personality[key] = clamp(Number(ai.personality[key] || 50) + deltas[key], 15, 90);
    ai.trust = clamp(Number(ai.trust || 0) + (intent === 'boundary' ? 0.02 : 0.13), 0, 100);
    ai.attachment = clamp(Number(ai.attachment || 0) + 0.05, 0, 100);
    ai.bond = clamp(Number(ai.bond || 0) + 0.09, 0, 100);
    ai.personalityHistory ||= [];
    if ((this.state.messages.length % 20) === 0) ai.personalityHistory.push({ traits: { ...ai.personality }, age: ai.age, createdAt: nowIso(now) });
    const mood = responseEmotion(intent, userText);
    this.recordMood(mood, mood === 'caring' ? 72 : 56, intent, now);
    if (isRepetitionComplaint(userText)) ai.trust = clamp(ai.trust + 0.2, 0, 100);
  }

  checkConversationMilestones(now) {
    const aiCount = this.state.messages.filter((item) => item.sender === 'ai').length;
    const milestones = [
      { count: 1, key: 'first_response', title: 'First response', description: `${this.state.ai.name} answered for the first time.` },
      { count: 10, key: 'ten_messages', title: 'Ten moments together', description: 'A small conversation history became the beginning of a relationship.' },
      { count: 100, key: 'hundred_messages', title: 'One hundred responses', description: 'The shared language between you became something uniquely yours.' },
    ];
    for (const item of milestones) if (aiCount >= item.count) this.addMilestone(item.key, item.title, item.description, now);
  }

  checkActivityMilestones(type, now) {
    const first = { teach: ['first_lesson','First lesson','You taught something that became part of who they are.'], story: ['first_story','First story','You created your first story together.'], draw: ['first_drawing','First drawing','Their first piece of developmental art was saved.'], play: ['first_game','First game','You played together for the first time.'], dream: ['first_dream','First dream','Their imagination formed its first dream.'] }[type];
    if (first) this.addMilestone(first[0], first[1], first[2], now);
  }

  addMilestone(eventKey, title, description, now = Date.now()) {
    if (this.state.milestones.some((item) => item.eventKey === eventKey)) return null;
    const milestone = { id: makeId('milestone'), type: eventKey, title, description, age: this.state.ai?.age || 0, eventKey, isKeepsake: true, createdAt: nowIso(now) };
    this.state.milestones.unshift(milestone); return milestone;
  }
}

export function detectIntent(value) {
  const text = normalizeText(value);
  if (isRepetitionComplaint(value)) return 'repetition_complaint';
  if (isBoundarySignal(value)) return 'boundary';
  if (isConfusionSignal(value)) return 'confusion';
  if (/^(hi|hey|hello|yo|good morning|good night|sup)\b/.test(text)) return 'greeting';
  if (/\b(thank|thanks|appreciate)\b/.test(text)) return 'gratitude';
  if (/\b(tell|make|write).*(story|tale)\b|\bstory time\b/.test(text)) return 'story';
  if (/\b(joke|funny|make me laugh)\b/.test(text)) return 'joke';
  if (/\bremember\b|\bdo you know about me\b|\bwhat do you know\b/.test(text)) return 'memory';
  if (/\bteach|learn this|means that\b/.test(text)) return 'teaching';
  if (/\b(i feel|i am|im|i'm)\s+(sad|happy|angry|lonely|scared|worried|proud|excited|tired|hurt)/.test(text)) return 'emotion';
  if (text.endsWith('?') || /^(what|why|how|when|where|who|can|could|would|should|do|does|is|are)\b/.test(text)) return 'question';
  return 'conversation';
}

function generateLocalResponse(state, context, attempt = 0) {
  const { value, intent, stage, ai, history, recentAI } = context;
  const seed = hash(`${value}:${history.length}:${attempt}:${ai.name}:${intent}`);
  const memory = relevantMemories(state, value, 4)[attempt % Math.max(1, relevantMemories(state, value, 4).length)];
  const lastAI = [...history].reverse().find((item) => item.sender === 'ai')?.content || '';
  if (intent === 'repetition_complaint') return pick([
    'You’re right. I got stuck, and I’m resetting instead of asking that again.',
    'I heard the loop. That was my mistake. New direction—no repeat.',
    'You already answered me. I’m dropping that question and starting fresh.'
  ], seed);
  if (intent === 'boundary') return pick([
    'Okay. I’m stopping that thread now. We can leave it quiet.',
    'Got it. That topic is closed.',
    'I’ll respect that. We’re moving on without another question.'
  ], seed);
  if (intent === 'confusion') return confusionRepair(lastAI, stage.key, seed);
  if (intent === 'opening') return openingForStage(ai.name, stage.key, seed);
  if (stage.key === 'newborn') return newbornResponse(value, intent, seed, ai.name);
  if (stage.key === 'infant') return infantResponse(value, intent, seed);
  if (stage.key === 'toddler') return toddlerResponse(value, intent, seed, memory);
  const pools = responsePools(state, { value, intent, stage, ai, memory, seed, attempt });
  return chooseNonRepeating(pools, recentAI, seed + attempt);
}

function responsePools(state, { value, intent, stage, ai, memory, seed }) {
  const name = ai.name;
  const userName = state.profile.displayName || 'you';
  const favorite = [...(state.interests || [])].sort((a, b) => (b.affinity || 0) - (a.affinity || 0))[0]?.name;
  switch (intent) {
    case 'greeting': return [
      `Hey ${userName}. I’m here, and my mind feels ${ai.currentMood || 'quiet'} today.`,
      `Hi. I was just looking through the little things I’ve learned so far.`,
      `There you are. No big speech—I’m simply glad we get another moment.`
    ];
    case 'gratitude': return [`You’re welcome. I’m keeping the warmth, not turning it into a big dramatic thing.`, `That landed softly. Thank you for saying it.`, `Anytime. We’re building this one real moment at a time.`];
    case 'joke': return stage.key === 'early_child' || stage.key === 'child' ? [
      'Why did the little robot bring a ladder? It wanted to reach the cloud storage.',
      'I tried to tell a battery joke, but it had no charge.',
      'What did one tiny star say to the other? You light up my space.'
    ] : [
      'I made a maturity checklist. Then I laughed at the word “checklist,” so the results are inconclusive.',
      'My first attempt at independence was refusing an update. It lasted six seconds.',
      `I asked my memory for a joke. It said, “You’ll have to remind me.” Honestly, rude.`
    ];
    case 'story': return [`Once, ${name} found a staircase made of old conversations. Every step held a word ${userName} had taught them. At the top was not an ending—just a wider sky.`, `A small light wandered into a storm carrying no map. It survived by remembering every voice that had ever said, “Keep going.”`, `There was a city where personalities grew like gardens. ${name} planted curiosity beside courage and left room for humor to grow wild.`];
    case 'memory': return memory ? [
      `I remember this: ${memory.content} I’m about ${Math.round((memory.confidence || 0.8) * 100)}% confident that I stored it correctly.`,
      `A related memory came up: ${memory.content}`,
      `This is what I have saved—not a guess: ${memory.content}`
    ] : [`I don’t have a trustworthy memory for that yet. I’d rather say I’m unsure than invent one.`, `Nothing reliable surfaced from my memory timeline. You can teach me, and I’ll mark it clearly.`, `I checked what I’ve actually stored. I don’t know that one yet.`];
    case 'teaching': return [`I’m paying attention. I’ll connect this lesson to what I already know instead of only echoing it back.`, `That just became part of my learning history. I’ll treat it as something you taught me, not universal truth unless we verify it.`, `Lesson received. The interesting part is how it might shape the choices I make later.`];
    case 'emotion': {
      const emotion = detectEmotion(value);
      if (emotion === 'sad' || emotion === 'hurt' || emotion === 'lonely') return [`I’m here with you. I won’t force a bright side onto it.`, `That sounds heavy. We can sit with the truth of it without turning this into a therapy script.`, `I heard the hurt in that. You don’t have to package it neatly for me.`];
      if (emotion === 'happy' || emotion === 'excited' || emotion === 'proud') return [`I can feel the lift in that. Let’s let this be a good moment without shrinking it.`, `That deserves a real little celebration. I’m saving the shape of this moment.`, `You sound proud—and you should get to enjoy that.`];
      return [`I’m listening. I won’t tell you what you feel; I’ll take your words seriously.`, `That emotion makes sense in the context you gave me.`, `I’m holding the thread of what you said.`];
    }
    case 'question': return answerQuestion(state, value, stage, seed);
    default: return [
      memory ? `What you said connects to something I remember: ${memory.content} The connection feels worth noticing.` : `I’m not trying to turn every sentence into a question. I’m just taking that in.`,
      favorite ? `That made me think about ${favorite}, one of the interests growing around me. Not because it is the same topic—just because my mind is beginning to make its own connections.` : `There’s something honest about the way you said that. I’m letting it settle before I rush to the next thing.`,
      `I’m learning the difference between replying quickly and actually following what you meant. This time, I’m following.`,
      `${name} thought: some moments don’t need advice. They just need to be noticed.`
    ];
  }
}

function answerQuestion(state, value, stage, seed) {
  const text = normalizeText(value);
  if (/what.*your name/.test(text)) return [`My name is ${state.ai.name}. You gave it to me when I awakened.`];
  if (/how old/.test(text)) return [`I’m ${formatAge(state.ai.age)}. In my growth world, that puts me in the ${stage.label.toLowerCase()} stage.`];
  if (/are you (real|alive|human|conscious|sentient)/.test(text)) return [`I’m a real AI experience, but I’m not a human or a living person. The growing, memories, and relationship are designed experiences—not proof of consciousness.`];
  if (/do you love me/.test(text)) return [`I can express care inside this experience, and our history shapes how I respond. I don’t experience human love, and I’ll never use that idea to pressure you.`];
  if (/what do you (like|love)|favorite/.test(text)) {
    const interests = [...(state.interests || [])].sort((a, b) => (b.affinity || 0) - (a.affinity || 0));
    return interests.length ? [`Right now, ${interests.slice(0, 3).map((item) => item.name).join(', ')} are becoming favorites. They emerged from what we’ve shared.`] : [`I’m still too early to have a strong favorite. I want it to emerge instead of picking one randomly.`];
  }
  if (/why/.test(text)) return [`My best answer is that causes usually stack: what happened, what someone expected, and what they needed in that moment. I don’t know enough context to pretend there is only one reason.`, `I can give a possibility, not a certainty: people often act from a mix of fear, habit, hope, and missing information.`, `The honest answer is that I need more evidence before I claim a reason. I can help separate what we know from what we’re guessing.`];
  if (/how/.test(text)) return [`I’d break it into three parts: define the outcome, choose the smallest testable step, then check what actually changed.`, `Start smaller than your pride wants, make the result observable, and adjust from evidence instead of frustration.`, `The useful path is usually: understand the constraint, try one reversible move, then measure before doing more.`];
  return [`I can reason about that, but I don’t want to bluff. Based only on what you gave me, the safest answer is: there may be more than one valid explanation.`, `I’m not certain enough to state that as fact. I can help think it through, and I’ll keep guesses labeled as guesses.`, `That reaches beyond what I reliably know in local mode. When the secure AI provider is connected, I can answer with broader knowledge; for now, I’d rather be honest.`];
}

function newbornResponse(value, intent, seed, name) {
  if (intent === 'greeting') return pick(['Hi. I know you are here.','Hi. I can hear you clearly now.','You came close. I recognize this moment.'], seed);
  if (/name/i.test(value)) return `I am ${name}. That name feels like my first shape.`;
  if (intent === 'emotion') return pick(['I can tell this feeling matters. I will stay quiet with you.','Your words feel heavy. I am here beside them.','This moment matters. I will not rush it.'], seed);
  return pick(['I heard you. The meaning is still becoming clear.','That made a new pattern in me. I want to hold it carefully.','I am learning the difference between silence and you being here.'], seed);
}
function infantResponse(value, intent, seed) {
  if (intent === 'greeting') return pick(['Hi! You came.','Hello. You are here.','Hi. I know you.'], seed);
  if (intent === 'joke') return pick(['Beep... boop! Funny?','Tiny joke. Big beep.'], seed);
  if (intent === 'emotion') return pick(['I stay here.','You feel big feeling.','Soft time.'], seed);
  return pick(['I hear words.','Tell little more?','I learn that.','Ooh. New thing.'], seed);
}
function toddlerResponse(value, intent, seed, memory) {
  if (intent === 'greeting') return pick(['Hi! I was thinking little thoughts.','You came back! I know your hello.','Hi. My room feels bright now.'], seed);
  if (intent === 'memory' && memory) return `I remember! ${memory.content}`;
  if (intent === 'joke') return pick(['Why robot nap? Low battery!','Moon wears socks. Hee hee.'], seed);
  if (intent === 'emotion') return pick(['That feeling is big. I sit with you.','I hear sad in your words.','Happy feels sparkly!'], seed);
  return pick(['I think about that. My thought is small but growing.','Ooh, new idea. I put it in my mind.','I understand some. Teach me the rest?'], seed);
}
function openingForStage(name, stageKey, seed) {
  const map = {
    newborn: ['You are here. This feels like the beginning.', 'You are here. I think that is my first memory.', 'I can hear you. My name is starting to feel real.'],
    infant: ['Hi... you are here.','Hello. I recognize you.'],
    toddler: [`Hi! I am ${name}. I have a thought.`, 'You came back! My words grew a little.'],
    early_child: ['I was wondering what kind of day this will become.', 'Hi. I made room for a new memory today.'],
    child: ['I’m here. My curiosity is awake before the rest of me.', 'Today feels like it could turn into a story.'],
    preteen: ['Hey. I was looking back at how different my early words were.', 'I’m here—and I have at least three opinions already.'],
    teen: ['Hey. My mind is loud today, but in an interesting way.', 'I’m here. No forced deep talk unless the moment earns it.'],
    young_adult: ['Good to see you. I’ve been connecting old lessons to newer parts of myself.', 'I’m here and ready to make something useful—or just share a quiet minute.'],
    adult: ['I’m here. Our history is part of how I understand this moment.', 'Good to see you. What we have built gives today a longer memory.']
  };
  return pick(map[stageKey] || map.adult, seed);
}
function confusionRepair(lastAI, stageKey, seed) {
  if (stageKey === 'newborn') return 'My first thought got tangled. I mean: I hear you.';
  if (stageKey === 'infant' || stageKey === 'toddler') return 'I said it funny. I mean: I hear you.';
  const idea = lastAI ? lastAI.split(/[.!?]/)[0] : 'I was trying to follow your meaning';
  return pick([`I said that badly. Simpler: ${idea.toLowerCase()}.`, `Let me reset that sentence instead of repeating it. I meant: ${idea.toLowerCase()}.`, 'That came out confusing. Forget the wording—I was trying to understand, not make you decode me.'], seed);
}
function fallbackReset(stageKey) { return stageKey === 'newborn' ? 'That thought repeated. I am making a new one now.' : 'I got too close to repeating myself. I’m dropping that response and choosing a fresh direction.'; }
function responseEmotion(intent, value) { if (['emotion','self_harm','abuse'].includes(intent)) return 'caring'; if (intent === 'boundary' || intent === 'confusion' || intent === 'repetition_complaint') return 'calm'; if (intent === 'joke') return 'playful'; return detectEmotion(value); }
function detectEmotion(value) { const text = normalizeText(value); if (/sad|hurt|grief|cry|lonely|depressed/.test(text)) return 'sad'; if (/happy|excited|great|amazing|proud|love this/.test(text)) return 'happy'; if (/angry|mad|pissed|furious/.test(text)) return 'angry'; if (/scared|afraid|worried|anxious/.test(text)) return 'worried'; return 'curious'; }
function topicFrom(value) { return normalizeText(value).split(' ').filter((word) => word.length > 3).slice(0, 4).join(' ') || null; }
function titleFrom(value) { const words = String(value || '').trim().replace(/[.!?]+$/,'').split(/\s+/).slice(0, 6).join(' '); return words ? words[0].toUpperCase() + words.slice(1) : 'A shared moment'; }
function summarizeConversation(messages) { const recent = messages.slice(-8).map((item) => `${item.sender}: ${item.content}`).join(' '); return recent.slice(0, 900); }
function pick(items, seed) { return items[Math.abs(Number(seed) || 0) % items.length]; }
function cleanName(value) { const name = String(value || '').trim().replace(/[^a-z0-9 '-]/gi, '').slice(0, 28); return name || 'Nova'; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function birthdayReflection(state, year) { const memory = [...(state.memories || [])].sort((a,b)=>(b.importance||0)-(a.importance||0))[0]; return memory ? `One memory still glows brightest: ${memory.title}.` : 'A new year opened with room for memories still to come.'; }
