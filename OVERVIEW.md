Automatically retries a turn that ended with a provider capacity error, so you do not have to type a follow-up yourself.

When a turn ends, the plugin reads the turn outcome and the tail of the agent timeline. If the failure message, or an error or notification item from that turn, matches `at capacity` or `please try a different model`, it waits 15 seconds and sends `继续` to that agent.

Each agent gets at most 5 consecutive retries. The counter resets as soon as a turn ends without a capacity match, and a canceled turn clears it too. The delay and the limit are constants in `index.server.ts`; edit them and reload the plugin to change the behavior.

The retry sends a new message. It does not replay attachments from the failed turn or undo tool effects. Assistant text and reasoning are never inspected, so an agent that merely writes about a capacity message does not trigger a retry, and neither does your own prompt.

Requires Paseo 0.13.2 or later. It uses no network services and no credentials.
