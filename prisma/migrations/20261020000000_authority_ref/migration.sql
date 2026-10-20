-- رقم الطلب لدى هيئة الاتصالات (يُدخله المشرف عند نقل الطلب إلى «لدى الهيئة»)
ALTER TABLE "template_requests" ADD COLUMN "authority_ref" VARCHAR(50);
