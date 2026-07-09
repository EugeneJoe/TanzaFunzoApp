import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Small info icon that explains a dashboard metric on hover/focus. Keyboard
 * reachable (it's a real button), so the guidance isn't hover-only.
 */
export function InfoTip({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="What does this mean?"
          className="shrink-0 rounded-full text-text-faint transition-colors hover:text-navy-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange"
        >
          <Info className="size-3.5" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[280px] font-sans leading-relaxed">{children}</TooltipContent>
    </Tooltip>
  );
}
