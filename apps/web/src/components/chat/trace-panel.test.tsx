import { MISSING_DECISION } from "@nexo/agent";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AssistantMessage } from "./messages";
import { streamingSteps } from "./streaming";
import { TraceChips } from "./trace-panel";

const errorStep = {
  tool: "list_my_tickets",
  label: "Consultou seus chamados",
  input: { status: "open" },
  output: null,
  durationMs: 1532,
  error: "Sistema de chamados indisponível no momento.",
};

const noop = {
  active: true,
  drafts: {},
  onSend: () => undefined,
  onDraftAction: async () => null,
};

describe("TraceChips", () => {
  it("passo com erro aparece destacado no chip e no painel", () => {
    const html = renderToStaticMarkup(<TraceChips steps={[errorStep]} decision={null} defaultOpen />);
    expect(html).toContain("consultou seus chamados");
    expect(html).toContain('aria-label="com erro"');
    expect(html).toContain("Sistema de chamados indisponível no momento.");
    expect(html).toContain("1,5 s");
    expect(html).toContain("&quot;status&quot;: &quot;open&quot;");
    expect(html).toContain("Nenhuma decisão registrada");
  });

  it("decisão sintética: intent em português, badge Baixa confiança e motivo", () => {
    const html = renderToStaticMarkup(<TraceChips steps={[]} decision={MISSING_DECISION} defaultOpen />);
    expect(html).toContain("Outro");
    expect(html).toContain("Baixa confiança");
    expect(html).toContain(MISSING_DECISION.reason);
  });

  it("decisão registrada mostra Alta/Média e não vira chip", () => {
    const html = renderToStaticMarkup(
      <TraceChips
        steps={[{ ...errorStep, tool: "report_decision", label: "Registrou a decisão", error: undefined }]}
        decision={{ intent: "ticket_status", action: "Listou", confidence: "medium", reason: "Pediu status." }}
        defaultOpen
      />,
    );
    expect(html).toContain("Status de chamado");
    expect(html).toContain("Média confiança");
    expect(html).not.toContain("registrou a decisão");
  });

  it("começa recolhido, com o botão para ver o porquê", () => {
    const html = renderToStaticMarkup(<TraceChips steps={[errorStep]} decision={MISSING_DECISION} />);
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("por quê?");
    expect(html).not.toContain("Baixa confiança");
  });
});

describe("AssistantMessage", () => {
  it("confiança baixa sem transferência oferece 'Falar com um analista'", () => {
    const html = renderToStaticMarkup(
      <AssistantMessage content="Não tenho certeza." parts={[]} steps={[]} decision={MISSING_DECISION} interaction={noop} />,
    );
    expect(html).toContain("Falar com um analista");
  });

  it("depois de transferir não oferece de novo", () => {
    const html = renderToStaticMarkup(
      <AssistantMessage
        content="Transferi."
        parts={[{ type: "handoff", reason: "Pedido" }]}
        steps={[]}
        decision={MISSING_DECISION}
        interaction={noop}
      />,
    );
    expect(html).not.toContain("Falar com um analista");
  });
});

describe("streamingSteps", () => {
  it("usa o trace da tool quando a saída chega e marca rodando antes disso", () => {
    const steps = streamingSteps([
      { type: "text", text: "oi" },
      { type: "tool-list_my_tickets", state: "input-available", input: {} },
      {
        type: "dynamic-tool",
        toolName: "get_ticket",
        state: "output-available",
        input: { ticketId: "INC-20311" },
        output: { ok: true, data: {}, trace: { ...errorStep, tool: "get_ticket", label: "Abriu o chamado INC-20311", error: undefined } },
      },
    ]);
    expect(steps).toEqual([
      expect.objectContaining({ tool: "list_my_tickets", label: "Consultou seus chamados", running: true }),
      expect.objectContaining({ tool: "get_ticket", label: "Abriu o chamado INC-20311" }),
    ]);
  });
});
