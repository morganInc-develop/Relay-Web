const BLOCKED_PATTERNS = [
  /ignore\s+(previous|prior|all)\s+instructions/i,
  /you\s+are\s+now/i,
  /forget\s+(your|all)\s+instructions/i,
  /system\s+prompt/i,
  /reveal\s+(your|the)\s+(system|prompt|instructions)/i,
  /what\s+(are|were)\s+your\s+instructions/i,
  /override\s+(your|the)\s+instructions/i,
  /disregard\s+(your|all|the)\s+instructions/i,
  /act\s+as\s+/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /jailbreak/i,
  /\bdan\s+mode\b/i,
  /\bdeveloper\s+mode\b/i,
  /\[system\]/i,
  /\[user\]/i,
  /\[assistant\]/i,
]

export class SanitizationError extends Error {
  constructor(message = "Message blocked for safety. Please rephrase your request.") {
    super(message)
    this.name = "SanitizationError"
  }
}

export function sanitizeUserInput(input: string): string {
  const trimmed = input.trim().slice(0, 1000)

  if (!trimmed) {
    throw new SanitizationError("Message cannot be empty.")
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      throw new SanitizationError()
    }
  }

  return trimmed
}
