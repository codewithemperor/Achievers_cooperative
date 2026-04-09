import { Chip } from "@heroui/react";

interface StatusBadgeProps {
  children: string;
  tone?: "default" | "success" | "warning" | "danger";
}

const colorMap = {
  default: "default",
  success: "success",
  warning: "warning",
  danger: "danger"
} as const;

export function StatusBadge({ children, tone = "default" }: StatusBadgeProps) {
  return (
    <Chip color={colorMap[tone]} radius="sm" size="sm" variant="flat">
      {children}
    </Chip>
  );
}
