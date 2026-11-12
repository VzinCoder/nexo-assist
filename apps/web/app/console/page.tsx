import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { PRODUCT_NAME } from "@nexo/shared";
import { EMPLOYEE_ROLE_LABELS } from "@nexo/shared";
import { requireSession } from "@/auth/server-session";
import { NexoMark } from "@/components/nexo-mark";

export const metadata: Metadata = { title: `Console · ${PRODUCT_NAME}` };

/** Página provisória: o console do analista chega na próxima change. */
export default async function ConsolePage() {
  const session = await requireSession("console");
  return (
    <main className="flex min-h-dvh items-center justify-center bg-desk px-4">
      <div className="w-full max-w-md rounded-2xl bg-paper p-8 shadow-[0_1px_2px_#1B24310D,0_6px_18px_#1B24310A] outline outline-1 -outline-offset-[0.5px] outline-ink/[0.09]">
        <div className="flex items-center gap-2.5">
          <NexoMark className="h-5 w-5" color="#1B2431" />
          <span className="text-base font-bold tracking-[-0.2px] text-ink">{PRODUCT_NAME}</span>
        </div>
        <h1 className="mt-6 font-display text-[32px]/[36px] tracking-[-0.6px] text-ink">Console do analista</h1>
        <p className="mt-2 text-[14.5px]/[22px] text-ink-3">
          Olá, {session.name.split(" ")[0]} ({EMPLOYEE_ROLE_LABELS[session.role]}). O console para atender as
          conversas transferidas chega em breve.
        </p>
        <form action="/api/auth/logout" method="post" className="mt-6">
          <button
            type="submit"
            className="flex h-9 items-center gap-2 rounded-lg px-3 text-[13.5px] font-medium text-ink-2 outline outline-1 -outline-offset-[0.5px] outline-ink/[0.12] hover:bg-desk"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sair
          </button>
        </form>
      </div>
    </main>
  );
}
