import * as React from "react"

import { cn } from "@/lib/utils"

function Overline({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="overline"
      className={cn(
        "font-heading text-[11px] font-medium tracking-[1.5px] text-text-faint uppercase",
        className
      )}
      {...props}
    />
  )
}

export { Overline }
