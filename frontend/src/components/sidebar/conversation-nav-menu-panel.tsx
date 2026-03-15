"use client";

import { useAppStore } from "@/store/app-store";
import { Circle, CircleDot } from "lucide-react";
import { useCallback } from "react";
import { updateConversation } from "@/lib/api";
import { toast } from "sonner";

interface ConversationNavMenuPanelProps {
  conversationId: string;
  conversationTitle: string;
  onClose?: () => void;
}

export function ConversationNavMenuPanel({
  conversationId,
  conversationTitle,
  onClose,
}: ConversationNavMenuPanelProps) {
  const { navMenuItems, setNavMenuItems } = useAppStore();

  const saveToConversation = useCallback(
    (items: typeof navMenuItems) => {
      updateConversation(conversationId, { nav_menu_items: items ?? undefined }).catch(() => {
        toast.error("Failed to save");
      });
    },
    [conversationId]
  );

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: "var(--gen-foreground)" }}>
          默认选中菜单项
           {/* — {conversationTitle} */}
        </span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-[10px] underline"
            style={{ color: "var(--gen-muted-fg)" }}
          >
            关闭
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        {(navMenuItems ?? []).map((item, i) => {
          const hasChildren = (item.children?.length ?? 0) > 0;
          if (!hasChildren) {
            return (
              <div key={i} className="flex gap-1.5 items-center">
                <span className="flex-1 text-xs truncate" style={{ color: "var(--gen-foreground)" }}>
                  {item.label || "未命名"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const next = (navMenuItems ?? []).map((it, j) => {
                      if (it.children?.length) {
                        return { ...it, selected: false, children: it.children.map((c) => ({ ...c, selected: false })) };
                      }
                      return { ...it, selected: j === i };
                    });
                    setNavMenuItems(next);
                    saveToConversation(next);
                  }}
                  className="p-1 rounded flex-shrink-0 cursor-pointer"
                  title="设为默认"
                >
                  {item.selected ? (
                    <CircleDot size={16} style={{ color: "var(--gen-primary)" }} />
                  ) : (
                    <Circle size={16} style={{ color: "var(--gen-muted-fg)" }} />
                  )}
                </button>
              </div>
            );
          }
          return (
            <div key={i}>
              <div className="text-[10px] font-medium pl-1 mt-1" style={{ color: "var(--gen-muted-fg)" }}>
                {item.label}
              </div>
              {(item.children ?? []).map((ch, j) => (
                <div key={`${i}-${j}`} className="flex gap-1.5 items-center pl-3">
                  <span className="flex-1 text-xs truncate" style={{ color: "var(--gen-foreground)" }}>
                    {ch.label || "未命名"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const next = (navMenuItems ?? []).map((it, ii) => {
                        if (ii !== i) {
                          return {
                            ...it,
                            selected: false,
                            ...(it.children?.length ? { children: it.children.map((c) => ({ ...c, selected: false })) } : {}),
                          };
                        }
                        return {
                          ...it,
                          selected: false,
                          children: it.children!.map((c, jj) => ({ ...c, selected: jj === j })),
                        };
                      });
                      setNavMenuItems(next);
                      saveToConversation(next);
                    }}
                    className="p-1 rounded flex-shrink-0 cursor-pointer"
                    title="设为默认"
                  >
                    {ch.selected ? (
                      <CircleDot size={16} style={{ color: "var(--gen-primary)" }} />
                    ) : (
                      <Circle size={16} style={{ color: "var(--gen-muted-fg)" }} />
                    )}
                  </button>
                </div>
              ))}
            </div>
          );
        })}
        {(!navMenuItems || navMenuItems.length === 0) && (
          <p className="text-[10px]" style={{ color: "var(--gen-muted-fg)" }}>
            请在项目设置中配置导航菜单
          </p>
        )}
      </div>
    </div>
  );
}
