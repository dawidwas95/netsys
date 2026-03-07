import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ChevronDown, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** @deprecated Use onAddNew instead */
  actions?: React.ReactNode;
  /** Called when the "Add new" button is clicked. Closes the dropdown first. */
  onAddNew?: () => void;
  addNewLabel?: string;
}

export function SearchableSelect({
  options, value, onChange, placeholder = "Wyszukaj...", className, disabled,
  actions, onAddNew, addNewLabel = "Dodaj nowy",
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = search
    ? options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        (o.sublabel?.toLowerCase().includes(search.toLowerCase()))
      )
    : options;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        className="w-full justify-between font-normal h-9 px-3"
        onClick={() => {
          setOpen(!open);
          if (!open) setTimeout(() => inputRef.current?.focus(), 50);
        }}
      >
        <span className={cn("truncate", !selected && "text-muted-foreground")}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex items-center gap-1 ml-2 shrink-0">
          {value && (
            <X
              className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); onChange(""); setSearch(""); }}
            />
          )}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </Button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Szukaj..."
                className="pl-7 h-8 text-sm"
              />
            </div>
          </div>
          <div className="max-h-[200px] overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="py-3 text-center text-sm text-muted-foreground">Brak wyników</div>
            ) : (
              filtered.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  className={cn(
                    "w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                    opt.value === value && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <div className="font-medium truncate">{opt.label}</div>
                  {opt.sublabel && <div className="text-xs text-muted-foreground truncate">{opt.sublabel}</div>}
                </button>
              ))
            )}
          </div>
          {onAddNew && (
            <div className="border-t border-border p-1">
              <button
                type="button"
                className="w-full text-left px-2 py-1.5 text-sm text-primary hover:bg-accent rounded-sm flex items-center gap-1"
                onClick={() => {
                  setOpen(false);
                  setSearch("");
                  // Use setTimeout to ensure dropdown is fully closed before opening dialog
                  setTimeout(() => onAddNew(), 0);
                }}
              >
                <Plus className="h-3.5 w-3.5" /> {addNewLabel}
              </button>
            </div>
          )}
          {/* Legacy actions support */}
          {!onAddNew && actions && (
            <div className="border-t border-border p-1">
              {actions}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
