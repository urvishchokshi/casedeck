import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";

interface PlaceholderPartner {
  name: string;
  campus: string;
  workEx: string;
  active: boolean;
}

const partners: PlaceholderPartner[] = [
  { name: "Aarav S.", campus: "Hyderabad", workEx: "3 yrs · Consulting", active: true },
  { name: "Diya M.", campus: "Mohali", workEx: "4 yrs · FMCG", active: true },
  { name: "Kabir R.", campus: "Hyderabad", workEx: "2 yrs · Tech", active: false },
  { name: "Ananya K.", campus: "Hyderabad", workEx: "5 yrs · BFSI", active: true },
  { name: "Rohan P.", campus: "Mohali", workEx: "3 yrs · Operations", active: false },
  { name: "Ishita G.", campus: "Hyderabad", workEx: "4 yrs · Healthcare", active: true },
];

export default function MatchPage() {
  return (
    <div>
      <PageHeader
        title="Find a Practice Partner"
        subtitle="Connect with peers for mock case interviews"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {partners.map((partner) => (
          <Card key={partner.name}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-[length:var(--font-size-base)] font-semibold text-[var(--color-text)]">
                  {partner.name}
                </h2>
                <p className="mt-1 text-[length:var(--font-size-sm)] text-[var(--color-text-muted)]">
                  {partner.workEx}
                </p>
              </div>
              <span
                title={partner.active ? "Active" : "Away"}
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-[var(--radius-pill)] ${
                  partner.active
                    ? "bg-[var(--color-status-active)]"
                    : "bg-[var(--color-status-idle)]"
                }`}
              />
            </div>
            <div className="mt-3">
              <Pill>{partner.campus}</Pill>
            </div>
            <Button variant="secondary" disabled className="mt-4 w-full">
              Show WhatsApp
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
