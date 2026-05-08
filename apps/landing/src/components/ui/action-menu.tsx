"use client";

import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import {
  DropdownItem,
  DropdownMenu,
  DropdownPopover,
  DropdownRoot,
  DropdownTrigger,
} from "@heroui/react";
import { ConfirmModal } from "@/components/ui/confirm-modal";

export interface ActionMenuItem {
  label: string;
  onSelect: () => Promise<void> | void;
  tone?: "neutral" | "success" | "danger";
  confirmTitle?: string;
  confirmMessage?: string;
  isDisabled?: boolean;
}

export function ActionMenu({ items }: { items: ActionMenuItem[] }) {
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState<ActionMenuItem | null>(null);
  const availableItems = items.filter((item) => !item.isDisabled);

  async function runAction(item: ActionMenuItem) {
    try {
      setPending(true);
      await item.onSelect();
      setConfirming(null);
    } finally {
      setPending(false);
    }
  }

  if (!availableItems.length) {
    return <span />;
  }

  return (
    <>
      <div
        className="inline-flex justify-end"
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownRoot>
          <DropdownTrigger
            aria-label="Open actions"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-primary-900/12 bg-white text-text-700 transition hover:bg-background-100"
            type="button"
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownTrigger>
          <DropdownPopover className="z-[9998] min-w-52" placement="bottom end">
            <DropdownMenu aria-label="Record actions">
              {availableItems.map((item) => (
                <DropdownItem
                  className={`cursor-pointer rounded-xl px-3 py-2 text-sm font-medium ${
                    item.tone === "danger"
                      ? "text-[#b42318]"
                      : item.tone === "success"
                        ? "text-[var(--primary-700)]"
                        : "text-text-800"
                  }`}
                  id={item.label}
                  key={item.label}
                  onAction={() => {
                    if (pending) return;
                    if (item.confirmTitle || item.confirmMessage) {
                      setConfirming(item);
                      return;
                    }
                    void runAction(item);
                  }}
                >
                  {item.label}
                </DropdownItem>
              ))}
            </DropdownMenu>
          </DropdownPopover>
        </DropdownRoot>
      </div>
      <ConfirmModal
        confirmLabel={pending ? "Processing..." : "Confirm"}
        isOpen={Boolean(confirming)}
        message={
          confirming?.confirmMessage ||
          "Are you sure you want to continue with this action?"
        }
        onCancel={() => {
          if (!pending) setConfirming(null);
        }}
        onConfirm={() => {
          if (confirming) void runAction(confirming);
        }}
        title={confirming?.confirmTitle || "Confirm action"}
      />
    </>
  );
}
