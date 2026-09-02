interface PageHeaderProps {
  title: string;
  subtitle?: string;
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <header className="mb-8">
      <h1 className="text-[length:var(--font-size-2xl)] font-bold tracking-tight text-[var(--color-text)]">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-1 text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
          {subtitle}
        </p>
      )}
    </header>
  );
}
