"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";

export function DeleteTagButton({ tagId, tagName, count }: { tagId: string; tagName: string; count: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onDelete = async () => {
    setError(null);
    const res = await fetch(`/api/tags/${tagId}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Delete failed");
      return;
    }
    setOpen(false);
    startTransition(() => router.refresh());
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete tag “{tagName}”?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This removes the tag from{" "}
          <strong>
            {count} {count === 1 ? "contact" : "contacts"}
          </strong>
          . The contacts themselves are not deleted. This cannot be undone.
        </p>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button variant="destructive" onClick={onDelete} disabled={pending}>Delete tag</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
