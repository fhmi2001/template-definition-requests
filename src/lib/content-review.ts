/**
 * فحص اختياري لمحتوى الرسالة بعد استيفاء الشروط الأساسية: يكشف التعارض بين التصنيف والمحتوى
 * أو وجود مخالفة قد تُرفض بسببها الرسالة. لا يمنع التقديم؛ العميل يختار المتابعة أو التعديل.
 */
export type ContentFinding =
  | "promoAsNonAd" // محتوى دعائي مصنَّف خدمياً أو توعوياً أو تحذيرياً
  | "serviceAsAwareness" // محتوى خدمي مصنَّف توعوياً
  | "abuse" // إساءة صريحة
  | "donation" // طلب تبرعات
  | "bankTransfer"; // رابط أو طلب تحويل بنكي

/** مطابقة كلمة كاملة (حدود الأحرف تشمل العربية). */
const word = (alts: string) => new RegExp(`(?<![\\p{L}\\p{M}\\d])(?:${alts})(?![\\p{L}\\p{M}\\d])`, "iu");

const PROMO = [
  word("خصم|خصومات|تخفيض|تخفيضات|حسم|عروض|عرض\\s+خاص|عرض\\s+محدود|عرضنا|كوبون|كود\\s+(?:ال)?خصم|برومو|تسوق|تسوّق|اشترِ|اشتري|وفّر|وفر|اغتنم|لفترة\\s+محدودة|مجانا|مجاناً|هدية|هدايا|اطلب\\s+الآن|اطلبه\\s+الآن|احجز\\s+الآن|سارع|لا\\s+تفوت|اشترك\\s+الآن"),
  word("discounts?|sale|offers?|promo(?:tion)?|coupon|voucher|free|shop\\s+now|order\\s+now|buy\\s+now|limited\\s+time|save\\s+up"),
  /\d+\s*%\s*(?:خصم|off)|(?:خصم|off)\s*(?:up\s*to|حتى|يصل)?\s*\d+\s*%/iu,
];

const SERVICE = [
  word("رمز\\s+(?:ال)?تحقق|كلمة\\s+(?:ال)?مرور|رمز\\s+(?:ال)?دخول|رقم\\s+(?:ال)?طلب|طلبك|فاتورتك|فاتورة\\s+رقم|رصيدك|حجزك|موعدك|تم\\s+(?:تأكيد|شحن|استلام|تسليم|سداد|إصدار)|مبلغ\\s+(?:ال)?سداد|دفعتك|شحنتك"),
  word("otp|verification\\s+code|one[- ]time|your\\s+(?:order|invoice|booking|appointment|balance|shipment)|order\\s+(?:no|number)"),
];

const ABUSE = word(
  "كلب|كلاب|حمار|حمير|غبي|غبية|أحمق|حقير|حقيرة|وسخ|قذر|ملعون|لعنة|ابن\\s+الكلب|يا\\s+ثور|خنزير|تافه|سافل|منحط|زفت|fuck\\w*|shit\\w*|bitch\\w*|idiot|stupid|asshole|bastard",
);

const DONATION = word(
  "تبرع|تبرعات|تبرّع|تبرعك|ساهم\\s+(?:معنا|بدعم)|ادعم\\s+(?:حملة|مشروع)|حملة\\s+(?:ال)?تبرع|صدقة|صدقات|زكاة|زكاتك|كفالة|donat\\w*|charity|fundrais\\w*",
);

const BANK = [
  word("تحويل\\s+بنكي|حوّل\\s+(?:المبلغ|إلى\\s+حساب)|حول\\s+(?:المبلغ|إلى\\s+حساب)|رقم\\s+(?:ال)?حساب|آيبان|ايبان|رقم\\s+(?:ال)?آيبان|iban|bank\\s+transfer|wire\\s+transfer|account\\s+number"),
  /https?:\/\/\S*(?:bank|transfer|wire|iban|tahweel|تحويل)\S*/iu,
  /\bSA\d{2}[\s\d]{16,}/i,
];

const any = (list: RegExp[], text: string) => list.some((r) => r.test(text));

/** type: Service | Awareness | Warning | Advertisement. تُطبَّق قواعد التصنيف على غير الإعلاني فقط. */
export function reviewContent(text: string, senderType: string | null): ContentFinding[] {
  const out: ContentFinding[] = [];
  const t = text.replace(/#Var\d+#/g, " ");
  if (senderType && senderType !== "Advertisement" && any(PROMO, t)) out.push("promoAsNonAd");
  if (senderType === "Awareness" && any(SERVICE, t)) out.push("serviceAsAwareness");
  if (ABUSE.test(t)) out.push("abuse");
  if (DONATION.test(t)) out.push("donation");
  if (any(BANK, text)) out.push("bankTransfer");
  return out;
}
