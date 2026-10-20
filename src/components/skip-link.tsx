/** أول عنصر في الصفحة لمستخدمي لوحة المفاتيح: يظهر عند التركيز وينقل إلى المحتوى الرئيسي (#main). */
export function SkipLink({ label }: { label: string }) {
  return (
    <a
      href="#main"
      className="sr-only rounded-xl bg-white px-4 py-3 text-small font-semibold text-brand-700 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.18)] focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50"
    >
      {label}
    </a>
  );
}
