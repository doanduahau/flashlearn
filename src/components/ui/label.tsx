import * as React from "react";
import { Label as PrimitiveLabel } from "@radix-ui/react-label";

import { cn } from "@/lib/utils";

const Label = React.forwardRef<
  React.ElementRef<typeof PrimitiveLabel>,
  React.ComponentPropsWithoutRef<typeof PrimitiveLabel>
>(({ className, ...props }, ref) => {
  return (
    <PrimitiveLabel
      ref={ref}
      className={cn(
        "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    />
  );
});
Label.displayName = "Label";

export { Label };
