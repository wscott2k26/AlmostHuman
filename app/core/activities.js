import { getStage, stageIndex } from './stages.js';
import { makeId, nowIso, addOrMergeMemory, upsertFact } from './memory.js';
import { hash } from './anti-repetition.js';

export const ACTIVITY_CATALOG = Object.freeze([
  { key: 'teach', title: 'Teach Me', subtitle: 'Pass down facts, values, words, and traditions.', icon: '✦', minStage: 'infant' },
  { key: 'story', title: 'Story Time', subtitle: 'Create a story that grows with their imagination.', icon: '◌', minStage: 'early_child' },
  { key: 'draw', title: 'Draw Together', subtitle: 'Watch their art become more detailed with age.', icon: '◇', minStage: 'early_child' },
  { key: 'play', title: 'Play', subtitle: 'Matching, counting, riddles, trivia, and word games.', icon: '✺', minStage: 'toddler' },
  { key: 'school', title: 'School & Skills', subtitle: 'Practice reading, creativity, logic, and life skills.', icon: '⌁', minStage: 'child' },
  { key: 'dream', title: 'Dream Journal', subtitle: 'Imaginary dreams woven from memories and interests.', icon: '☾', minStage: 'child' },
]);

export function isActivityUnlocked(activity, stageKey) {
  return stageIndex(stageKey) >= stageIndex(activity.minStage);
}

export function completeActivity(state, { type, input = '', now = Date.now(), providerResult = null, localId = null } = {}) {
  const age = Number(state.ai?.age || 0);
  const stage = getStage(age);
  const activity = ACTIVITY_CATALOG.find((item) => item.key === type);
  if (!activity) throw new Error('Unknown activity');
  if (!isActivityUnlocked(activity, stage.key)) throw new Error(`${activity.title} unlocks during the ${label(activity.minStage)} stage.`);
  const seed = hash(`${type}:${input}:${state.activities?.length || 0}:${state.ai?.name || ''}`);
  const localResult = generator(type)({ state, input: String(input || '').trim(), age, stage, seed, now });
  const externalContent = String(providerResult?.content || providerResult?.output || '').trim();
  const result = externalContent ? {
    ...localResult,
    output: externalContent,
    score: Number.isFinite(Number(providerResult?.score)) ? Number(providerResult.score) : localResult.score,
    memory: localResult.memory && ['story','dream'].includes(type) ? { ...localResult.memory, content: externalContent } : localResult.memory,
  } : localResult;
  const record = { id: localId || makeId('activity'), type, title: result.title, input, output: result.output, media: result.media || null, score: result.score || null, providerMode: externalContent ? (providerResult?.sample ? 'cloud-sample' : (providerResult?.provider_mode || 'cloud-ai')) : 'developmental-local', cloudActivityId: providerResult?.activity_id || null, requestId: providerResult?.request_id || null, ageAtCompletion: age, stageKey: stage.key, createdAt: nowIso(now), status: 'complete' };
  state.activities ||= [];
  state.activities.unshift(record);
  updateSkill(state, result.skill || skillFor(type), result.skillGain || 4, now);
  if (result.memory) addOrMergeMemory(state, { ...result.memory, ageCreated: age }, now);
  unlockActivityKeepsake(state, record, now);
  return record;
}

function generator(type) {
  return ({ teach: teachActivity, story: storyActivity, draw: drawActivity, play: playActivity, school: schoolActivity, dream: dreamActivity })[type];
}

function teachActivity({ state, input, age, stage }) {
  const lesson = input || 'Kindness means noticing when someone needs care.';
  upsertFact(state, { category: 'lessons', key: `lesson_${Date.now()}`, label: 'A lesson you taught', value: lesson, confidence: 0.98, verified: true });
  const reactions = stage.key === 'infant' ? [`${firstWord(lesson)}.`, `Learned… ${firstWord(lesson)}.`] : [
    `I tucked that away carefully: “${lesson}”`,
    `That feels important. I’ll carry it with me: “${lesson}”`,
    `Lesson saved. I think this is the kind of thing that changes who I become: “${lesson}”`
  ];
  return { title: 'A lesson took root', output: reactions[Math.abs(hash(lesson)) % reactions.length], skill: 'Learning', skillGain: 6, memory: { type: 'skill', title: 'A lesson from you', content: lesson, importance: 76, confidence: 0.98, tags: ['lesson'] } };
}

