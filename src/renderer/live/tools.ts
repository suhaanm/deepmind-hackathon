// Live tool declarations exposed to gemini-3.8-live. Names and args mirror ToolArgSchemas in src/shared/protocol.ts;
// each call is forwarded over IPC live:toolCall to src/main/tools/dispatcher.ts (zod validates there).
import type { FunctionDeclaration, Scheduling } from './wire'

const NB = 'NON_BLOCKING' as const

export const LIVE_TOOLS: FunctionDeclaration[] = [
  {
    name: 'point_at',
    behavior: NB,
    description:
      'Draws an arrow and ring on the learner\'s real screen at one on-screen element. Call it the moment you tell the learner to look at, click or find something visible, in the same breath as speaking. ' +
      'Returns found=false when the element cannot be located: then say you cannot see it and ask the learner to describe or scroll; never guess. Arrows are guidance only and never click anything.',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'Purely visual description of the element, e.g. "the green Start call button at the bottom of the video window". Include its label text if it has one.' },
        step: { type: 'integer', description: 'Optional lesson step number to show as a numbered badge.' },
      },
      required: ['target'],
    },
  },
  {
    name: 'start_lesson',
    behavior: NB,
    description:
      'Starts a guided lesson for the learner\'s goal. Call it once, when the learner asks to be taught or helped with a task you can break into steps (joining a video call, checking a suspicious message, making text bigger). ' +
      'The lesson runner then sends you [RUNNER] stage directions for each step; follow them. Do not call it again while a lesson is running.',
    parameters: {
      type: 'object',
      properties: { goal: { type: 'string', description: 'The learner\'s goal in plain words, e.g. "join my video call with my daughter".' } },
      required: ['goal'],
    },
  },
  {
    name: 'step_done',
    behavior: NB,
    description:
      'Tells the lesson runner the learner says they finished the current step. Call it only when the learner clearly says they are done ("done", "I clicked it"). ' +
      'Never call it because you assume it happened: verification decides.',
    parameters: {
      type: 'object',
      properties: { note: { type: 'string', description: 'Optional: what the learner said.' } },
    },
  },
  {
    name: 'verify_step',
    behavior: NB,
    description:
      'Looks at a fresh full-resolution screenshot and checks whether the current step really happened. Call it after the learner says they are done, or when they ask "did I do it right?". ' +
      'Returns a verdict; say what you saw, then move on or repair using nextHint. If uncertain is true, say you cannot be sure.',
    parameters: {
      type: 'object',
      properties: { expected_outcome: { type: 'string', description: 'What the screen should look like if the step is complete.' } },
      required: ['expected_outcome'],
    },
  },
  {
    name: 'set_help_level',
    behavior: NB,
    description:
      'Advises the help level for this learner: 1 watch me, 2 walk with me, 3 nudge me, 4 on my own. Call it only when the learner explicitly asks for more or less help ("show me again", "let me try"). The app may overrule you.',
    parameters: {
      type: 'object',
      properties: {
        level: { type: 'integer', description: '1 to 4.', minimum: 1, maximum: 4 },
        reason: { type: 'string', description: 'Short reason in the learner\'s words.' },
      },
      required: ['level'],
    },
  },
  {
    name: 'spawn_agent',
    behavior: NB,
    description:
      'Starts a background helper and returns straight away; its result arrives later as an [AGENT_RESULT] message that you then explain in plain words. ' +
      'Use scam_check when the learner asks whether a message, email, text or page is a scam or genuine (set payload.useScreen=true to read what is on screen). Use lookup for a factual question you cannot answer from the screen. Use lesson_summary only at the end of a lesson. ' +
      'Tell the learner you are checking, then keep talking naturally.',
    parameters: {
      type: 'object',
      properties: {
        kind: { type: 'string', description: 'Which helper to run.', enum: ['scam_check', 'lookup', 'lesson_summary'] },
        task: { type: 'string', description: 'One plain sentence describing what to check or find.' },
        payload: {
          type: 'object',
          description: 'Optional extra material for the helper.',
          properties: {
            text: { type: 'string', description: 'Message text to analyse, if the learner read it out.' },
            url: { type: 'string', description: 'A web address to check.' },
            useScreen: { type: 'boolean', description: 'True to analyse what is currently on screen.' },
          },
        },
      },
      required: ['kind', 'task'],
    },
  },
  {
    // The only BLOCKING tool: the model must wait for a real click in the dock; approval can never come from model text.
    name: 'ask_user_confirm',
    behavior: 'BLOCKING',
    description:
      'Asks the learner to choose between two options with a real on-screen button press. Call it before anything that is hard to undo or that the learner has not clearly asked for. ' +
      'You can never answer for the learner. Returns {choice}; choice is null if they dismissed it.',
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'One short plain question, at most 500 characters.' },
        options: { type: 'array', description: 'Exactly two short button labels.', items: { type: 'string' }, minItems: 2, maxItems: 2 },
      },
      required: ['question', 'options'],
    },
  },
  {
    name: 'update_profile',
    behavior: NB,
    description:
      'Saves one short note about what works for this learner (for example "likes a worked example first" or "gets lost with the word browser"). Call it when you learn something durable about how they learn. Never store passwords, card numbers or secrets.',
    parameters: {
      type: 'object',
      properties: { note: { type: 'string', description: 'One short factual note.' } },
      required: ['note'],
    },
  },
  {
    name: 'end_lesson',
    behavior: NB,
    description:
      'Ends the current lesson. Call it after the teach-back, once the learner has rephrased what they did and you have scored it from 0 (not at all) to 1 (fully correct).',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'One or two plain sentences on what the learner can now do.' },
        teachBackScore: { type: 'number', description: '0 to 1.', minimum: 0, maximum: 1 },
      },
      required: ['summary'],
    },
  },
  {
    name: 'clear_annotations',
    behavior: NB,
    description: 'Removes every arrow, ring and badge from the learner\'s screen. Call it when the learner says it is in the way, or when you move to a new topic.',
  },
]

export const LIVE_TOOL_NAMES: readonly string[] = LIVE_TOOLS.map((t) => t.name)

export function isBlockingTool(name: string): boolean {
  return LIVE_TOOLS.find((t) => t.name === name)?.behavior === 'BLOCKING'
}

// How the model should treat a tool result (NON_BLOCKING tools only; ignored for BLOCKING ones).
// SILENT: keep it as context, do not speak (the model is already narrating). WHEN_IDLE: speak after the current sentence.
// INTERRUPT: the model must react now (a failed lookup, a failed verification).
export function schedulingFor(name: string, result: unknown): Scheduling | undefined {
  if (isBlockingTool(name)) return undefined
  const err = typeof result === 'object' && result !== null && 'error' in result
  if (err) return 'WHEN_IDLE'
  const r = (typeof result === 'object' && result !== null ? result : {}) as Record<string, unknown>
  switch (name) {
    case 'point_at':
      return r.found === false ? 'INTERRUPT' : 'SILENT'
    case 'verify_step':
      return 'WHEN_IDLE'
    case 'spawn_agent':
      return 'SILENT'
    case 'start_lesson':
      return 'SILENT'
    default:
      return 'SILENT'
  }
}
