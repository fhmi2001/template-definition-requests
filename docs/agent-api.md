# واجهة الوكلاء (Agent API)

مصادقة: `Authorization: Bearer <AGENT_API_TOKEN>` (HTTPS فقط). الرمز في متغيرات Netlify، 40 حرفاً على الأقل.
بدون الرمز في البيئة تُرجع الواجهة 404. حدود: 10 محاولات فاشلة / 10 دقائق لكل IP، و120 طلباً/دقيقة. كل استدعاء يُسجَّل في audit_logs.

## GET /api/agent/requests
`?status=RECEIVED|UNDER_REVIEW` (الافتراضي RECEIVED) `&limit=1..50` `&excludeSender=Janalkhair,...`
قراءة فقط. يُرجع الأقدم أولاً مع: بيانات المرسل (التصنيف في Mobily)، العميل (الرقم الموحد، السجل التجاري)، نص الرسالة الجاهز، والمتغيرات بأنواع Mobily (عينة Link = الرابط الأساسي للرابط الملاصق للمتغير، مثل https://staging.zoneder5.ai).

## POST /api/agent/results
```json
{ "notify": true,
  "results": [
    { "referenceNo": 462, "status": "UNDER_REVIEW", "authorityRef": "NTR-2611-MO-P005-3121" },
    { "referenceNo": "TDR-000474", "status": "REJECTED", "reason": "<رسالة Mobily>\nالترجمة: ..." }
  ] }
```
- حتى 25 نتيجة؛ الحالات: UNDER_REVIEW / APPROVED / REJECTED (لا رجوع إلى RECEIVED).
- authorityRef إلزامي لغير المرفوض (إلا إن كان محفوظاً)؛ المرفوض بلا رقم يُحفظ 0000000000. السبب إلزامي للمرفوض (5–1000 حرف).
- `notify:false` = بدون بريد للعميل. إعادة إرسال النتيجة نفسها آمنة (`unchanged`).
- النتيجة لكل طلب: changed / unchanged / not_found / conflict / needs_authority_ref.

## تفعيل
1. ولّد الرمز (الأمر في .env.example) وضعه في Netlify باسم AGENT_API_TOKEN ثم أعد النشر.
2. لا تضع الرمز في الكود أو المحادثات.
