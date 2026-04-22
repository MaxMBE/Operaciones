"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, X } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface MultiFilterProps {
  placeholder: string;
  options: Option[];
  value: string[];
  onChange: (vals: string[]) => void;
}

export function MultiFilter({ placeholder, options, value, onChange }: MultiFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  function toggle(v: string) {
    if (value.includes(v)) onChange(value.filter(x => x !== v));
    else onChange([...value, v]);
  }

  const hasValue = value.length > 0;
  const displayLabel = !hasValue
    ? placeholder
    : value.length === 1
    ? (options.find(o => o.value === value[0])?.label ?? value[0])
    : `${placeholder} (${value.length})`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-1 px-2.5 py-1.5 text-xs border rounded-lg transition-colors bg-muted/30 text-foreground
          ${hasValue
            ? "border-primary ring-1 ring-primary/30 font-medium text-primary"
            : "border-border hover:border-primary/50"}`}
      >
        <span className="truncate">{displayLabel}</span>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {hasValue && (
            <span
              role="button"
              onClick={e => { e.stopPropagation(); onChange([]); }}
              className="text-primary/60 hover:text-primary transition-colors"
            >
              <X className="w-2.5 h-2.5" />
            </span>
          )}
          <ChevronDown className={`w-3 h-3 opacity-50 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && options.length > 0 && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-white dark:bg-card border border-border rounded-lg shadow-lg min-w-full max-h-60 overflow-y-auto">
          {options.map(opt => (
            <label
              key={opt.value}
              className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/50 cursor-pointer text-xs select-none"
            >
              <input
                type="checkbox"
                checked={value.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="rounded border-border accent-primary w-3 h-3 flex-shrink-0"
              />
              <span className={value.includes(opt.value) ? "font-medium text-foreground" : "text-muted-foreground"}>
                {opt.label}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
