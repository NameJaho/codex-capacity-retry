import type { PluginServerContext } from "@getpaseo/plugin/server";
import { latestFailureText } from "./server/inspect";

const CAPACITY_PATTERN = /at capacity|please try a different model/i;
const FOLLOW_UP = "继续";
const RETRY_DELAY_MS = 15_000;
// 0 means unlimited retries. Set a positive number to cap retries per
// consecutive capacity-error sequence.
const MAX_RETRIES = 0;
const TIMELINE_TAIL = 20;

export default function contribute(server: PluginServerContext) {
  const attempts = new Map<string, number>();
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const removeHook = server.on("agent.turn_ended", async (event, context) => {
    const agentId = event.agent.id;
    if (event.outcome.kind === "canceled") {
      attempts.delete(agentId);
      return;
    }

    const agent = context.paseo.agents.ref(agentId);
    const failure = event.outcome.kind === "failed" ? event.outcome.error.message : "";
    const page = await agent.timeline.refetch({ direction: "tail", limit: TIMELINE_TAIL });
    const text = `${failure}\n${latestFailureText(page.entries.map(({ item }) => item))}`;

    if (!CAPACITY_PATTERN.test(text)) {
      attempts.delete(agentId);
      return;
    }

    const attempt = (attempts.get(agentId) ?? 0) + 1;
    if (MAX_RETRIES > 0 && attempt > MAX_RETRIES) {
      console.log(`Giving up on ${agentId} after ${MAX_RETRIES} capacity retries`);
      return;
    }
    attempts.set(agentId, attempt);

    const retryLabel = MAX_RETRIES > 0 ? `${attempt}/${MAX_RETRIES}` : `${attempt}`;
    console.log(`Capacity error on ${agentId}, retry ${retryLabel} in ${RETRY_DELAY_MS}ms`);
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (context.signal.aborted) return;
      agent.send(FOLLOW_UP).catch((error: unknown) => {
        console.error(`Follow-up to ${agentId} failed`, error);
      });
    }, RETRY_DELAY_MS);
    timers.add(timer);
  });

  return () => {
    removeHook();
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
    attempts.clear();
  };
}
