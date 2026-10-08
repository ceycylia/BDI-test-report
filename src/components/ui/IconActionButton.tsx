import type { ButtonHTMLAttributes } from "react";
import { CircleCheck, CircleMinus, Eye, Pencil, Trash2 } from "lucide-react";

type IconAction = "edit" | "delete" | "active" | "inactive" | "detail";

const actions = {
  edit: { Icon: Pencil, label: "Edit", className: "icon-action-button--edit" },
  delete: { Icon: Trash2, label: "Hapus", className: "icon-action-button--delete" },
  active: { Icon: CircleCheck, label: "Aktif", className: "icon-action-button--active" },
  inactive: { Icon: CircleMinus, label: "Nonaktif", className: "icon-action-button--inactive" },
  detail: { Icon: Eye, label: "Lihat detail", className: "icon-action-button--detail" },
} as const;

type IconActionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  action: IconAction;
  label?: string;
};

export function IconActionButton({ action, label, className = "", ...props }: IconActionButtonProps) {
  const config = actions[action];
  const accessibleLabel = label ?? config.label;
  const { Icon } = config;
  return <button {...props} type={props.type ?? "button"} className={`icon-action-button ${config.className} ${className}`.trim()} aria-label={accessibleLabel} title={accessibleLabel}><Icon size={17} aria-hidden="true" /></button>;
}

export function StatusIcon({ active, label }: { active: boolean; label?: string }) {
  const accessibleLabel = label ?? (active ? "Aktif" : "Nonaktif");
  const Icon = active ? CircleCheck : CircleMinus;
  return <span className={`status-icon ${active ? "is-active" : "is-inactive"}`} role="img" aria-label={accessibleLabel} title={accessibleLabel}><Icon size={18} aria-hidden="true" /></span>;
}
