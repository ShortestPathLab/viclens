import type { ReactNode } from "react";
import { Description, Header, Label, ListBox, Select } from "@heroui/react";

export type Option = string | { id: string; label: string; description?: string; section?: string };
interface Item {
  id: string;
  label: string;
  description?: string;
  section?: string;
}
function renderItem(item: Item) {
  return (
    <ListBox.Item key={item.id} id={item.id} textValue={item.label}>
      <div className="flex min-w-0 flex-col">
        <Label>{item.label}</Label>
        {item.description && <Description>{item.description}</Description>}
      </div>
      <ListBox.ItemIndicator />
    </ListBox.Item>
  );
}
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
  const items: Item[] = values.map((v) => (typeof v === "string" ? { id: v, label: v } : v));
  // Options that name a section are grouped under it, in the order the sections first appear.
  const sections = [...new Set(items.map((item) => item.section))];
  const grouped = sections.length > 1 || sections[0] !== undefined;
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
        {/* The field shows the option's name alone, without the description under it. */}
        <Select.Value>
          {({ isPlaceholder, selectedText, defaultChildren }) =>
            isPlaceholder ? defaultChildren : selectedText
          }
        </Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {grouped
            ? sections.map((section) => (
                <ListBox.Section key={section ?? "other"} id={section ?? "other"}>
                  {section && <Header>{section}</Header>}
                  {items.filter((item) => item.section === section).map(renderItem)}
                </ListBox.Section>
              ))
            : items.map(renderItem)}
        </ListBox>
      </Select.Popover>
      {children}
    </Select>
  );
}
