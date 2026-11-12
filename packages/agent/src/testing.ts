import { MastraLanguageModelV2Mock } from "@mastra/core/test-utils/llm-mock";

/**
 * Modelo falso roteirizado para testes (nunca chama o provedor real). Cada passo do roteiro é
 * uma resposta do modelo: chamadas de tool ou texto. Depois do roteiro, repete o último passo.
 */
export type ScriptStep =
  | { toolCalls: { name: string; args: Record<string, unknown> }[]; text?: string }
  | { text: string }
  | { error: unknown };

type StreamPart = Record<string, unknown> & { type: string };

function partsFor(step: ScriptStep, index: number): StreamPart[] {
  const parts: StreamPart[] = [
    { type: "stream-start", warnings: [] },
    { type: "response-metadata", id: `resp-${index}`, modelId: "mock-model", timestamp: new Date(0) },
  ];
  if ("error" in step) return parts;
  const text = step.text;
  if (text) {
    parts.push({ type: "text-start", id: `t-${index}` });
    for (const chunk of text.match(/.{1,12}/gs) ?? []) parts.push({ type: "text-delta", id: `t-${index}`, delta: chunk });
    parts.push({ type: "text-end", id: `t-${index}` });
  }
  const calls = "toolCalls" in step ? step.toolCalls : [];
  calls.forEach((call, callIndex) => {
    parts.push({
      type: "tool-call",
      toolCallId: `call-${index}-${callIndex}`,
      toolName: call.name,
      input: JSON.stringify(call.args),
    });
  });
  parts.push({
    type: "finish",
    finishReason: calls.length > 0 ? "tool-calls" : "stop",
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
  });
  return parts;
}

export function createScriptedModel(script: ScriptStep[]) {
  let calls = 0;
  const prompts: unknown[] = [];
  const model = new MastraLanguageModelV2Mock({
    doStream: async (options) => {
      prompts.push(options.prompt);
      const index = Math.min(calls, script.length - 1);
      calls++;
      const step = script[index];
      if (!step) throw new Error("roteiro vazio");
      if ("error" in step) throw step.error;
      const parts = partsFor(step, index);
      return {
        stream: new ReadableStream({
          start(controller) {
            for (const part of parts) controller.enqueue(part);
            controller.close();
          },
        }),
      } as never;
    },
  });
  return {
    model,
    /** Quantas vezes o modelo foi chamado (passos). */
    get calls() {
      return calls;
    },
    /** Prompts recebidos (para verificar o contexto enviado). */
    prompts,
  };
}
