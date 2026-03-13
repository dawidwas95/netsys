import { useState } from "react";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { ORDER_PRIORITY_LABELS, type OrderPriority } from "@/types/database";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

const LEVEL_MAP: Record<OrderPriority, number> = {
  NORMAL: 1,
  HIGH: 2,
  URGENT: 3,
};

const PRIORITIES: OrderPriority[] = ["NORMAL", "HIGH", "URGENT"];

function Flames({ level, size = "h-4 w-4" }: { level: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3].map((i) => (
        <Flame
          key={i}
          className={cn(size, i <= level ? "text-destructive" : "text-muted-foreground/25")}
          fill={i <= level ? "currentColor" : "none"}
          strokeWidth={1.5}
        />
      ))}
    </div>
  );
}

export function PriorityIndicator({ priority }: { priority: OrderPriority }) {
  const level = LEVEL_MAP[priority] ?? 1;

  return (
    <div title={ORDER_PRIORITY_LABELS[priority]}>
      <Flames level={level} />
    </div>
  );
}

export function PrioritySelector({
  priority,
  onSelect,
}: {
  priority: OrderPriority;
  onSelect: (p: OrderPriority) => void;
}) {
  const level = LEVEL_MAP[priority] ?? 1;

  const handleClick = (clickedLevel: number) => {
    const newPriority = PRIORITIES[clickedLevel - 1];
    if (newPriority && newPriority !== priority) {
      onSelect(newPriority);
    }
  };

  return (
    <div className="flex items-center gap-0.5" title={ORDER_PRIORITY_LABELS[priority]}>
      {[1, 2, 3].map((i) => (
        <button
          key={i}
          type="button"
          onClick={(e) => { e.stopPropagation(); handleClick(i); }}
          className="hover:scale-125 transition-transform"
        >
          <Flame
            className={cn("h-4 w-4", i <= level ? "text-destructive" : "text-muted-foreground/25")}
            fill={i <= level ? "currentColor" : "none"}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
}
