/** شعار Deewan مع اسم المنصة. tone="dark" للخلفيات الداكنة (لوحة الإدارة). */
export function BrandLogo({
  product,
  tone = "light",
  size = "md",
}: {
  product?: string;
  tone?: "light" | "dark";
  size?: "md" | "lg";
}) {
  const h = size === "lg" ? 34 : 26;
  return (
    <span className="flex min-w-0 items-center gap-3">
      <img
        src={tone === "dark" ? "/deewan-logo-light.svg" : "/deewan-logo.svg"}
        alt="Deewan"
        width={Math.round((h * 414) / 69)}
        height={h}
        className="flex-none"
        style={{ height: h, width: "auto" }}
      />
      {product ? (
        <span
          className={`hidden min-w-0 border-s ps-3 text-meta font-medium leading-snug sm:block ${
            tone === "dark" ? "border-night-line text-night-fg" : "border-line-strong text-muted"
          }`}
        >
          {product}
        </span>
      ) : null}
    </span>
  );
}
