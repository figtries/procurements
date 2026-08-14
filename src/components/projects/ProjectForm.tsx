import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ProjectFormProps {
  name: string;
  client: string;
  location: string;
  pic: string;
  contractNo: string;
  handover: string;
  onChange: (field: string, value: string) => void;
  onSubmit: () => void;
}

export default function ProjectForm({
  name, client, location, pic, contractNo, handover, onChange, onSubmit,
}: ProjectFormProps) {
  return (
    <Card className="border-t-4 border-t-ontrack">
      <CardContent className="flex h-full flex-col">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ontrack-fg">
          Procurement &amp; Vendor
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight">Create a new project</h2>

        <form
          className="mt-6 flex flex-1 flex-col gap-4"
          onSubmit={e => { e.preventDefault(); onSubmit(); }}
        >
          <div className="grid gap-2">
            <Label htmlFor="pf-name">Project name</Label>
            <Input
              id="pf-name"
              value={name}
              onChange={e => onChange('name', e.target.value)}
              placeholder="e.g. Pulau Gading BCS Phase 1"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="pf-client">Client</Label>
              <Input
                id="pf-client" value={client}
                onChange={e => onChange('client', e.target.value)}
                placeholder="Company name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pf-location">Location</Label>
              <Input
                id="pf-location" value={location}
                onChange={e => onChange('location', e.target.value)}
                placeholder="City / region"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pf-pic">PIC</Label>
              <Input
                id="pf-pic" value={pic}
                onChange={e => onChange('pic', e.target.value)}
                placeholder="Full name"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="pf-contract">Contract no.</Label>
              <Input
                id="pf-contract" value={contractNo}
                onChange={e => onChange('contractNo', e.target.value)}
                placeholder="CTR-2026-XXXX"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pf-handover">Handover target</Label>
              <Input
                id="pf-handover" type="date" value={handover}
                onChange={e => onChange('handover', e.target.value)}
              />
            </div>
          </div>

          <Button type="submit" className="mt-auto w-full">Create project</Button>
        </form>
      </CardContent>
    </Card>
  );
}
