import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/dal";
import { getOwnRequest } from "@/server/requests";
import { uuidSchema } from "@/lib/validation";

const ALLOWED = new Set(["application/pdf", "image/png", "image/jpeg"]);

/** تنزيل مرفق رفعه العميل نفسه على طلبه (لا يصل إليه غيره). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  const { client } = await requireUser();
  const p = await params;
  const request = await getOwnRequest(client.id, p.id);
  const attId = uuidSchema.safeParse(p.attachmentId);
  if (!request || !attId.success) notFound();

  const file = await db.requestAttachment.findFirst({
    where: { id: attId.data, requestId: request.id },
    select: { fileName: true, mimeType: true, data: true },
  });
  if (!file || !ALLOWED.has(file.mimeType)) notFound();

  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `attachment; filename="pledge"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
}
