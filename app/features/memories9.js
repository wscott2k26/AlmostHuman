export function memoryListModel9(state = {}, query = '') {
  const needle = String(query || '').trim().toLowerCase();
  const items = (state.memories || []).filter((item) => !item.hidden).filter((item) => !needle || `${item.title || ''} ${item.content || ''}`.toLowerCase().includes(needle)).map((item) => ({ id: item.id, title: item.title || 'Memory', content: item.content || '', createdAt: item.createdAt, isPrivate: Boolean(item.isPrivate) }));
  return { query: needle, items };
}
