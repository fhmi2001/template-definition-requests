/** أقصى عدد طلبات يقدّمها العميل (كل مستخدميه معاً) في اليوم الواحد. */
export const DAILY_SUBMIT_LIMIT = 20;

/** بداية اليوم الحالي بتوقيت الرياض (UTC+3، بلا توقيت صيفي) كتاريخ UTC. */
export function riyadhTodayStart(now = new Date()) {
  const shifted = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - 3 * 60 * 60 * 1000);
}
