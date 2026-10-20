-- فحص الطلب المكرر (findDuplicateRequest): الطلبات المقدَّمة بنفس اسم المرسل ونوعه.
-- فهرس جزئي (WHERE) لا يمكن وصفه في schema.prisma، لذلك هو هنا فقط.
CREATE INDEX IF NOT EXISTS "template_requests_duplicate_check_idx"
  ON "template_requests" ("sender_name", "sender_type")
  WHERE "status" = 'SUBMITTED';
