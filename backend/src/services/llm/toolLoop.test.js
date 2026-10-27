import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runToolLoop } from './toolLoop.js';

test('adds a tool reply for every call after the tool-call limit is reached', async () => {
  const toolCallIds = ['call-over-limit-1', 'call-over-limit-2'];
  const callLimit = Number.parseInt(process.env.AI_TOOL_MAX_CALLS || '5', 10);
  let plannerCall = 0;
  let plannerToolReplies;
  let executedToolCount = 0;

  const result = await runToolLoop({
    messages: [{ role: 'user', content: '分析帖子' }],
    initialToolCallCount: callLimit,
    writeEvent: () => {},
    toolExecutor: async () => {
      executedToolCount += 1;
      return { ok: true };
    },
    llmCall: async ({ messages, stream }) => {
      if (stream) {
        return { stream: new ReadableStream({ start: (controller) => controller.close() }) };
      }

      plannerCall += 1;
      if (plannerCall === 1) {
        return {
          data: {
            choices: [{
              message: {
                tool_calls: toolCallIds.map((id) => ({
                  id,
                  type: 'function',
                  function: { name: 'get_post', arguments: '{"postId":"p"}' },
                })),
              },
            }],
          },
        };
      }

      plannerToolReplies = messages
        .filter((message) => message.role === 'tool')
        .map((message) => message.tool_call_id);
      return { data: { choices: [{ message: { content: '__NO_TOOL__' } }] } };
    },
  });

  assert.deepEqual(plannerToolReplies, toolCallIds);
  assert.equal(executedToolCount, 0);
  assert.equal(result.toolCallCount, callLimit + toolCallIds.length);
});
