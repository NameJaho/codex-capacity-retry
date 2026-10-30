import type { AgentTimelineItem } from "@getpaseo/protocol/agent-types";

/**
 * Only error and notification items count. Assistant prose and reasoning are excluded
 * because an agent that merely discusses a capacity message has not hit one, and
 * provider text arrives split across chunks that would match a phrase mid-sentence.
 */
export function latestFailureText(items: readonly AgentTimelineItem[]): string {
  const lastPrompt = items.findLastIndex((item) => item.type === "user_message");
  const parts: string[] = [];
  for (const item of items.slice(lastPrompt + 1)) {
    if (item.type === "error" || item.type === "notification") {
      parts.push(item.message);
    }
  }
  return parts.join("\n");
}
