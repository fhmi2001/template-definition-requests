-- «حفظ والعودة لاحقاً»: المسودات الأخرى تُحذف عند بدء طلب جديد أو الدخول أو الخروج
ALTER TABLE "template_requests" ADD COLUMN "keep_draft" BOOLEAN NOT NULL DEFAULT false;
