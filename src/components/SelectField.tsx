import type { ReactNode } from "react";
import { Label, ListBox, Select } from "@heroui/react";

type Option = string | { id: string; label: string };
export default function SelectField({
  label,
  value,
  values,
  onChange,
  placeholder = "Choose an option",
  children,
}: {
  label: string;
  value: string;
  values: Option[];
  onChange: (value: string) => void;
  placeholder?: string;
  children?: ReactNode;
}) {
  const items = values.map((v) => (typeof v === "string" ? { id: v, label: v } : v));
  return (
    <Select
      fullWidth
      // The panel is already a raised surface, so fields sit on it in the tinted variant rather
      // than floating white on white.
      variant="secondary"
      aria-label={label}
      value={value || null}
      onChange={(key) => onChange(key == null ? "" : String(key))}
      placeholder={placeholder}
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox items={items}>
          {(item) => (
            <ListBox.Item id={item.id} textValue={item.label}>
              <Label>{item.label}</Label>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          )}
        </ListBox>
      </Select.Popover>
      {children}
    </Select>
  );
}
