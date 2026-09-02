import { Download } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface PlaceholderCasebook {
  title: string;
  meta: string;
}

const casebooks: PlaceholderCasebook[] = [
  { title: "ISB Consulting Club Casebook 2025", meta: "42 cases · PDF" },
  { title: "ISB Consulting Club Casebook 2024", meta: "38 cases · PDF" },
  { title: "Guesstimates Compendium", meta: "25 drills · PDF" },
  { title: "Interview Frameworks Primer", meta: "12 chapters · PDF" },
];

export default function CasebooksPage() {
  return (
    <div>
      <PageHeader
        title="Casebooks"
        subtitle="Official casebooks and prep material"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {casebooks.map((book) => (
          <Card key={book.title}>
            <h2 className="text-[length:var(--font-size-base)] font-semibold text-[var(--color-text)]">
              {book.title}
            </h2>
            <p className="mt-1 text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
              {book.meta}
            </p>
            <Button variant="secondary" disabled className="mt-4">
              <Download size={16} />
              Download PDF
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
