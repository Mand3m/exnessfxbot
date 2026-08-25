export function AppFold({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-left text-xl font-semibold tracking-tight text-[#FFD700] [&::-webkit-details-marker]:hidden sm:px-6">
        {title}
        <span className="shrink-0 text-lg leading-none text-[#e0b422] transition-transform group-open:rotate-180" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="border-t border-border px-4 py-4 sm:px-6">{children}</div>
    </details>
  );
}
