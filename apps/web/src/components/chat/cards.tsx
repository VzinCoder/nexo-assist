"use client";

import { useState, type ReactNode } from "react";
import { CircleAlert, LoaderCircle, TriangleAlert, WifiOff } from "lucide-react";
import {
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_TYPE_LABELS,
  type ChatPart,
  type DraftView,
  type TicketCard as TicketCardData,
} from "@nexo/shared";
import { AFFECTED_CARD_LABELS, PRIORITY_DOT, STATUS_DOT, formatAgo, formatDateTime, formatDayMonth, formatDue } from "./format";

const CARD = "w-full overflow-hidden rounded-2xl bg-paper shadow-[0_1px_2px_#1B24310D,0_6px_18px_#1B24310A] outline outline-1 -outline-offset-[0.5px] outline-ink/[0.09]";

function Dot({ className }: { className: string }) {
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${className}`} aria-hidden="true" />;
}

function Eyebrow({ kind, id, right }: { kind: string; id: string; right: ReactNode }) {
  return (
    <div className="flex items-center gap-2 pb-0.5 text-[12.5px]">
      <span className="font-medium text-ink-3">{kind}</span>
      <span className="h-[3px] w-[3px] rounded-full bg-rule" aria-hidden="true" />
      <span className="text-ink-3">{id}</span>
      <span className="flex-1" />
      {right}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <dt className="text-[12.5px] text-ink-3">{label}</dt>
      <dd className="flex flex-wrap items-center gap-1.5 text-[14.5px] font-medium text-ink">{children}</dd>
    </div>
  );
}

export function OverdueSeal() {
  return (
    <span className="rounded-md bg-danger/10 px-1.5 py-0.5 text-[12px] font-semibold text-danger-ink">Vencido</span>
  );
}

/** Card de chamado ("Chat — Consulta e transferência"). */
export function TicketCard({ ticket }: { ticket: TicketCardData }) {
  return (
    <article className={CARD} aria-label={`Chamado ${ticket.id}`}>
      <div className="flex flex-col gap-1.5 px-[18px] pb-3.5 pt-4">
        <Eyebrow
          kind="Chamado"
          id={ticket.id}
          right={
            <span className="flex items-center gap-2">
              {ticket.isOverdue ? <OverdueSeal /> : null}
              <span className="flex items-center gap-1.5">
                <Dot className={STATUS_DOT[ticket.status]} />
                <span className={`font-medium ${ticket.status === "waiting_analyst" ? "text-amber-ink" : "text-ink-3"}`}>
                  {TICKET_STATUS_LABELS[ticket.status]}
                </span>
              </span>
            </span>
          }
        />
        <h3 className="text-[18px]/[23px] font-semibold tracking-[-0.2px] text-ink">{ticket.title}</h3>
        {ticket.description ? <p className="line-clamp-3 text-[13.5px]/5 text-ink-2">{ticket.description}</p> : null}
      </div>
      <dl className="mx-[18px] mb-4 flex flex-wrap gap-x-6 gap-y-3 border-t border-rule pt-3">
        <Field label="Categoria">{TICKET_CATEGORY_LABELS[ticket.category]}</Field>
        <Field label="Prioridade">
          <Dot className={PRIORITY_DOT[ticket.priority]} />
          {TICKET_PRIORITY_LABELS[ticket.priority]}
        </Field>
        <Field label="Aberto em">{formatDateTime(ticket.createdAt)}</Field>
        <Field label={ticket.isOverdue ? "Prazo" : "Próximo prazo"}>
          {ticket.isOverdue ? (
            <>
              <span className="text-amber-ink">venceu {formatAgo(ticket.dueAt)}</span>
              <span className="text-[13.5px] font-normal text-ink-3">· prazo vencido</span>
            </>
          ) : ticket.status === "resolved" || ticket.status === "closed" ? (
            <span className="text-ink-3">encerrado</span>
          ) : (
            <>até {formatDue(ticket.dueAt)}</>
          )}
        </Field>
      </dl>
    </article>
  );
}

/** Lista selecionável de chamados; escolher envia "ID · título" como mensagem. */
export function TicketPicker({
  tickets,
  onPick,
  disabled,
}: {
  tickets: TicketCardData[];
  onPick: (text: string) => void;
  disabled: boolean;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className={CARD} role="radiogroup" aria-label="Escolha um chamado">
      {tickets.map((ticket, index) => {
        const selected = picked === ticket.id;
        return (
          <button
            key={ticket.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => {
              setPicked(ticket.id);
              onPick(`${ticket.id} · ${ticket.title}`);
            }}
            className={`flex min-h-[46px] w-full items-center gap-3.5 px-4 py-2 text-left transition-colors enabled:hover:bg-cta/[0.04] disabled:cursor-default ${
              index > 0 ? "border-t border-rule" : ""
            } ${selected ? "bg-cta/[0.04]" : ""}`}
          >
            <span
              className={`h-4 w-4 shrink-0 rounded-full bg-paper ${selected ? "border-[5px] border-cta" : "border-[1.5px] border-ink/20"}`}
              aria-hidden="true"
            />
            <span className="w-[72px] shrink-0 text-[12.5px] font-medium text-ink-3">{ticket.id}</span>
            <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium text-ink">{ticket.title}</span>
            {ticket.isOverdue ? <OverdueSeal /> : null}
            <span className="hidden items-center gap-1.5 text-[12.5px] text-ink-3 sm:flex">
              <Dot className={STATUS_DOT[ticket.status]} />
              {TICKET_STATUS_LABELS[ticket.status]}
            </span>
            <span className="w-11 shrink-0 text-right text-[12.5px] text-ink-3">{formatDayMonth(ticket.createdAt)}</span>
          </button>
        );
      })}
    </div>
  );
}

const DRAFT_KIND_LABELS: Record<DraftView["kind"], string> = {
  create: "Novo chamado",
  comment: "Complemento",
  reopen: "Reabertura",
};

export type DraftAction = "confirm" | "discard";

/** Card de rascunho com Confirmar/Descartar ("Chat — Novo chamado"). */
export function DraftCard({
  draft,
  onAction,
}: {
  draft: DraftView | undefined;
  onAction: (draftId: string, action: DraftAction) => Promise<string | null>;
}) {
  const [busy, setBusy] = useState<DraftAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!draft) {
    return <div className={`${CARD} px-[18px] py-4 text-[13.5px] text-ink-3`}>Rascunho indisponível.</div>;
  }

  const pending = draft.status === "pending" || draft.status === "confirming";
  const run = async (action: DraftAction) => {
    setBusy(action);
    setError(null);
    const failure = await onAction(draft.id, action);
    setError(failure);
    setBusy(null);
  };

  const state =
    draft.status === "confirmed" ? (
      <span className="flex items-center gap-1.5">
        <Dot className="bg-green" />
        <span className="font-medium text-green-ink">Confirmado{draft.ticketId ? ` · ${draft.ticketId}` : ""}</span>
      </span>
    ) : draft.status === "discarded" ? (
      <span className="flex items-center gap-1.5">
        <Dot className="bg-ink/30" />
        <span className="font-medium text-ink-3">Descartado</span>
      </span>
    ) : (
      <span className="flex items-center gap-1.5">
        <Dot className="bg-amber" />
        <span className="font-medium text-amber-ink">Aguardando confirmação</span>
      </span>
    );

  const isCreate = draft.kind === "create";
  const title = isCreate ? draft.payload.title : `${draft.payload.ticketId} · ${draft.payload.ticketTitle}`;
  const description = isCreate ? draft.payload.description : draft.payload.text;

  return (
    <article className={`${CARD} ${draft.status === "discarded" ? "opacity-70" : ""}`} aria-label={`Rascunho: ${title}`}>
      <div className="flex flex-col gap-1.5 px-[18px] pb-3.5 pt-4">
        <Eyebrow kind={DRAFT_KIND_LABELS[draft.kind]} id={`Rascunho ${draft.id.slice(0, 4).toUpperCase()}`} right={state} />
        <h3 className="text-[18px]/[23px] font-semibold tracking-[-0.2px] text-ink">{title}</h3>
        <p className="whitespace-pre-line text-[13.5px]/5 text-ink-2">{description}</p>
      </div>
      {isCreate ? (
        <dl className="mx-[18px] mb-4 flex flex-wrap gap-x-6 gap-y-3 border-t border-rule pt-3">
          <Field label="Tipo">{TICKET_TYPE_LABELS[draft.payload.type]}</Field>
          <Field label="Categoria">{TICKET_CATEGORY_LABELS[draft.payload.category]}</Field>
          <Field label="Prioridade">
            <Dot className={PRIORITY_DOT[draft.payload.priority]} />
            {TICKET_PRIORITY_LABELS[draft.payload.priority]}
            <span className="text-[13.5px] font-normal text-ink-3">
              · resposta até {formatDue(draft.payload.dueAt)} ({draft.payload.slaLabel})
            </span>
          </Field>
          <Field label="Afetados">{AFFECTED_CARD_LABELS[draft.payload.affected]}</Field>
        </dl>
      ) : null}
      {pending ? (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-rule bg-desk py-2 pl-2 pr-3.5">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void run("confirm")}
            className="flex h-9 items-center gap-2 rounded-lg bg-cta px-3.5 text-[13.5px] font-semibold text-white hover:bg-[#0057ad] disabled:opacity-70"
          >
            {busy === "confirm" ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {busy === "confirm" ? "Confirmando…" : "Confirmar"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void run("discard")}
            className="flex h-9 items-center rounded-lg px-3.5 text-[13.5px] font-medium text-ink-2 hover:bg-ink/[0.05] disabled:opacity-60"
          >
            Descartar
          </button>
          {error ? (
            <p role="alert" className="flex items-center gap-1.5 pl-2 text-[12.5px] text-danger-ink">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/** Opções rápidas numeradas; desabilitadas em respostas antigas. */
export function QuickOptions({
  question,
  options,
  onPick,
  disabled,
}: {
  question: string;
  options: string[];
  onPick: (text: string) => void;
  disabled: boolean;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[14.5px] font-semibold text-ink">{question}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option, index) => (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => {
              setPicked(option);
              onPick(option);
            }}
            className={`flex items-center gap-[7px] rounded-lg px-3 py-[7px] text-[13.5px] font-medium outline outline-1 -outline-offset-[0.5px] transition-colors disabled:cursor-default ${
              picked === option
                ? "bg-info/[0.07] text-link outline-info"
                : "bg-paper text-ink outline-rule enabled:hover:outline-info/60 disabled:text-ink-3"
            }`}
          >
            <span className="text-[12px] tabular-nums text-ink-3">{index + 1}</span>
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

type NoticeTone = "warning" | "error";
type NoticeCode = Extract<ChatPart, { type: "notice" }>["code"] | "network" | "generic";

const NOTICES: Record<NoticeCode, { title: string; body: string; tone: NoticeTone }> = {
  tickets_unavailable: {
    title: "Sistema de chamados indisponível",
    body: "Não consegui consultar ou registrar chamados agora. Tente de novo em alguns minutos.",
    tone: "warning",
  },
  provider_rate_limited: {
    title: "Muitas requisições no momento",
    body: "O assistente atingiu o limite do provedor. Tente em instantes; sua mensagem ficou salva.",
    tone: "warning",
  },
  provider_unavailable: {
    title: "Assistente indisponível",
    body: "O provedor do modelo não respondeu. Tente de novo em instantes ou fale com um analista.",
    tone: "warning",
  },
  not_configured: {
    title: "Assistente não configurado",
    body: "Falta a chave do modelo neste ambiente. O histórico continua disponível.",
    tone: "error",
  },
  network: {
    title: "Sem conexão com o servidor",
    body: "Verifique sua rede e envie a mensagem de novo.",
    tone: "error",
  },
  generic: { title: "Algo deu errado", body: "Não foi possível concluir. Tente novamente.", tone: "error" },
};

export function Notice({ code, message }: { code: NoticeCode; message?: string }) {
  const notice = NOTICES[code];
  const Icon = code === "network" ? WifiOff : notice.tone === "warning" ? TriangleAlert : CircleAlert;
  return (
    <div
      role="status"
      className={`flex w-full max-w-[600px] items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13.5px]/5 outline outline-1 -outline-offset-[0.5px] ${
        notice.tone === "warning" ? "bg-amber/[0.08] text-amber-ink outline-amber/30" : "bg-danger/[0.06] text-danger-ink outline-danger/25"
      }`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>
        <p className="font-semibold">{notice.title}</p>
        <p className="text-ink-2">{message ?? notice.body}</p>
      </div>
    </div>
  );
}

export type { NoticeCode };
