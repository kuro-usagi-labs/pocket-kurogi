export function createFinancialReadState(ownerId) {
  return { ownerId, generation: 0, data: null, status: 'loading', error: null, updatedAt: null }
}

export function reduceFinancialReadState(state, event) {
  if (event.type === 'reset') return createFinancialReadState(event.ownerId)
  if (event.type === 'start') {
    const current = state.ownerId === event.ownerId ? state : createFinancialReadState(event.ownerId)
    if (event.generation < current.generation) return state
    return { ...current, generation: event.generation, status: 'loading', error: null }
  }
  if (event.ownerId !== state.ownerId || event.generation !== state.generation) return state
  if (event.type === 'failure') return { ...state, status: state.data ? 'stale' : 'error', error: event.error }
  if (event.type === 'success') return { ...state, data: event.data, status: 'success', error: null, updatedAt: event.updatedAt }
  return state
}
