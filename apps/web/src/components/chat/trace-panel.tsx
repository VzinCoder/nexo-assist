"use client";

import { useId, useState } from "react";
import { Check, ChevronDown, LoaderCircle, TriangleAlert } from "lucide-react";
import {
  DECISION_CONFIDENCE_LABELS,
  DECISION_INTENT_LABELS,
  type Decision,
  type DecisionConfidence,
  type TraceStep,
} from "@nexo/shared";
import { formatDuration, lowerFirst } from "./format";

/** Passo exibido como chip: gravado (`TraceStep`) ou ainda rodando durante o streaming. */
export type ChipStep = TraceStep & { running?: boolean };

const CONFIDENCE_STYLE: Record<DecisionConfidence, string> = {
  high: "bg-green/10 text-green-ink",
  medium: "bg-amber/15 text-amber-ink",
  low: "bg-danger/10 text-danger-ink",
};

/** O registro da decisão não vira chip: ele aparece como o bloco "Decisão" do painel. */
const visibleSteps = (steps: ChipStep[]) => steps.filter((step) => step.tool !== "report_decision");

/**
 * Linha "Nexo Assist ✓ consultou seus chamados ✓ …" acima da resposta (protótipo) e, ao clicar, o
 * painel com a decisão e cada passo (entrada, saída, duração e erro).
 */
export function TraceChips({
  steps,
  decision,
  author = "Nexo Assist",
  defaultOpen = false,
}: {
  steps: ChipStep[];
  decision: Decision | null;
  author?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const chips = visibleSteps(steps);
  const expandable = chips.length > 0 || decision !== null;

  const line = (
    <>
      <span className="text-[12.5px] font-semibold text-ink">{author}</span>
      {chips.map((step, index) => (
        <span
          key={`${step.tool}-${index}`}
          className={`flex items-center gap-[5px] text-[12.5px] ${step.error ? "text-danger-ink" : "text-ink-3"}`}
        >
          {step.running ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : step.error ? (
            <TriangleAlert className="h-3.5 w-3.5" aria-label="com erro" />
          ) : (
            <Check className="h-3.5 w-3.5 text-green-ink" aria-hidden="true" />
          )}
          {lowerFirst(step.label)}
        </span>
      ))}
    </>
  );

  if (!expandable) return <div className="flex flex-wrap items-center gap-x-3 gap-y-1">{line}</div>;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="group -mx-1.5 flex w-fit flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-1.5 py-0.5 text-left hover:bg-ink/[0.04] focus-visible:outline-2 focus-visible:outline-cta"
      >
        {line}
        <span className="flex items-center gap-0.5 text-[12px] text-ink-3 group-hover:text-ink">
          {open ? "ocultar" : "por quê?"}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </span>
      </button>
      {open ? <TracePanel id={panelId} steps={chips} decision={decision} /> : null}
    </div>
  );
}

function TracePanel({ id, steps, decision }: { id: string; steps: ChipStep[]; decision: Decision | null }) {
  return (
    <section
      id={id}
      aria-label="Como o assistente decidiu"
      className="w-full max-w-[600px] overflow-hidden rounded-xl bg-paper outline outline-1 -outline-offset-[0.5px] outline-ink/[0.09]"
    >
      <div className="px-4 py-3.5">
        {decision ? (
          <dl className="grid grid-cols-[88px_1fr] gap-x-4 gap-y-2 text-[13.5px]/5">
            <dt className="text-ink-3">Entendeu</dt>
            <dd className="font-medium text-ink">{DECISION_INTENT_LABELS[decision.intent]}</dd>
            <dt className="text-ink-3">Fez</dt>
            <dd className="text-ink">{decision.action}</dd>
            <dt className="text-ink-3">Confiança</dt>
            <dd>
              <span
                className={`inline-flex items-center rounded-md px-2 py-0.5 text-[12.5px] font-semibold ${CONFIDENCE_STYLE[decision.confidence]}`}
              >
                {DECISION_CONFIDENCE_LABELS[decision.confidence]} confiança
              </span>
            </dd>
            <dt className="text-ink-3">Por quê</dt>
            <dd className="text-ink-2">{decision.reason}</dd>
          </dl>
        ) : (
          <p className="text-[13.5px] text-ink-3">Nenhuma decisão registrada nesta resposta.</p>
        )}
      </div>

      {steps.length > 0 ? (
        <ol className="border-t border-rule">
          {steps.map((step, index) => (
            <li key={`${step.tool}-${index}`} className="border-t border-rule px-4 py-3 first:border-t-0">
              <div className="flex items-baseline justify-between gap-3">
                <p className={`text-[13.5px] font-medium ${step.error ? "text-danger-ink" : "text-ink"}`}>
                  {step.label}
                  <span className="ml-2 text-[12px] font-normal text-ink-3">{step.tool}</span>
                </p>
                <span className="shrink-0 text-[12px] tabular-nums text-ink-3">
                  {step.running ? "em andamento" : formatDuration(step.durationMs)}
                </span>
              </div>
              {step.error ? (
                <p className="mt-1.5 flex items-start gap-1.5 rounded-md bg-danger/[0.06] px-2.5 py-1.5 text-[12.5px] text-danger-ink">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {step.error}
                </p>
              ) : null}
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Payload title="Entrada" value={step.input} />
                <Payload title="Saída" value={step.running ? "…" : step.output} />
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function Payload({ title, value }: { title: string; value: unknown }) {
  const text = value === null || value === undefined ? "—" : typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[12px] text-ink-3">{title}</p>
      <pre className="max-h-48 overflow-auto rounded-md bg-desk px-2.5 py-2 font-mono text-[11.5px]/[17px] whitespace-pre-wrap break-words text-ink-2">
        {text}
      </pre>
    </div>
  );
}
