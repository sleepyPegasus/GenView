"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { ChevronDown, Search, Loader2 } from "lucide-react";
import type { OpenRouterModel } from "@/app/api/models/route";

interface ModelSelectorProps {
  value: string;
  onChange: (modelId: string) => void;
}

// Preset popular models shown when no search / as favorites at top
const POPULAR_IDS = [
  "anthropic/claude-sonnet-4-20250514",
  "anthropic/claude-3.5-sonnet",
  "openai/gpt-4o",
  "openai/gpt-4o-mini",
  "google/gemini-2.5-pro-preview",
  "deepseek/deepseek-chat-v3-0324",
];

function formatPrice(perToken: string): string {
  const val = parseFloat(perToken);
  if (isNaN(val) || val === 0) return "Free";
  // price is per-token, convert to per-million-tokens
  const perMillion = val * 1_000_000;
  if (perMillion < 0.01) return "<$0.01/M";
  return `$${perMillion.toFixed(2)}/M`;
}

function getProvider(modelId: string): string {
  return modelId.split("/")[0] ?? "";
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch models on first open
  const fetchModels = useCallback(async () => {
    if (fetched || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/models");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setModels(data);
        }
      }
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, [fetched, loading]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [open]);

  // Focus search input when opened
  useEffect(() => {
    if (open) {
      fetchModels();
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearch("");
    }
  }, [open, fetchModels]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const list = q
      ? models.filter(
          (m) =>
            m.id.toLowerCase().includes(q) ||
            m.name.toLowerCase().includes(q)
        )
      : models;

    // Sort: popular models first, then alphabetical
    return [...list].sort((a, b) => {
      const aPop = POPULAR_IDS.indexOf(a.id);
      const bPop = POPULAR_IDS.indexOf(b.id);
      if (aPop !== -1 && bPop !== -1) return aPop - bPop;
      if (aPop !== -1) return -1;
      if (bPop !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [models, search]);

  // Current display value
  const selectedModel = models.find((m) => m.id === value);
  const displayName = selectedModel?.name ?? value.split("/").pop() ?? value;

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-9 w-full items-center justify-between rounded-md border border-[--gen-border] bg-[--gen-card] px-3 py-1 text-sm shadow-sm transition-colors hover:bg-[--gen-muted] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[--gen-primary]"
      >
        <span className="truncate text-left">{displayName}</span>
        <ChevronDown size={14} className="ml-2 flex-shrink-0 opacity-50" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[320px] right-0 rounded-lg border border-[--gen-border] bg-[--gen-card] shadow-lg">
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-[--gen-border] px-3 py-2">
            <Search size={14} className="text-[--gen-muted-fg] flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models..."
              className="w-full bg-transparent text-sm text-[--gen-foreground] placeholder:text-[--gen-muted-fg] focus:outline-none"
            />
          </div>

          {/* Model list */}
          <div ref={listRef} className="max-h-[300px] overflow-y-auto p-1">
            {loading && (
              <div className="flex items-center justify-center gap-2 py-6 text-[--gen-muted-fg]">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-xs">Loading models...</span>
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="py-6 text-center text-xs text-[--gen-muted-fg]">
                {search ? "No models found" : "No models available"}
              </div>
            )}

            {filtered.map((m) => {
              const isSelected = m.id === value;
              const isPopular = POPULAR_IDS.includes(m.id);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
                    isSelected
                      ? "bg-[--gen-primary] text-white"
                      : "hover:bg-[--gen-muted] text-[--gen-foreground]"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium text-xs">
                        {m.name}
                      </span>
                      {isPopular && (
                        <span
                          className={`flex-shrink-0 rounded px-1 py-0.5 text-[10px] leading-none ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-[--gen-primary]/10 text-[--gen-primary]"
                          }`}
                        >
                          Popular
                        </span>
                      )}
                    </div>
                    <div
                      className={`mt-0.5 flex items-center gap-2 text-[10px] ${
                        isSelected ? "text-white/70" : "text-[--gen-muted-fg]"
                      }`}
                    >
                      <span>{getProvider(m.id)}</span>
                      <span>·</span>
                      <span>{(m.context_length / 1000).toFixed(0)}K ctx</span>
                      <span>·</span>
                      <span>In: {formatPrice(m.pricing.prompt)}</span>
                      <span>·</span>
                      <span>Out: {formatPrice(m.pricing.completion)}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
