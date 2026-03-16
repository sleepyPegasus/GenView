"use client";

import React, { createContext, useCallback, useContext, useState } from "react";

export interface MonacoEditorApi {
  getSelection: () => { startLine: number; startColumn: number; endLine: number; endColumn: number } | null;
  getSelectedText: () => string;
  replaceSelection: (newText: string) => void;
  hasSelection: () => boolean;
}

const MonacoEditorApiContext = createContext<{
  api: MonacoEditorApi | null;
  setApi: (api: MonacoEditorApi | null) => void;
} | null>(null);

export function MonacoEditorApiProvider({ children }: { children: React.ReactNode }) {
  const [api, setApi] = useState<MonacoEditorApi | null>(null);
  return (
    <MonacoEditorApiContext.Provider value={{ api, setApi }}>
      {children}
    </MonacoEditorApiContext.Provider>
  );
}

export function useMonacoEditorApi() {
  const ctx = useContext(MonacoEditorApiContext);
  return ctx?.api ?? null;
}

export function useMonacoEditorApiSetter() {
  const ctx = useContext(MonacoEditorApiContext);
  return ctx?.setApi ?? (() => {});
}
