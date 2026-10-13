import { createMachine, getNextSnapshot, type AnyStateMachine } from 'xstate'
import type { Knex } from 'knex'
import type { RecordData } from '../resource/types.js'

/** Everything a step callback may read: the current record and the run facts. */
export type StepContext = {
  record: RecordData
  run: { id: string; resource: string; recordId: number; startedBy: number | null }
  db: Knex
}
export type Recipients =
  | 'creator'
  | 'submitter'
  /**
   * The members of a role, addressed by its stable key (roles.key). A role without a
   * key is still found by its display name, which administrators can rename.
   */
  | { role: string }
  | { users: number[] }
  | ((context: StepContext) => number[] | Promise<number[]>)

/** One decision an approver can take at a decision step (#42). */
export type DecisionOutcome = {
  label: string
  next: string
  /** Whether the decision needs a comment; defaults to optional. */
  comment?: 'optional' | 'required'
}

export type WorkflowStep =
  | {
      type: 'condition'
      label?: string
      when: (record: RecordData) => boolean
      then: string
      else: string
    }
  | {
      type: 'update'
      label?: string
      values: RecordData | ((context: StepContext) => RecordData)
      next: string
    }
  | {
      type: 'notify'
      label?: string
      to: Recipients
      /** A message template key; defaults to workflow.decided. */
      template?: string
      variables?: (context: StepContext) => Record<string, unknown>
      next: string
    }
  | {
      type: 'approval'
      label: string
      assignees: Recipients
      dueInDays?: number
      approve: string
      reject: string
    }
  | {
      /**
       * An approval with named outcomes, for example approve, reject and return. Each
       * outcome names its next step (a later or an earlier one) and may require a comment.
       * The submitted document stays locked: a decision never changes its fields.
       */
      type: 'decision'
      label: string
      assignees: Recipients
      dueInDays?: number
      outcomes: Record<string, DecisionOutcome>
    }
  | { type: 'delay'; label?: string; ms: number; next: string }
  | {
      type: 'http'
      label?: string
      url: string | ((context: StepContext) => string)
      body?: (context: StepContext) => unknown
      next: string
    }
  | {
      type: 'end'
      label?: string
      outcome: 'approved' | 'rejected' | 'completed'
      /** Cancel the submitted document when the workflow ends (for example on rejection). */
      cancelDocument?: boolean
    }

export type WorkflowInput = {
  /** Lower-case letters, digits and underscores, starting with a letter (for example release_approval). */
  name: string
  version: number
  resource: string
  label: string
  start: string
  /** Step names follow the workflow name rule (for example notify_approved). */
  steps: Record<string, WorkflowStep>
  /** Failed step attempts before the run stops as failed (default 5). */
  maxAttempts?: number
}
export type WorkflowDefinition = WorkflowInput & { machine: AnyStateMachine }
export type WorkflowEvent =
  | { type: 'EVALUATE'; record: RecordData }
  | { type: 'DONE' }
  | { type: 'APPROVE' }
  | { type: 'REJECT' }
  | { type: 'DECIDE'; outcome: string }

const IDENTIFIER = /^[a-z][a-z0-9_]*$/
export const WORKFLOW_NAME_RULE =
  'use lower-case letters, digits and underscores, starting with a letter'

/** Names the rule and a valid spelling, since dotted event-style names are a natural first try. */
function assertIdentifier(kind: 'workflow' | 'step', value: string) {
  if (IDENTIFIER.test(value)) return
  const suggestion = value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^[^a-z]+|_+$/g, '')
  const example = IDENTIFIER.test(suggestion)
    ? suggestion
    : kind === 'workflow'
      ? 'release_approval'
      : 'notify_approved'
  throw new Error(
    `Invalid ${kind} name "${value}": ${WORKFLOW_NAME_RULE} (for example ${example}).`
  )
}

function targets(step: WorkflowStep) {
  switch (step.type) {
    case 'condition':
      return [step.then, step.else]
    case 'approval':
      return [step.approve, step.reject]
    case 'decision':
      return Object.values(step.outcomes).map((outcome) => outcome.next)
    case 'end':
      return []
    default:
      return [step.next]
  }
}

/**
 * Declares a versioned workflow. Steps compile to an XState machine; the engine
 * performs each step's effect and asks the machine for the next step. Runs keep
 * the version they started with, so publishing a new version never changes a
 * running workflow (migrate explicitly with WorkflowEngine.migrateRuns).
 */
export function defineWorkflow(input: WorkflowInput): WorkflowDefinition {
  assertIdentifier('workflow', input.name)
  if (!Number.isInteger(input.version) || input.version < 1)
    throw new Error('Workflow version must be a positive integer')
  if (!(input.start in input.steps)) throw new Error(`Unknown start step: ${input.start}`)
  const keys = Object.keys(input.steps)
  for (const key of keys) {
    assertIdentifier('step', key)
    for (const target of targets(input.steps[key]))
      if (!(target in input.steps)) throw new Error(`Step ${key} points to unknown step ${target}`)
    const step = input.steps[key]
    if (step.type === 'delay' && (!Number.isInteger(step.ms) || step.ms < 0))
      throw new Error(`Step ${key} needs a non-negative integer delay`)
    if (step.type === 'decision') {
      const outcomes = Object.entries(step.outcomes ?? {})
      if (outcomes.length < 2) throw new Error(`Decision step ${key} needs at least two outcomes`)
      for (const [name, outcome] of outcomes) {
        if (!IDENTIFIER.test(name) || name.length > 20)
          throw new Error(
            `Invalid outcome name "${name}" in step ${key}: ${WORKFLOW_NAME_RULE}, at most 20 characters`
          )
        if (!outcome.label) throw new Error(`Outcome ${name} of step ${key} needs a label`)
      }
    }
  }
  if (!keys.some((key) => input.steps[key].type === 'end'))
    throw new Error('A workflow needs at least one end step')
  const machine = createMachine({
    id: `${input.name}@${input.version}`,
    initial: input.start,
    states: Object.fromEntries(
      keys.map((key) => {
        const step = input.steps[key]
        switch (step.type) {
          case 'condition':
            return [
              key,
              {
                on: {
                  EVALUATE: [
                    {
                      target: step.then,
                      guard: ({ event }: { event: WorkflowEvent }) =>
                        event.type === 'EVALUATE' && step.when(event.record),
                    },
                    { target: step.else },
                  ],
                },
              },
            ]
          case 'approval':
            return [key, { on: { APPROVE: step.approve, REJECT: step.reject } }]
          case 'decision':
            return [
              key,
              {
                on: {
                  DECIDE: Object.entries(step.outcomes).map(([name, outcome]) => ({
                    target: outcome.next,
                    guard: ({ event }: { event: WorkflowEvent }) =>
                      event.type === 'DECIDE' && event.outcome === name,
                  })),
                },
              },
            ]
          case 'end':
            return [key, { type: 'final' as const }]
          default:
            return [key, { on: { DONE: step.next } }]
        }
      })
    ),
  })
  return { ...input, machine }
}

/** The step reached from `current` by `event`, or an error if the step does not accept it. */
export function nextStep(definition: WorkflowDefinition, current: string, event: WorkflowEvent) {
  if (!(current in definition.steps))
    throw new Error(`Step ${current} is not part of ${definition.name}@${definition.version}`)
  const snapshot = definition.machine.resolveState({ value: current, context: {} })
  const next = getNextSnapshot(definition.machine, snapshot, event)
  const value = String(next.value)
  if (value === current) throw new Error(`Step ${current} does not accept ${event.type}`)
  return value
}
