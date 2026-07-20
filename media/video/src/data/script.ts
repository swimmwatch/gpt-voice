import type { SceneId } from './timeline.ts';

export interface NarrationReference {
  from: number;
  id: SceneId;
  text: string;
  to: number;
}

export const narrationReferences = [
  {
    from: 0,
    id: 'promptProblems',
    text: 'Writing prompts for AI agents and assistants is work. Goals can be vague. Context, constraints, examples, success criteria, and output format may be missing. Instructions can conflict. Ambiguity, grammar mistakes, filler, repetition, slow typing, translation detours, and failed recognition all break your flow.',
    to: 899,
  },
  {
    from: 900,
    id: 'productBridge',
    text: 'GPT-Voice removes that input friction—without inventing your intent.',
    to: 1139,
  },
  { from: 1140, id: 'transcription', text: 'Your prompt is ready to paste.', to: 1739 },
  {
    from: 1740,
    id: 'retry',
    text: 'If the request fails or is not processed, resend the same audio without recording again. ChatGPT Web itself does not offer that same-audio retry.',
    to: 2279,
  },
  {
    from: 2280,
    id: 'translation',
    text: 'Press F11 to translate into the language chosen for your model or task—without opening another translation tool.',
    to: 2699,
  },
  {
    from: 2700,
    id: 'prettification',
    text: 'Prettify removes grammar errors, repetition, and filler while preserving the instructions and meaning you need.',
    to: 3119,
  },
  {
    from: 3120,
    id: 'providers',
    text: 'With a ChatGPT subscription, recognition is high quality and virtually unlimited for everyday use—within your provider limits.',
    to: 3419,
  },
  { from: 3420, id: 'cta', text: 'Write better prompts—faster, with less effort.', to: 3599 },
] as const satisfies readonly NarrationReference[];
