/** الشكل الموحّد لنتيجة أي Server Action تعرض رسائل في النموذج. */
export type ActionState = {
  ok?: boolean;
  /** رسالة عامة أعلى النموذج */
  error?: string;
  /** نوع الرسالة لتلوينها */
  tone?: "error" | "warning" | "info";
  /** رسائل الحقول */
  fields?: Record<string, string>;
  /** ملاحظات تحقق اختياري على المحتوى: يختار العميل المتابعة أو التعديل */
  warnings?: string[];
  /** رسالة نجاح */
  message?: string;
  /** قيم الحقول لإعادة تعبئتها بعد الخطأ */
  values?: Record<string, string>;
};

export const initialState: ActionState = {};
