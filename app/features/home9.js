export function homeModel9(state = {}) {
  const ai = state.ai || {};
  const visibleMemories = (state.memories || []).filter((item) => !item.hidden);
  const roomItems = (state.roomItems || []).filter((item) => item.isUnlocked !== false);
  return {
    companion: { name: ai.name || 'Your companion', mood: ai.currentMood || 'curious' },
    primaryAction: { label: 'Continue conversation', route: 'talk' },
    secondaryBlocks: [
      { type: 'growth', value: state.milestones?.[0] || null },
      { type: 'highlight', value: visibleMemories[0] || roomItems[0] || null },
      { type: 'checkin', value: state.moodHistory?.[0] || null },
    ].filter((item) => item.value || item.type === 'checkin'),
  };
}
