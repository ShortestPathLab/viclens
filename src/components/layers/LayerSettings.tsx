import { useMemo } from "react";
import type { ReactNode } from "react";
import { useAtom, useSetAtom } from "jotai";
import {
  Alert,
  Button,
  Label,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@heroui/react";
import { Copy, Trash2 } from "lucide-react";
import { levelLabel } from "../../data";
import type { AreaProperties } from "../../data";
import { useZoneIndexQuery } from "../../queries";
import { labelOf } from "../../layers/fields";
import type { Field, FieldContext } from "../../layers/fields";
import {
  categoryFields,
  controls,
  datasetOrder,
  datasets,
  displays,
  findField,
  numberFields,
  sizeControls,
} from "../../layers/model";
import { cssColor, paletteOptions, rampSteps } from "../../layers/palettes";
import type { PaletteId } from "../../layers/palettes";
import { classOptions } from "../../layers/scales";
import type { ClassMethod } from "../../layers/scales";
import {
  duplicateLayerAtom,
  removeLayerAtom,
  selectedAreaAtom,
  updateLayerAtom,
} from "../../layers/state";
import type { LayerView } from "../../layers/useLayerViews";
import { formatNumber } from "../../data";
import SelectField from "../SelectField";

/** A one-of-several choice as a row of toggle buttons, labelled like the other fields. */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  iconOnly = false,
}: {
  label: string;
  value: T;
  options: { id: T; label: string; content?: ReactNode }[];
  onChange: (value: T) => void;
  iconOnly?: boolean;
}) {
  const id = `segmented-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="grid grid-cols-1 gap-2">
      <Label id={id}>{label}</Label>
      <ToggleButtonGroup
        size="sm"
        aria-labelledby={id}
        selectionMode="single"
        disallowEmptySelection
        isDetached={iconOnly}
        className={iconOnly ? "flex-wrap justify-start gap-1.5" : "w-full"}
        selectedKeys={[value]}
        onSelectionChange={(keys) => {
          const next = [...keys][0];
          if (next !== undefined) onChange(String(next) as T);
        }}
      >
        {options.map((option) => (
          <ToggleButton
            key={option.id}
            id={option.id}
            aria-label={option.label}
            className={iconOnly ? "" : "flex-1"}
          >
            {option.content ?? option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <Slider
      className="w-full"
      value={value}
      minValue={min}
      maxValue={max}
      step={step}
      onChange={(next) => onChange(Array.isArray(next) ? next[0] : next)}
    >
      <Label>{label}</Label>
      <Slider.Output>{({ state }) => format(state.values[0])}</Slider.Output>
      <Slider.Track>
        <Slider.Fill />
        <Slider.Thumb />
      </Slider.Track>
    </Slider>
  );
}

/** Fields with at least one value in the layer's data, so nothing on offer draws an empty map. */
function useAvailable(view: LayerView, fields: Field<never>[]) {
  return useMemo(() => {
    if (view.status !== "ready") return fields;
    return fields.filter((field) => {
      const get = field.get as (item: unknown, ctx: FieldContext) => unknown;
      return view.items.some((item) => get(item, view.ctx) != null);
    });
  }, [fields, view.items, view.ctx, view.status]);
}
const fieldOptions = (fields: Field<never>[], ctx: FieldContext) =>
  fields.map((field) => ({ id: field.id, label: labelOf(field, ctx), section: field.group }));

export default function LayerSettings({ view }: { view: LayerView }) {
  const { config, dataset, ctx } = view;
  const update = useSetAtom(updateLayerAtom);
  const remove = useSetAtom(removeLayerAtom);
  const duplicate = useSetAtom(duplicateLayerAtom);
  const [selectedArea, setSelectedArea] = useAtom(selectedAreaAtom);
  const { data: zoneIndex } = useZoneIndexQuery();
  const set = (patch: Parameters<typeof update>[1]) => update(config.id, patch);
  const used = controls[config.display];
  const numbers = useAvailable(view, numberFields(config.dataset));
  const categories = useAvailable(view, categoryFields(config.dataset));
  const field = findField(config.dataset, config.field);
  const numberField = field?.kind === "number" ? field : null;
  const size = sizeControls[config.display];
  // The current choice stays on offer even when this data has no values for it.
  const withCurrent = (fields: Field<never>[], id: string | undefined) => {
    const current = findField(config.dataset, id);
    return current && !fields.includes(current) ? [current, ...fields] : fields;
  };
  const weightOptions = [
    { id: "count", label: `None, count ${dataset.noun[1]}` },
    ...fieldOptions(
      config.display === "heatmap"
        ? withCurrent(numbers, config.field).filter((f) => f.kind === "number" && f.additive)
        : withCurrent(numbers, config.field),
      ctx,
    ),
  ];
  const zoneYears = zoneIndex?.years.map((y) => y.year) ?? [];
  const areas =
    (config.dataset === "lgas" || config.dataset === "sa2") && view.status === "ready"
      ? (view.items as { properties: AreaProperties }[])
          .map((f) => ({ id: f.properties.code, label: f.properties.name }))
          .sort((a, b) => a.label.localeCompare(b.label))
      : [];

  return (
    <div className="grid grid-cols-1 gap-4 px-3 pt-1 pb-3">
      <SelectField
        label="Dataset"
        value={config.dataset}
        values={datasetOrder.map((id) => ({
          id,
          label: datasets[id].label,
          description: datasets[id].description,
        }))}
        onChange={(id) => id && set({ dataset: id as typeof config.dataset })}
      />
      <SelectField
        label="Displayed as"
        value={config.display}
        values={dataset.displays.map((id) => ({
          id,
          label: displays[id].label,
          description: displays[id].description,
        }))}
        onChange={(id) => id && set({ display: id as typeof config.display })}
      />
      {config.dataset === "zones" && (
        <div className="grid grid-cols-1 gap-4">
          {zoneYears.length > 1 && (
            <Segmented
              label="Zone year"
              value={String(view.zoneYear ?? zoneYears[0])}
              options={zoneYears.map((year) => ({ id: String(year), label: String(year) }))}
              onChange={(year) => set({ zoneYear: Number(year) })}
            />
          )}
          <SelectField
            label="Year level"
            value={config.zoneLevel ?? "P6"}
            values={["P6", "7", "8", "9", "10", "11", "12"].map((id) => ({
              id,
              label: levelLabel(id),
            }))}
            onChange={(zoneLevel) => zoneLevel && set({ zoneLevel })}
          />
        </div>
      )}
      {used.includes("field") && (
        <SelectField
          label={config.display === "bubbles" ? "Size by" : "Shade by"}
          value={config.field ?? ""}
          values={fieldOptions(
            config.display === "bubbles"
              ? withCurrent(numbers, config.field).filter((f) => f.kind === "number" && f.additive)
              : withCurrent(numbers, config.field),
            ctx,
          )}
          onChange={(id) => id && set({ field: id })}
        />
      )}
      {used.includes("weight") && (
        <SelectField
          label="Weight"
          value={config.field ?? "count"}
          values={weightOptions}
          onChange={(id) => id && set({ field: id })}
        />
      )}
      {used.includes("colorBy") && (
        <SelectField
          label="Colour by"
          value={config.colorBy ?? "none"}
          values={[
            { id: "none", label: "One colour" },
            ...fieldOptions(withCurrent(categories, config.colorBy), ctx),
          ]}
          onChange={(id) => id && set({ colorBy: id })}
        />
      )}
      {used.includes("aggregation") && config.field !== "count" && (
        <Segmented
          label="Per hexagon"
          value={config.aggregation ?? "mean"}
          options={[
            { id: "mean", label: "Average" },
            { id: "sum", label: "Total" },
          ]}
          onChange={(aggregation) => set({ aggregation })}
        />
      )}
      {used.includes("classes") && numberField && !numberField.discrete && (
        <Segmented<ClassMethod>
          label="Classes"
          value={
            numberField.diverging && config.classes === "quantile"
              ? "equal"
              : (config.classes ?? "quantile")
          }
          options={classOptions.filter((o) => !(numberField.diverging && o.id === "quantile"))}
          onChange={(classes) => set({ classes })}
        />
      )}
      {used.includes("palette") && !numberField?.diverging && (
        <Segmented<PaletteId>
          label="Palette"
          iconOnly
          value={config.palette ?? "violet"}
          options={paletteOptions.map((palette) => ({
            ...palette,
            content: (
              <i
                className="block h-2.5 w-9 rounded-full"
                style={{
                  background: `linear-gradient(90deg, ${rampSteps(palette.id, 5, ctx.scheme, 0.1, 1)
                    .map((c) => cssColor(c))
                    .join(", ")})`,
                }}
              />
            ),
          }))}
          onChange={(palette) => set({ palette })}
        />
      )}
      {used.includes("size") && size && (
        <RangeField
          label={size.label}
          value={config.size ?? size.value}
          min={size.min}
          max={size.max}
          step={size.step}
          format={size.format}
          onChange={(value) => set({ size: value })}
        />
      )}
      <RangeField
        label="Opacity"
        value={Math.round(config.opacity * 100)}
        min={0}
        max={100}
        step={5}
        format={(v) => `${formatNumber(v)}%`}
        onChange={(value) => set({ opacity: value / 100 })}
      />
      {areas.length > 0 && (
        <SelectField
          label="Inspect an area"
          placeholder="Choose an area"
          value={selectedArea?.dataset === config.dataset ? selectedArea.code : ""}
          values={areas}
          onChange={(code) =>
            setSelectedArea(code ? { dataset: config.dataset as "lgas" | "sa2", code } : null)
          }
        />
      )}
      {view.status === "error" && (
        <Alert status="danger">
          <Alert.Content>
            <Alert.Title>{dataset.label} did not load</Alert.Title>
            <Alert.Description>The data file could not be fetched.</Alert.Description>
          </Alert.Content>
          <Button size="sm" variant="ghost" onPress={view.retry}>
            Retry
          </Button>
        </Alert>
      )}
      {config.dataset === "zones" && view.status === "idle" && zoneIndex && !zoneYears.length && (
        <Typography type="body-sm" color="muted">
          No zone files have been built. Run the data fetch to add them.
        </Typography>
      )}
      <div className="flex items-center justify-end gap-1">
        <Button size="sm" variant="ghost" onPress={() => duplicate(config.id)}>
          <Copy size={14} /> Duplicate
        </Button>
        <Button size="sm" variant="danger-soft" onPress={() => remove(config.id)}>
          <Trash2 size={14} /> Remove
        </Button>
      </div>
    </div>
  );
}
