"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { publishAction } from "./publish-actions";

export function PublishButton({ classId }: { classId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handlePublish() {
    startTransition(async () => {
      await publishAction(classId);
      toast.success("Published");
      router.refresh();
    });
  }

  return (
    <Button type="button" onClick={handlePublish} disabled={isPending}>
      {isPending ? "Publishing…" : "Publish"}
    </Button>
  );
}