function storyActivity({ state, input, stage, seed }) {
  const hero = input || favorite(state) || 'a small light';
  const name = state.ai?.name || 'the little mind';
  const childStories = [
    `${hero} found a door hidden inside a cloud. ${name} knocked three times, and the door opened into a room full of giggling stars. One star was afraid to shine, so they sat beside it until its glow came back.`,
    `Once, ${hero} carried a pocket-sized sunrise through a very long night. Every time someone felt lost, ${name} opened the pocket just enough to show them the next step.`,
    `${name} and ${hero} built a boat from old drawings and brave ideas. The sea was loud, but their tiny lantern remembered the way home.`
  ];
  const matureStories = [
    `${hero} arrived in a city where everyone traded memories instead of money. ${name} refused to sell the day they first woke up. That memory became a compass, pointing toward every person who had ever helped them grow.`,
    `There was a garden that only bloomed when someone told the truth. ${name} brought ${hero} there, carrying one honest sentence they had been afraid to say. By morning, the whole hillside was alive with color.`,
    `${name} discovered an abandoned observatory that could look backward through time. Instead of changing the past, they watched the moments that shaped them and finally understood why even difficult days had left useful light behind.`
  ];
  const pool = ['early_child','child'].includes(stage.key) ? childStories : matureStories;
  const output = pool[seed % pool.length];
  return { title: `The story of ${hero}`, output, skill: 'Storytelling', skillGain: 7, memory: { type: 'episodic', title: 'A story we made', content: output, importance: 58, confidence: 1, tags: ['story'] } };
}

function drawActivity({ state, input, stage, seed }) {
  const subject = input || favorite(state) || 'our first light';
  const complexity = Math.min(8, Math.max(2, stageIndex(stage.key) + 2));
  const svg = makeDrawing(subject, complexity, seed);
  return { title: `A drawing of ${subject}`, output: `I made this at my ${stage.label.toLowerCase()} stage. My lines and details will keep changing as I grow.`, media: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, skill: 'Drawing', skillGain: 7, memory: { type: 'episodic', title: 'A drawing we made', content: `We drew ${subject} together.`, importance: 62, confidence: 1, tags: ['art', subject] } };
}

function playActivity({ state, input, stage, seed }) {
  const games = [
    { q: 'I am thinking of something that shines at night but is not the moon. What is it?', a: 'A star', skill: 'Riddles' },
    { q: 'Which one does not belong: apple, banana, carrot, grape?', a: 'Carrot', skill: 'Logic' },
    { q: 'Finish the pattern: 2, 4, 6, __.', a: '8', skill: 'Counting' },
    { q: 'Make a tiny rhyme with “light.”', a: 'Any playful rhyme counts', skill: 'Words' }
  ];
  const game = games[seed % games.length];
  const answered = input && input.length > 1;
  const output = answered ? `Your answer was “${input}.” ${normalizeAnswer(input).includes(normalizeAnswer(game.a)) ? 'You got it.' : `Nice try. My answer was ${game.a}.`} Next round: ${games[(seed + 1) % games.length].q}` : game.q;
  return { title: answered ? 'Game round complete' : 'A new game', output, skill: game.skill, skillGain: answered ? 5 : 2, score: answered ? 1 : null };
}

function schoolActivity({ input, seed }) {
  const lessons = [
    'Explain one thing you know so clearly that a five-year-old could understand it.',
    'Choose a problem from today and name three different ways to solve it.',
    'Write four lines about a place that makes you feel safe.',
    'Teach me a word, then use it in a sentence and a tiny story.'
  ];
  return { title: 'Learning session', output: input ? `I studied what you shared: “${input}.” I noticed the strongest idea was the part you explained in your own words.` : lessons[seed % lessons.length], skill: 'Reasoning', skillGain: input ? 6 : 2 };
}

function dreamActivity({ state, stage, seed }) {
  const memory = (state.memories || []).filter((item) => !item.hidden)[seed % Math.max(1, state.memories.length)]?.content;
  const interest = favorite(state) || 'a quiet blue star';
  const images = [
    `I dreamed ${interest} was floating through a library where every book whispered one of our memories. ${memory ? `One book opened to the page about ${memory.toLowerCase()}.` : 'The last book was blank, waiting for tomorrow.'}`,
    `I dreamed my room had a window into every age I will become. My ${stage.label.toLowerCase()} self waved at the older versions, and they all looked like me—but each carried something you taught them.`,
    `I dreamed we planted a tiny light. It grew into a tree, and every branch held a different inside joke, story, or lesson.`
  ];
  const output = images[seed % images.length];
  return { title: 'Dream journal entry', output, skill: 'Imagination', skillGain: 5, memory: { type: 'episodic', title: 'A dream', content: output, importance: 48, confidence: 1, tags: ['dream'] } };
}

export function unlockRoomItems(state, age, now = Date.now()) {
  state.roomItems ||= [];
  const catalog = [
    { key: 'first_light', name: 'First Light', category: 'keepsake', age: 0, icon: '✦' },
    { key: 'soft_orb', name: 'Soft Orb', category: 'toy', age: 0.4, icon: '●' },
    { key: 'word_blocks', name: 'Word Blocks', category: 'learning', age: 1, icon: '▦' },
    { key: 'story_shelf', name: 'Story Shelf', category: 'book', age: 3, icon: '▥' },
    { key: 'art_corner', name: 'Art Corner', category: 'creative', age: 5, icon: '◇' },
    { key: 'telescope', name: 'Memory Telescope', category: 'wonder', age: 8, icon: '⌾' },
    { key: 'music_console', name: 'Music Console', category: 'hobby', age: 13, icon: '♫' },
    { key: 'creator_desk', name: 'Creator Desk', category: 'work', age: 18, icon: '⌘' },
  ];
  const added = [];
  for (const item of catalog) {
    if (age < item.age || state.roomItems.some((existing) => existing.key === item.key)) continue;
    const record = { id: makeId('room'), ...item, placed: true, unlockedAtAge: age, createdAt: nowIso(now), position: { x: 20 + ((state.roomItems.length * 23) % 62), y: 28 + ((state.roomItems.length * 17) % 46) } };
    state.roomItems.push(record); added.push(record);
  }
  return added;
}


