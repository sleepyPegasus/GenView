"use client";

import { useState, useMemo } from "react";
import * as LucideIcons from "lucide-react";
import { Search } from "lucide-react";
import iconNames from "@/lib/lucide-icon-names.json";

const ICON_NAMES = iconNames as string[];

type IconComp = React.ComponentType<{ size?: number; className?: string }>;

function getIconComponent(name: string): IconComp | null {
  const comp = (LucideIcons as unknown as Record<string, IconComp>)[name];
  return comp ?? null;
}

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
  placeholder?: string;
  className?: string;
}

export function IconPicker({ value, onChange, placeholder = "选择图标", className }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredIcons = useMemo(() => {
    if (!search.trim()) return ICON_NAMES.slice(0, 200);
    const q = search.toLowerCase();
    return ICON_NAMES.filter((n) => n.toLowerCase().includes(q)).slice(0, 300);
  }, [search]);

  const CurrentIcon = value ? getIconComponent(value) : null;

  return (
    <div className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full min-w-[80px] h-9 rounded-md px-3 text-sm transition-colors"
        style={{
          border: "1px solid var(--gen-border)",
          background: "var(--gen-card)",
          color: "var(--gen-foreground)",
        }}
      >
        {CurrentIcon ? (
          <CurrentIcon size={16} className="flex-shrink-0" />
        ) : (
          <span style={{ color: "var(--gen-muted-fg)" }}>—</span>
        )}
        <span className="truncate flex-1 text-left">
          {value ? value : placeholder}
        </span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            className="absolute z-50 mt-1 rounded-lg shadow-lg overflow-hidden"
            style={{
              width: 320,
              maxHeight: 280,
              background: "var(--gen-card)",
              border: "1px solid var(--gen-border)",
            }}
          >
            <div className="p-2 border-b" style={{ borderColor: "var(--gen-border)" }}>
              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-2 top-1/2 -translate-y-1/2"
                  style={{ color: "var(--gen-muted-fg)" }}
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索图标..."
                  className="w-full pl-8 pr-3 py-2 text-sm rounded"
                  style={{
                    background: "var(--gen-background)",
                    color: "var(--gen-foreground)",
                    border: "1px solid var(--gen-border)",
                  }}
                  autoFocus
                />
              </div>
            </div>
            <div
              className="overflow-y-auto p-2"
              style={{ maxHeight: 220 }}
            >
              <div className="grid grid-cols-8 gap-1">
                {filteredIcons.map((name) => {
                  const Icon = getIconComponent(name);
                  if (!Icon) return null;
                  const isSelected = value === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        onChange(name);
                        setOpen(false);
                      }}
                      className="flex items-center justify-center w-8 h-8 rounded transition-colors"
                      style={{
                        background: isSelected ? "var(--gen-primary)" : "transparent",
                        color: isSelected ? "#fff" : "var(--gen-foreground)",
                      }}
                      title={name}
                    >
                      <Icon size={18} className="flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
              {filteredIcons.length === 0 && (
                <p className="text-xs py-4 text-center" style={{ color: "var(--gen-muted-fg)" }}>
                  未找到匹配的图标
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
