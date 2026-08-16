import { Button } from '@/components/ui/button';
import {
  Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ProjectFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  client: string;
  location: string;
  pic: string;
  contractNo: string;
  handover: string;
  onChange: (field: string, value: string) => void;
  onSubmit: () => void;
}

/**
 * Creating a project is a once-in-a-while act, so it no longer holds a
 * permanent half of the page — it lives behind the header button and comes
 * forward only when asked for.
 */
export default function ProjectForm({
  open, onOpenChange, name, client, location, pic, contractNo, handover,
  onChange, onSubmit,
}: ProjectFormProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Wider than the default dialog: six fields read as a form only when
          the short ones can pair off across a row. */}
      {/* No corner X: Cancel is right there, and two ways out of one small
          form is one more than the form needs. */}
      <DialogContent className="@container gap-0 p-5 sm:max-w-xl" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Create a new project
          </DialogTitle>
        </DialogHeader>

        <form
          className="mt-5 flex max-h-[60svh] flex-col gap-4 overflow-y-auto"
          onSubmit={e => { e.preventDefault(); onSubmit(); }}
        >
          <div className="grid gap-2">
            <Label htmlFor="pf-name">Project name</Label>
            <Input
              id="pf-name"
              value={name}
              onChange={e => onChange('name', e.target.value)}
              placeholder="e.g. Pulau Gading BCS Phase 1"
              autoFocus
            />
          </div>

          {/* Three short fields across, then two — the rows the fields
              themselves ask for, not an even split down the middle. */}
          <div className="grid gap-4 @sm:grid-cols-3">
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

          <div className="grid gap-4 @sm:grid-cols-2">
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

          {/* One full-width bar cut in half, so the two answers to this form
              carry the same weight and reach the same edges as the fields. */}
          <div className="mt-2 flex gap-3">
            <DialogClose render={<Button variant="outline" size="lg" className="flex-1" />}>
              Cancel
            </DialogClose>
            <Button type="submit" size="lg" className="flex-1">
              Create project
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
