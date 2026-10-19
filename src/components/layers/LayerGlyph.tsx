import { Spinner } from "@heroui/react";
import { CircleAlert } from "lucide-react";
import { cssColor } from "../../layers/palettes";
import type { LayerView } from "../../layers/useLayerViews";
import type { Rgb } from "../../state/palette";

const gradient = (colors: Rgb[], angle = 90) =>
  `linear-gradient(${angle}deg, ${colors.map((c) => cssColor(c)).join(", ")})`;
const Dot = ({
  color,
  size = 8,
  className = "",
}: {
  color: Rgb;
  size?: number;
  className?: string;
}) => (
  <i
    className={`block shrink-0 rounded-full ring-1 ring-surface ${className}`}
    style={{ width: size, height: size, background: cssColor(color) }}
  />
);

/**
 * A thumbnail of how a layer draws, so the list can be read like a legend: a few category dots,
 * a strip of the ramp, nested circles, a hexagon or an outlined area.
 */
export default function LayerGlyph({ view }: { view: LayerView }) {
  const { encoding, status, config } = view;
  let body;
  if (status === "loading") body = <Spinner size="sm" />;
  else if (status === "error") body = <CircleAlert size={16} className="text-danger" />;
  else if (!encoding)
    body = <i className="block size-3 rounded-full border border-dashed border-muted" />;
  else
    switch (encoding.kind) {
      case "single":
        body = <Dot color={encoding.color} size={10} />;
        break;
      case "categories":
        body = (
          <span className="flex -space-x-1">
            {encoding.entries.slice(0, 3).map((entry) => (
              <Dot key={entry.label} color={entry.color} size={9} />
            ))}
          </span>
        );
        break;
      case "scale":
        body =
          config.display === "graduated" ? (
            <span className="flex -space-x-1">
              {[0, 2, 4].map((i) => (
                <Dot key={i} color={encoding.scale.stops[i]} size={9} />
              ))}
            </span>
          ) : (
            <i
              className="block h-3.5 w-5 rounded-[3px]"
              style={{ background: gradient(encoding.scale.stops, 135) }}
            />
          );
        break;
      case "bubbles": {
        const color =
          encoding.color.kind === "single" ? encoding.color.color : encoding.color.entries[0].color;
        body = (
          <span className="relative block size-5">
            {[20, 13, 7].map((size) => (
              <i
                key={size}
                className="absolute bottom-0 left-1/2 block -translate-x-1/2 rounded-full border"
                style={{
                  width: size,
                  height: size,
                  borderColor: cssColor(color),
                  background: cssColor(color, 0.18),
                }}
              />
            ))}
          </span>
        );
        break;
      }
      case "density":
        body =
          config.display === "hexbins" ? (
            <svg viewBox="0 0 20 20" className="size-5" aria-hidden="true">
              <defs>
                <linearGradient id={`hex-${config.id}`} x1="0" y1="1" x2="1" y2="0">
                  {encoding.colors.map((c, i) => (
                    <stop
                      key={i}
                      offset={i / (encoding.colors.length - 1)}
                      stopColor={cssColor(c)}
                    />
                  ))}
                </linearGradient>
              </defs>
              <path
                d="M10 1.5 17.4 5.75v8.5L10 18.5 2.6 14.25v-8.5Z"
                fill={`url(#hex-${config.id})`}
              />
            </svg>
          ) : (
            <i
              className="block size-5 rounded-full blur-[2px]"
              style={{
                background: `radial-gradient(circle, ${[...encoding.colors]
                  .reverse()
                  .map((c) => cssColor(c))
                  .join(", ")}, transparent 75%)`,
              }}
            />
          );
        break;
      case "outline":
        body = (
          <i
            className="block h-3.5 w-5 rounded-[3px] border-[1.5px]"
            style={{
              borderColor: cssColor([encoding.line[0], encoding.line[1], encoding.line[2]]),
              background: cssColor([encoding.line[0], encoding.line[1], encoding.line[2]], 0.12),
            }}
          />
        );
        break;
    }
  return (
    <span
      aria-hidden="true"
      className="flex size-7 shrink-0 items-center justify-center transition-opacity duration-200"
      style={{ opacity: config.visible ? 1 : 0.4 }}
    >
      {body}
    </span>
  );
}
