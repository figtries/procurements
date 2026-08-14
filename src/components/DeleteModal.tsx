'use client';

import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface DeleteModalProps {
  open: boolean;
  title: string;
  desc: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteModal({ open, title, desc, onCancel, onConfirm }: DeleteModalProps) {
  return (
    <Dialog open={open} onOpenChange={next => { if (!next) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <span className="mb-1 flex size-11 items-center justify-center rounded-xl bg-late-bg text-late-fg">
            <TriangleAlert className="size-5" />
          </span>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Batal</Button>
          <Button variant="destructive" onClick={onConfirm}>Hapus</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
