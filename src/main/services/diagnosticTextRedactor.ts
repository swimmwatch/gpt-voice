export const DIAGNOSTIC_REDACTOR_VERSION = 1;
export const DIAGNOSTIC_REDACTION_REPLACEMENT = '[REDACTED]';

interface RedactionRule {
  readonly pattern: RegExp;
  readonly replace: (match: string, ...captures: string[]) => string;
}

export interface DiagnosticTextRedactionResult {
  readonly redactionCount: number;
  readonly redactorVersion: number;
  readonly text: string;
}

const preservePrefix = (_match: string, prefix: string): string => `${prefix}${DIAGNOSTIC_REDACTION_REPLACEMENT}`;

const REDACTION_RULES: readonly RedactionRule[] = [
  {
    pattern:
      /-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/gu,
    replace: () => DIAGNOSTIC_REDACTION_REPLACEMENT,
  },
  {
    pattern: /^(\s*(?:proxy-authorization|authorization)\s*:\s*)\S[^\r\n]*/gimu,
    replace: preservePrefix,
  },
  {
    pattern: /^(\s*(?:set-cookie|cookie)\s*:\s*)\S[^\r\n]*/gimu,
    replace: preservePrefix,
  },
  {
    pattern:
      /([?&](?:password|passwd|api[-_]key|access[-_]token|refresh[-_]token|authorization|secret|cookie)=)[^&#\s]+/giu,
    replace: preservePrefix,
  },
  {
    pattern: /(\b[a-z][a-z0-9+.-]{1,31}:\/\/)[^/\s:@]{1,1024}:[^/@\s]{1,1024}(?=@)/giu,
    replace: preservePrefix,
  },
  {
    pattern:
      /("?(?:password|passwd|api[-_]key|access[-_]token|refresh[-_]token|authorization|secret|cookie)"?\s*[:=]\s*")(?!\[REDACTED\])[^"\r\n]+(?=")/giu,
    replace: preservePrefix,
  },
  {
    pattern:
      /('?(?:password|passwd|api[-_]key|access[-_]token|refresh[-_]token|authorization|secret|cookie)'?\s*[:=]\s*')(?!\[REDACTED\])[^'\r\n]+(?=')/giu,
    replace: preservePrefix,
  },
  {
    pattern:
      /(["']?(?:password|passwd|api[-_]key|access[-_]token|refresh[-_]token|authorization|secret|cookie)["']?\s*[:=]\s*)[^\s&,;}"'[\]]+/giu,
    replace: preservePrefix,
  },
  {
    pattern: /(\bBearer\s+)[\w.~+/=-]{8,4096}/giu,
    replace: preservePrefix,
  },
  {
    pattern: /(\bBasic\s+)[\w+/=]{8,4096}/giu,
    replace: preservePrefix,
  },
  {
    pattern: /\b[\w-]{2,2048}\.[\w-]{2,4096}\.[\w-]{2,4096}\b/gu,
    replace: () => DIAGNOSTIC_REDACTION_REPLACEMENT,
  },
  {
    pattern: /\bsk-[\w-]{16,256}\b/gu,
    replace: () => DIAGNOSTIC_REDACTION_REPLACEMENT,
  },
  {
    pattern: /\bAIza[\w-]{20,128}\b/gu,
    replace: () => DIAGNOSTIC_REDACTION_REPLACEMENT,
  },
  {
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_\w{20,255}\b/gu,
    replace: () => DIAGNOSTIC_REDACTION_REPLACEMENT,
  },
  {
    pattern: /\bgithub_pat_\w{20,255}\b/gu,
    replace: () => DIAGNOSTIC_REDACTION_REPLACEMENT,
  },
  {
    pattern: /\bxox[baprs]-[\w-]{10,255}\b/gu,
    replace: () => DIAGNOSTIC_REDACTION_REPLACEMENT,
  },
  {
    pattern: /\bAKIA[A-Z0-9]{16}\b/gu,
    replace: () => DIAGNOSTIC_REDACTION_REPLACEMENT,
  },
] as const;

/** Applies deterministic, bounded best-effort credential redaction to captured diagnostic text. */
export class DiagnosticTextRedactor {
  public readonly version = DIAGNOSTIC_REDACTOR_VERSION;

  public redact(input: string): DiagnosticTextRedactionResult {
    let redactionCount = 0;
    let text = input;

    for (const rule of REDACTION_RULES) {
      rule.pattern.lastIndex = 0;
      text = text.replace(rule.pattern, (match: string, ...captures: string[]) => {
        redactionCount += 1;
        return rule.replace(match, ...captures);
      });
    }

    return {
      redactionCount,
      redactorVersion: this.version,
      text,
    };
  }
}
