export function Section({
  title,
  children,
  dividerTop = true,
}: {
  title: string;
  children: React.ReactNode;
  dividerTop?: boolean;
}) {
  return (
    <section className="w-full">
      {dividerTop && <div className="w-full border-t border-[#1f1f1f]" />}
      <div className="px-3 pb-4 pt-4">
        <h3 className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted">
          {title}
        </h3>
        {children}
      </div>
    </section>
  );
}
