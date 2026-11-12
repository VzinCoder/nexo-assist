import { LogOut, MessageSquare, UserRound } from "lucide-react";
import { PRODUCT_NAME } from "@nexo/shared";
import { NexoMark } from "@/components/nexo-mark";
import { initials } from "./format";

/** Barra lateral do protótipo: marca, navegação, perfil e "Sair". */
export function Sidebar({ name, email }: { name: string; email: string }) {
  return (
    <aside className="hidden w-[232px] shrink-0 flex-col border-r border-rule px-3.5 pb-3.5 pt-5 md:flex">
      <div className="flex items-center gap-2.5 px-2">
        <NexoMark className="h-[17px] w-5" color="#1B2431" />
        <span className="text-base font-bold tracking-[-0.2px] text-ink">{PRODUCT_NAME}</span>
      </div>
      <nav className="mt-[22px] flex flex-col gap-0.5" aria-label="Principal">
        <a
          href="/chat"
          aria-current="page"
          className="flex h-9 items-center gap-2.5 rounded-lg bg-info/[0.07] px-2.5 text-[13.5px] font-semibold text-link"
        >
          <MessageSquare className="h-4 w-4" aria-hidden="true" /> Atendimento
        </a>
        <span
          aria-disabled="true"
          title="Em breve"
          className="flex h-9 cursor-not-allowed items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium text-ink-3"
        >
          <UserRound className="h-4 w-4" aria-hidden="true" /> Meu perfil
          <span className="ml-auto text-[11.5px] font-normal">em breve</span>
        </span>
      </nav>
      <div className="flex-1" />
      <div className="flex items-center gap-2.5 border-t border-rule px-2 pb-1 pt-3.5">
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-info/[0.07] text-[12.5px] font-bold text-link">
          {initials(name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold text-ink">{name}</p>
          <p className="truncate text-[11.5px] text-ink-3">{email}</p>
        </div>
      </div>
      <form action="/api/auth/logout" method="post">
        <button
          type="submit"
          className="flex h-[34px] w-full items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium text-ink-2 hover:bg-ink/[0.04]"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" /> Sair
        </button>
      </form>
    </aside>
  );
}

/** Em telas pequenas a barra lateral some; "Sair" continua acessível no topo. */
export function MobileBar({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-between border-b border-rule px-4 py-2.5 md:hidden">
      <div className="flex items-center gap-2">
        <NexoMark className="h-4 w-[19px]" color="#1B2431" />
        <span className="text-[15px] font-bold text-ink">{PRODUCT_NAME}</span>
      </div>
      <form action="/api/auth/logout" method="post" className="flex items-center gap-2 text-[12.5px] text-ink-3">
        <span className="truncate">{name}</span>
        <button type="submit" className="flex items-center gap-1 rounded-md px-2 py-1 font-medium text-ink-2 hover:bg-ink/[0.04]">
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" /> Sair
        </button>
      </form>
    </div>
  );
}
