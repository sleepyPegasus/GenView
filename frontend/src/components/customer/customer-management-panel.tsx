"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  listCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  listContacts,
  createContact,
  updateContact,
  deleteContact,
  type Customer,
  type Contact,
} from "@/lib/api";
import { Plus, Pencil, Trash2, Loader2, Users, ChevronDown, ChevronRight, UserCircle } from "lucide-react";
import { ThemeInjector } from "@/components/theme-injector";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export function CustomerManagementPanel() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editContact, setEditContact] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createCode, setCreateCode] = useState("");
  const [createMainContact, setCreateMainContact] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<Customer | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [contactsByCustomer, setContactsByCustomer] = useState<Record<string, Contact[]>>({});
  const [contactsLoading, setContactsLoading] = useState<Record<string, boolean>>({});
  const [contactCreateCustomerId, setContactCreateCustomerId] = useState<string | null>(null);
  const [contactEdit, setContactEdit] = useState<{ customerId: string; contact: Contact } | null>(null);
  const [contactDeleteConfirm, setContactDeleteConfirm] = useState<{ customerId: string; contact: Contact } | null>(null);
  const [contactForm, setContactForm] = useState({ name: "", role: "", phone: "", email: "" });

  useEffect(() => {
    let cancelled = false;
    listCustomers()
      .then((list) => {
        if (!cancelled) setCustomers(list);
      })
      .catch(() => {
        if (!cancelled) toast.error("加载客户列表失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const loadContacts = useCallback(async (customerId: string) => {
    setContactsLoading((prev) => ({ ...prev, [customerId]: true }));
    try {
      const list = await listContacts(customerId);
      setContactsByCustomer((prev) => ({ ...prev, [customerId]: list }));
    } catch {
      toast.error("加载联系人失败");
    } finally {
      setContactsLoading((prev) => ({ ...prev, [customerId]: false }));
    }
  }, []);

  const toggleExpand = (customerId: string) => {
    setExpandedId((prev) => {
      const next = prev === customerId ? null : customerId;
      if (next && !contactsByCustomer[customerId]) loadContacts(customerId);
      return next;
    });
  };

  const handleCreateConfirm = async () => {
    if (!createName.trim()) {
      toast.error("请输入客户名称");
      return;
    }
    if (creating) return;
    setCreating(true);
    setCreateDialogOpen(false);
    try {
      const c = await createCustomer({
        name: createName.trim(),
        code: createCode.trim() || undefined,
        contact: createMainContact.trim() || undefined,
      });
      setCustomers((prev) => [c, ...prev]);
      toast.success("客户已创建");
      setCreateName("");
      setCreateCode("");
      setCreateMainContact("");
    } catch (err) {
      toast.error("创建失败", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleStartEdit = (c: Customer) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditCode(c.code ?? "");
    setEditContact(c.contact ?? "");
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) {
      setEditingId(null);
      return;
    }
    try {
      const updated = await updateCustomer(editingId, {
        name: editName.trim(),
        code: editCode.trim() || undefined,
        contact: editContact.trim() || undefined,
      });
      setCustomers((prev) =>
        prev.map((x) => (x.id === editingId ? updated : x))
      );
      toast.success("已保存");
    } catch (err) {
      toast.error("保存失败", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setEditingId(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    const c = deleteConfirm;
    setDeleteConfirm(null);
    try {
      await deleteCustomer(c.id);
      setCustomers((prev) => prev.filter((x) => x.id !== c.id));
      setContactsByCustomer((prev) => {
        const next = { ...prev };
        delete next[c.id];
        return next;
      });
      toast.success("客户已删除");
    } catch (err) {
      toast.error("删除失败", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handleContactCreateConfirm = async () => {
    if (!contactCreateCustomerId || !contactForm.name.trim()) return;
    const customerId = contactCreateCustomerId;
    setContactCreateCustomerId(null);
    try {
      const created = await createContact(customerId, {
        name: contactForm.name.trim(),
        role: contactForm.role.trim() || undefined,
        phone: contactForm.phone.trim() || undefined,
        email: contactForm.email.trim() || undefined,
      });
      setContactsByCustomer((prev) => ({
        ...prev,
        [customerId]: [...(prev[customerId] ?? []), created],
      }));
      setContactForm({ name: "", role: "", phone: "", email: "" });
      toast.success("联系人已添加");
    } catch (err) {
      toast.error("添加失败", { description: err instanceof Error ? err.message : "Unknown error" });
    }
  };

  const handleContactEditSave = async () => {
    if (!contactEdit) return;
    const { customerId, contact } = contactEdit;
    setContactEdit(null);
    try {
      const updated = await updateContact(customerId, contact.id, {
        name: contactForm.name.trim(),
        role: contactForm.role.trim() || undefined,
        phone: contactForm.phone.trim() || undefined,
        email: contactForm.email.trim() || undefined,
      });
      setContactsByCustomer((prev) => ({
        ...prev,
        [customerId]: (prev[customerId] ?? []).map((x) => (x.id === contact.id ? updated : x)),
      }));
      setContactForm({ name: "", role: "", phone: "", email: "" });
      toast.success("已保存");
    } catch (err) {
      toast.error("保存失败", { description: err instanceof Error ? err.message : "Unknown error" });
    }
  };

  const handleContactDeleteConfirm = async () => {
    if (!contactDeleteConfirm) return;
    const { customerId, contact } = contactDeleteConfirm;
    setContactDeleteConfirm(null);
    try {
      await deleteContact(customerId, contact.id);
      setContactsByCustomer((prev) => ({
        ...prev,
        [customerId]: (prev[customerId] ?? []).filter((x) => x.id !== contact.id),
      }));
      toast.success("联系人已删除");
    } catch (err) {
      toast.error("删除失败", { description: err instanceof Error ? err.message : "Unknown error" });
    }
  };

  return (
    <div
      className="relative flex flex-1 flex-col w-full overflow-auto"
      data-theme="modern-b2b"
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
      }}
    >
      <ThemeInjector />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      <div className="relative z-10 flex flex-1 flex-col p-8">
        <div
          className="w-full max-w-4xl mx-auto rounded-2xl p-8 backdrop-blur-xl border"
          style={{
            background: "rgba(255, 255, 255, 0.05)",
            borderColor: "rgba(255, 255, 255, 0.1)",
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
          }}
        >
          <h2 className="text-xl font-bold mb-2 flex items-center gap-2" style={{ color: "#f1f5f9" }}>
            <Users size={22} />
            客户管理
          </h2>
          <p className="text-sm mb-6" style={{ color: "#94a3b8" }}>
            管理客户信息，创建项目时可选择所属客户。
          </p>

          <div className="flex justify-end mb-4">
            <button
              onClick={() => {
                setCreateName("");
                setCreateCode("");
                setCreateMainContact("");
                setCreateDialogOpen(true);
              }}
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
              style={{
                background: "var(--gen-primary)",
                color: "#fff",
              }}
            >
              {creating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Plus size={16} />
              )}
              新建客户
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size={24} label="加载中..." />
            </div>
          ) : customers.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-16 rounded-xl border-2 border-dashed"
              style={{ borderColor: "rgba(255,255,255,0.15)", color: "#94a3b8" }}
            >
              <Users size={48} className="mb-4 opacity-50" />
              <p className="text-sm font-medium mb-1">暂无客户</p>
              <p className="text-xs">点击「新建客户」添加第一个客户</p>
            </div>
          ) : (
            <div className="space-y-3">
              {customers.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl overflow-hidden"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <div className="flex items-center gap-2 p-4">
                    <button
                      onClick={() => toggleExpand(c.id)}
                      className="p-1 rounded hover:bg-white/10 transition-colors"
                      style={{ color: "#94a3b8" }}
                      title={expandedId === c.id ? "折叠" : "展开联系人"}
                    >
                      {expandedId === c.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    {editingId === c.id ? (
                      <>
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="客户名称"
                            className="text-sm px-3 py-2 rounded border"
                            style={{
                              background: "rgba(15,23,42,0.8)",
                              color: "#f1f5f9",
                              borderColor: "rgba(255,255,255,0.2)",
                            }}
                          />
                          <input
                            value={editCode}
                            onChange={(e) => setEditCode(e.target.value)}
                            placeholder="客户编码"
                            className="text-sm px-3 py-2 rounded border"
                            style={{
                              background: "rgba(15,23,42,0.8)",
                              color: "#f1f5f9",
                              borderColor: "rgba(255,255,255,0.2)",
                            }}
                          />
                          <input
                            value={editContact}
                            onChange={(e) => setEditContact(e.target.value)}
                            placeholder="联系人"
                            className="text-sm px-3 py-2 rounded border"
                            style={{
                              background: "rgba(15,23,42,0.8)",
                              color: "#f1f5f9",
                              borderColor: "rgba(255,255,255,0.2)",
                            }}
                          />
                        </div>
                        <button
                          onClick={handleSaveEdit}
                          className="px-3 py-1.5 text-xs rounded font-medium"
                          style={{ background: "var(--gen-primary)", color: "#fff" }}
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 text-xs rounded"
                          style={{ color: "#94a3b8" }}
                        >
                          取消
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: "#f1f5f9" }}>
                            {c.name}
                          </p>
                          <div className="flex gap-3 mt-1 items-center">
                            {c.code && (
                              <span className="text-xs" style={{ color: "#94a3b8" }}>
                                编码: {c.code}
                              </span>
                            )}
                            {c.contact && (
                              <span className="text-xs" style={{ color: "#94a3b8" }}>
                                联系人: {c.contact}
                              </span>
                            )}
                            {(contactsByCustomer[c.id]?.length ?? 0) > 0 && (
                              <span className="text-xs" style={{ color: "#64748b" }}>
                                {contactsByCustomer[c.id].length} 个联系人
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleStartEdit(c)}
                          className="p-2 rounded hover:bg-white/10 transition-colors"
                          style={{ color: "#94a3b8" }}
                          title="编辑"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(c)}
                          className="p-2 rounded hover:bg-white/10 transition-colors"
                          style={{ color: "#94a3b8" }}
                          title="删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                  {expandedId === c.id && (
                    <div
                      className="border-t px-4 py-3"
                      style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(0,0,0,0.15)" }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium" style={{ color: "#94a3b8" }}>
                          联系人
                        </span>
                        <button
                          onClick={() => {
                            setContactForm({ name: "", role: "", phone: "", email: "" });
                            setContactCreateCustomerId(c.id);
                          }}
                          className="flex items-center gap-1.5 px-2 py-1 text-xs rounded"
                          style={{ background: "var(--gen-primary)", color: "#fff" }}
                        >
                          <Plus size={12} />
                          新建联系人
                        </button>
                      </div>
                      {contactsLoading[c.id] ? (
                        <div className="flex justify-center py-4">
                          <Loader2 size={18} className="animate-spin" style={{ color: "#94a3b8" }} />
                        </div>
                      ) : (contactsByCustomer[c.id] ?? []).length === 0 ? (
                        <p className="text-xs py-2" style={{ color: "#64748b" }}>
                          暂无联系人，点击「新建联系人」添加
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {(contactsByCustomer[c.id] ?? []).map((ct) => (
                            <div
                              key={ct.id}
                              className="flex items-center gap-3 px-3 py-2 rounded"
                              style={{ background: "rgba(255,255,255,0.05)" }}
                            >
                              <UserCircle size={14} style={{ color: "#64748b" }} />
                              <div className="flex-1 min-w-0">
                                <span className="text-sm" style={{ color: "#e2e8f0" }}>
                                  {ct.name}
                                  {ct.role && (
                                    <span className="text-xs ml-2" style={{ color: "#94a3b8" }}>
                                      {ct.role}
                                    </span>
                                  )}
                                </span>
                                {(ct.phone || ct.email) && (
                                  <p className="text-xs mt-0.5 truncate" style={{ color: "#64748b" }}>
                                    {[ct.phone, ct.email].filter(Boolean).join(" · ")}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  setContactForm({
                                    name: ct.name,
                                    role: ct.role ?? "",
                                    phone: ct.phone ?? "",
                                    email: ct.email ?? "",
                                  });
                                  setContactEdit({ customerId: c.id, contact: ct });
                                }}
                                className="p-1.5 rounded hover:bg-white/10"
                                style={{ color: "#94a3b8" }}
                                title="编辑"
                              >
                                <Pencil size={12} />
                              </button>
                              <button
                                onClick={() => setContactDeleteConfirm({ customerId: c.id, contact: ct })}
                                className="p-1.5 rounded hover:bg-white/10"
                                style={{ color: "#94a3b8" }}
                                title="删除"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create dialog */}
      {createDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setCreateDialogOpen(false)}
        >
          <div
            className="rounded-lg p-4 w-full max-w-sm mx-4"
            style={{
              background: "rgba(15, 23, 42, 0.95)",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium mb-3" style={{ color: "#f1f5f9" }}>
              新建客户
            </h3>
            <div className="space-y-2 mb-4">
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="客户名称 *"
                className="w-full text-sm px-3 py-2 rounded border"
                style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  color: "#f1f5f9",
                  borderColor: "rgba(255,255,255,0.2)",
                }}
                autoFocus
              />
              <input
                type="text"
                value={createCode}
                onChange={(e) => setCreateCode(e.target.value)}
                placeholder="客户编码"
                className="w-full text-sm px-3 py-2 rounded border"
                style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  color: "#f1f5f9",
                  borderColor: "rgba(255,255,255,0.2)",
                }}
              />
              <input
                type="text"
                value={createMainContact}
                onChange={(e) => setCreateMainContact(e.target.value)}
                placeholder="联系人"
                className="w-full text-sm px-3 py-2 rounded border"
                style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  color: "#f1f5f9",
                  borderColor: "rgba(255,255,255,0.2)",
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setCreateDialogOpen(false)}
                className="px-3 py-1.5 text-xs rounded"
                style={{ color: "#94a3b8" }}
              >
                取消
              </button>
              <button
                onClick={handleCreateConfirm}
                disabled={creating || !createName.trim()}
                className="px-3 py-1.5 text-xs rounded font-medium flex items-center gap-1.5"
                style={{
                  background: "var(--gen-primary)",
                  color: "#fff",
                }}
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : null}
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="rounded-lg p-4 w-full max-w-sm mx-4"
            style={{
              background: "rgba(15, 23, 42, 0.95)",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium mb-2" style={{ color: "#f1f5f9" }}>
              确认删除
            </h3>
            <p className="text-sm mb-4" style={{ color: "#94a3b8" }}>
              确定要删除客户「{deleteConfirm.name}」？
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 text-xs rounded"
                style={{ color: "#94a3b8" }}
              >
                取消
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-3 py-1.5 text-xs rounded font-medium"
                style={{
                  background: "#ef4444",
                  color: "#fff",
                }}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact create dialog */}
      {contactCreateCustomerId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setContactCreateCustomerId(null)}
        >
          <div
            className="rounded-lg p-4 w-full max-w-sm mx-4"
            style={{
              background: "rgba(15, 23, 42, 0.95)",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium mb-3" style={{ color: "#f1f5f9" }}>
              新建联系人
            </h3>
            <div className="space-y-2 mb-4">
              <input
                value={contactForm.name}
                onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="姓名 *"
                className="w-full text-sm px-3 py-2 rounded border"
                style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  color: "#f1f5f9",
                  borderColor: "rgba(255,255,255,0.2)",
                }}
              />
              <input
                value={contactForm.role}
                onChange={(e) => setContactForm((p) => ({ ...p, role: e.target.value }))}
                placeholder="职务"
                className="w-full text-sm px-3 py-2 rounded border"
                style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  color: "#f1f5f9",
                  borderColor: "rgba(255,255,255,0.2)",
                }}
              />
              <input
                value={contactForm.phone}
                onChange={(e) => setContactForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="电话"
                className="w-full text-sm px-3 py-2 rounded border"
                style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  color: "#f1f5f9",
                  borderColor: "rgba(255,255,255,0.2)",
                }}
              />
              <input
                type="email"
                value={contactForm.email}
                onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="邮箱"
                className="w-full text-sm px-3 py-2 rounded border"
                style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  color: "#f1f5f9",
                  borderColor: "rgba(255,255,255,0.2)",
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setContactCreateCustomerId(null)}
                className="px-3 py-1.5 text-xs rounded"
                style={{ color: "#94a3b8" }}
              >
                取消
              </button>
              <button
                onClick={handleContactCreateConfirm}
                disabled={!contactForm.name.trim()}
                className="px-3 py-1.5 text-xs rounded font-medium"
                style={{ background: "var(--gen-primary)", color: "#fff" }}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact edit dialog */}
      {contactEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setContactEdit(null)}
        >
          <div
            className="rounded-lg p-4 w-full max-w-sm mx-4"
            style={{
              background: "rgba(15, 23, 42, 0.95)",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium mb-3" style={{ color: "#f1f5f9" }}>
              编辑联系人
            </h3>
            <div className="space-y-2 mb-4">
              <input
                value={contactForm.name}
                onChange={(e) => setContactForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="姓名 *"
                className="w-full text-sm px-3 py-2 rounded border"
                style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  color: "#f1f5f9",
                  borderColor: "rgba(255,255,255,0.2)",
                }}
              />
              <input
                value={contactForm.role}
                onChange={(e) => setContactForm((p) => ({ ...p, role: e.target.value }))}
                placeholder="职务"
                className="w-full text-sm px-3 py-2 rounded border"
                style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  color: "#f1f5f9",
                  borderColor: "rgba(255,255,255,0.2)",
                }}
              />
              <input
                value={contactForm.phone}
                onChange={(e) => setContactForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="电话"
                className="w-full text-sm px-3 py-2 rounded border"
                style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  color: "#f1f5f9",
                  borderColor: "rgba(255,255,255,0.2)",
                }}
              />
              <input
                type="email"
                value={contactForm.email}
                onChange={(e) => setContactForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="邮箱"
                className="w-full text-sm px-3 py-2 rounded border"
                style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  color: "#f1f5f9",
                  borderColor: "rgba(255,255,255,0.2)",
                }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setContactEdit(null)}
                className="px-3 py-1.5 text-xs rounded"
                style={{ color: "#94a3b8" }}
              >
                取消
              </button>
              <button
                onClick={handleContactEditSave}
                disabled={!contactForm.name.trim()}
                className="px-3 py-1.5 text-xs rounded font-medium"
                style={{ background: "var(--gen-primary)", color: "#fff" }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact delete confirmation */}
      {contactDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={() => setContactDeleteConfirm(null)}
        >
          <div
            className="rounded-lg p-4 w-full max-w-sm mx-4"
            style={{
              background: "rgba(15, 23, 42, 0.95)",
              border: "1px solid rgba(255,255,255,0.15)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium mb-2" style={{ color: "#f1f5f9" }}>
              确认删除
            </h3>
            <p className="text-sm mb-4" style={{ color: "#94a3b8" }}>
              确定要删除联系人「{contactDeleteConfirm.contact.name}」？
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setContactDeleteConfirm(null)}
                className="px-3 py-1.5 text-xs rounded"
                style={{ color: "#94a3b8" }}
              >
                取消
              </button>
              <button
                onClick={handleContactDeleteConfirm}
                className="px-3 py-1.5 text-xs rounded font-medium"
                style={{ background: "#ef4444", color: "#fff" }}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
