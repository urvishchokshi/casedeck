interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <header className="mb-[22px]">
      <h1 className="text-[40px] text-[var(--ink)]">{title}</h1>
      {subtitle && (
        <p className="mt-1 text-[14px] text-[var(--muted)]">{subtitle}</p>
      )}
    </header>
  );
}
