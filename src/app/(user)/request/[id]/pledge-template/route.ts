import { notFound } from "next/navigation";
import { requireUser } from "@/server/auth/dal";
import { getDraftWithSender } from "@/server/requests";
import { fillPledge } from "@/server/pledge/fill-pledge";
import { getT } from "@/i18n/server";

/** نموذج خطاب التعهد معبأ باسم الجهة واسم المرسل لهذا الطلب. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { client } = await requireUser();
  const found = await getDraftWithSender(client.id, (await params).id);
  if (!found) notFound();
  const senderName = found.sender?.name ?? found.draft.senderName;
  const entity = found.sender?.clientName ?? client.name;

  const docx = await fillPledge(entity, senderName);
  const { t } = await getT();
  const name = t("pledge.fileName", { sender: senderName });
  return new Response(new Uint8Array(docx), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="pledge-${senderName.replace(/[^A-Za-z0-9._-]/g, "_")}.docx"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