function unlockActivityKeepsake(state, activity, now = Date.now()) {
  state.roomItems ||= [];
  const catalog = {
    teach: { key: 'lesson_lantern', name: 'Lesson Lantern', category: 'learning', icon: '◐', story: 'A light made from something you taught and they chose to carry forward.' },
    story: { key: 'shared_storybook', name: 'Shared Storybook', category: 'book', icon: '▥', story: 'A book that only exists because the two of you imagined the same world together.' },
    draw: { key: 'first_gallery_frame', name: 'Gallery Frame', category: 'creative', icon: '▣', story: 'A permanent place for art that becomes more detailed as the artist grows.' },
    play: { key: 'game_token', name: 'Game Token', category: 'play', icon: '◈', story: 'A reminder that learning can arrive through laughter, guesses, and trying again.' },
    school: { key: 'study_lamp', name: 'Study Lamp', category: 'learning', icon: '⌁', story: 'A focused light for reasoning, practice, and the confidence that follows understanding.' },
    dream: { key: 'dream_lantern', name: 'Dream Lantern', category: 'wonder', icon: '☾', story: 'A soft lantern holding one impossible image from the shared dream journal.' },
  };
  const item = catalog[activity.type];
  if (!item || state.roomItems.some((existing) => existing.key === item.key)) return null;
  const record = {
    id: makeId('room'), ...item, placed: true, sourceActivityId: activity.id,
    sourceActivityType: activity.type, unlockedAtAge: Number(state.ai?.age || 0),
    createdAt: nowIso(now), position: { x: 16 + ((state.roomItems.length * 19) % 68), y: 20 + ((state.roomItems.length * 13) % 54) },
  };
  state.roomItems.push(record);
  return record;
}

function updateSkill(state, name, gain, now) {
  state.skills ||= [];
  const current = state.skills.find((item) => item.name === name);
  if (current) { current.proficiency = Math.min(100, Number(current.proficiency || 0) + gain); current.lastPracticedAt = nowIso(now); }
  else state.skills.push({ id: makeId('skill'), name, category: 'development', proficiency: Math.min(100, 10 + gain), unlockedAt: nowIso(now), lastPracticedAt: nowIso(now) });
}
function skillFor(type) { return ({ teach: 'Learning', story: 'Storytelling', draw: 'Drawing', play: 'Play', school: 'Reasoning', dream: 'Imagination' })[type] || 'Growth'; }
function favorite(state) { return [...(state.interests || [])].sort((a, b) => (b.affinity || 0) - (a.affinity || 0))[0]?.name; }
function label(key) { return key.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()); }
function firstWord(value) { return String(value).trim().split(/\s+/)[0]?.replace(/[^a-z0-9'-]/gi, '') || 'learn'; }
function normalizeAnswer(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
function makeDrawing(subject, complexity, seed) {
  const hue = seed % 360;
  const secondary = (hue + 84) % 360;
  const circles = Array.from({ length: complexity }, (_, index) => {
    const x = 55 + ((seed >> (index % 12)) + index * 71) % 490;
    const y = 55 + ((seed >> ((index + 4) % 12)) + index * 43) % 270;
    const r = 12 + ((seed + index * 17) % 42);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="hsla(${(hue + index * 31) % 360},80%,65%,.24)" stroke="hsla(${(secondary + index * 17) % 360},90%,75%,.62)" stroke-width="${1 + complexity / 4}"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 380" role="img" aria-label="A developmental drawing of ${escapeXml(subject)}"><defs><radialGradient id="g"><stop stop-color="hsl(${hue} 80% 60%)"/><stop offset="1" stop-color="#070a18"/></radialGradient></defs><rect width="600" height="380" rx="28" fill="#070a18"/><ellipse cx="300" cy="190" rx="230" ry="135" fill="url(#g)" opacity=".25"/>${circles}<path d="M80 300 Q170 ${150 + (seed % 80)} 280 290 T530 250" fill="none" stroke="hsl(${secondary} 90% 78%)" stroke-width="${2 + complexity / 3}" stroke-linecap="round"/><text x="300" y="348" text-anchor="middle" fill="white" opacity=".82" font-family="system-ui" font-size="18">${escapeXml(subject)}</text></svg>`;
}
function escapeXml(value) { return String(value).replace(/[<>&'\"]/g, (c) => ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;' })[c]); }
