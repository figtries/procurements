'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface ProjectFormValues {
  name: string;
  client: string;
  location: string;
  pic: string;
  contractNo: string;
  handover: string;
}

const EMPTY: ProjectFormValues = {
  name: '', client: '', location: '', pic: '', contractNo: '', handover: '',
};

interface ProjectFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: ProjectFormValues) => void;
}

/**
 * Creating a project is a once-in-a-while act, so it no longer holds a
 * permanent half of the page — it lives behind the header button and comes
 * forward only when asked for.
 *
 * The fields are kept here rather than at the top of the app. Held up there,
 * every character typed re-rendered the sidebar, the project table and all
 * four modals to change one input — measured at ~54ms of blocked main thread
 * per keystroke on a desktop, which on a phone is most of a second for a
 * six-letter word. Nothing outside this dialog needs to know what is in the
 * fields until Create project is pressed, so nothing outside it is told.
 */
export default function ProjectForm({ open, onOpenChange, onSubmit }: ProjectFormProps) {
  const [values, setValues] = useState<ProjectFormValues>(EMPTY);

  // Previous prop tracked so the reset happens during render rather than in an
  // effect after one — the same shape ItemFormModal uses. A form that opens
  // still holding what was typed into it last time is a form that lies.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setValues(EMPTY);
  }

  const { name, client, location, pic, contractNo, handover } = values;

  function onChange(field: keyof ProjectFormValues, value: string) {
    setValues(v => ({ ...v, [field]: value }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Wider than the default dialog: six fields read as a form only when
          the short ones can pair off across a row. */}
      {/* No corner X: Cancel is right there, and two ways out of one small
          form is one more than the form needs. */}
      {/* Flex column rather than the default grid, and no padding of its own:
          the title and the buttons stay put while only the fields scroll, so
          the card takes whatever height is left instead of a magic number that
          leaves Create project below the bottom of the screen. */}
      <DialogContent
        className="flex max-h-[85svh] flex-col gap-0 overflow-hidden p-0 sm:max-h-[90svh] sm:max-w-xl"
        showCloseButton={false}
      >
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={e => { e.preventDefault(); onSubmit(values); }}
        >
          <DialogHeader className="shrink-0 px-5 pt-5 pb-4">
            <DialogTitle className="text-lg font-semibold tracking-tight sm:text-xl">
              Create a new project
            </DialogTitle>
          </DialogHeader>

          {/* The rows answer to the width of this box, not of the window: the
              same form is a full-bleed sheet on a phone and a 36rem card on a
              desktop, and only its own measure knows which pairings fit. */}
          <div className="@container min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 pb-5">
            <div className="grid gap-2">
              <Label htmlFor="pf-name">Project name</Label>
              {/* No autofocus. On a phone it throws the keyboard up before the
                  dialog has finished arriving — the viewport resizes mid
                  animation — and it decides for you which field you meant.
                  Tapping the field you want is one tap either way. */}
              <Input
                id="pf-name"
                value={name}
                onChange={e => onChange('name', e.target.value)}
                placeholder="e.g. Pulau Gading BCS Phase 1"
              />
            </div>

            {/* Three short fields across, then two — the rows the fields
                themselves ask for, not an even split down the middle. A
                company, a city and a person keep the full measure on a phone;
                cut into thirds there they would each hold about four letters. */}
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

            {/* A contract number and a date are short enough to sit side by
                side even on a phone, which is one row of scrolling saved. */}
            <div className="grid gap-4 @xs:grid-cols-2">
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
          </div>

          {/* One full-width bar cut in half, so the two answers to this form
              carry the same weight and reach the same edges as the fields.
              It sits below the scroll rather than inside it: the way out of a
              form should not be something you have to go looking for. */}
          <DialogFooter className="m-0 shrink-0 flex-row gap-3 rounded-none px-5 py-4">
            <DialogClose render={<Button variant="outline" size="lg" className="flex-1" />}>
              Cancel
            </DialogClose>
            <Button type="submit" size="lg" className="flex-1">
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
