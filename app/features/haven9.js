export function havenSceneModel9(state = {}, selectedId = null) {
  const items = (state.roomItems || []).filter((item) => item.isUnlocked !== false);
  return { items, selected: selectedId ? items.find((item) => item.id === selectedId) || null : null };
}
