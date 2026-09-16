import { Label, Switch } from "@heroui/react";

export default function Toggle({
  label,
  selected,
  onChange,
}: {
  label: string;
  selected: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Switch className="layer-toggle w-full" isSelected={selected} onChange={onChange}>
      <Switch.Content>
        <Label>{label}</Label>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
      </Switch.Content>
    </Switch>
  );
}
