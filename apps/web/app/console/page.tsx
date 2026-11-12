import type { Metadata } from "next";
import { EMPLOYEE_ROLE_LABELS, PRODUCT_NAME } from "@nexo/shared";
import { requireSession } from "@/auth/server-session";
import { ConsoleApp } from "@/components/console/console-app";

export const metadata: Metadata = { title: `Console · ${PRODUCT_NAME}` };

export default async function ConsolePage() {
  const session = await requireSession("console");
  return <ConsoleApp analystName={session.name} roleLabel={EMPLOYEE_ROLE_LABELS[session.role]} />;
}
