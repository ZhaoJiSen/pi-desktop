import type { Translator } from './locale'
import type { DraftPlan } from './draft'

export function draftProblemMessage(plan: Extract<DraftPlan, { kind: 'error' }>, t: Translator) {
  return t(`composer.problem.${plan.problem}`, { name: plan.name })
}
