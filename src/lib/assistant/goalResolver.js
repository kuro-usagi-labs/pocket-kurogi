import { normalizeEntityName, resolveOptionReference } from '../chatEntities'

export function resolveGoalEntities({
  text = '',
  goals = [],
} = {}) {
  const activeGoals = goals.filter((goal) =>
    String(goal?.status || 'active').toLowerCase() !== 'cancelled'
  )
  const options = activeGoals.map((goal) => ({
    id: goal.id,
    name: goal.name,
    normalizedName: normalizeEntityName(goal.name),
    goal,
  }))
  const resolution = resolveOptionReference({ input: text, options })

  if (resolution.match) {
    return [{
      id: resolution.match.id,
      name: resolution.match.name,
      goal: resolution.match.goal || resolution.match,
      confidence: 0.99,
      source: 'explicit',
      candidates: [],
    }]
  }

  if (resolution.candidates.length > 0) {
    return [{
      id: null,
      name: null,
      goal: null,
      confidence: 0,
      source: 'ambiguous',
      candidates: resolution.candidates,
    }]
  }

  return []
}
