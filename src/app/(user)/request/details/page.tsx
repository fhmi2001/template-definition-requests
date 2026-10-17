import { redirect } from "next/navigation";

/** رابط قديم من نسخة سابقة: مراحل الطلب صارت تحت /request/[id]/... */
export default function LegacyRequestDetailsPage() {
  redirect("/home");
}
