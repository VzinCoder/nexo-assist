import type { Metadata } from "next";
import { PRODUCT_NAME } from "@nexo/shared";
import { requireSession } from "@/auth/server-session";
import { toConversationDto } from "@/chat/dto";
import { getOrCreateCurrentConversation } from "@/chat/repository";
import { ChatApp } from "@/components/chat/chat-app";
import { MobileBar, Sidebar } from "@/components/chat/sidebar";
import { getDb } from "@/server/db";

export const metadata: Metadata = { title: `Atendimento · ${PRODUCT_NAME}` };

export default async function ChatPage() {
  const session = await requireSession("chat");
  const db = getDb();
  // A conversa atual é carregada no servidor (última não encerrada, ou uma nova).
  const conversation = toConversationDto(db, getOrCreateCurrentConversation(db, session.employeeId, new Date()));

  return (
    <div className="flex h-dvh bg-paper">
      <Sidebar name={session.name} email={session.email} />
      <main className="flex min-w-0 flex-1 flex-col">
        <MobileBar name={session.name} />
        <ChatApp key={conversation.id} initial={conversation} firstName={session.name.split(" ")[0] ?? session.name} />
      </main>
    </div>
  );
}
