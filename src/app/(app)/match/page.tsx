import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";

interface PlaceholderPartner {
  name: string;
  initials: string;
  campus: string;
  workEx: string;
  active: boolean;
}

const partners: PlaceholderPartner[] = [
  { name: "Aarav S.", initials: "AS", campus: "Hyderabad", workEx: "3 yrs · Consulting", active: true },
  { name: "Diya M.", initials: "DM", campus: "Mohali", workEx: "4 yrs · FMCG", active: true },
  { name: "Kabir R.", initials: "KR", campus: "Hyderabad", workEx: "2 yrs · Tech", active: false },
  { name: "Ananya K.", initials: "AK", campus: "Hyderabad", workEx: "5 yrs · BFSI", active: true },
  { name: "Rohan P.", initials: "RP", campus: "Mohali", workEx: "3 yrs · Operations", active: false },
  { name: "Ishita G.", initials: "IG", campus: "Hyderabad", workEx: "4 yrs · Healthcare", active: true },
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
          <Card key={partner.name} className="flex flex-col gap-3.5">
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-center gap-[11px]">
                <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-[var(--accent-50)] text-[14px] font-bold text-[var(--accent)]">
                  {partner.initials}
                </span>
                <div>
                  <h2 className="font-[family-name:var(--font-ui)] text-[16px] font-semibold leading-tight tracking-[-0.01em] text-[var(--ink)]">
                    {partner.name}
                  </h2>
                  <p className="text-[12px] font-medium text-[var(--muted)]">
                    {partner.workEx}
                  </p>
                </div>
              </div>
              <span
                title={partner.active ? "Available" : "Busy"}
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                  partner.active
                    ? "bg-[var(--status-active)]"
                    : "bg-[var(--status-idle)]"
                }`}
              />
            </div>
            <div>
              <Pill>{partner.campus}</Pill>
            </div>
            <Button variant="secondary" disabled className="w-full">
              Show WhatsApp
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
