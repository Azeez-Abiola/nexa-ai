import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@/lib/utils";

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const;

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & ({ color?: string; theme?: never } | { color?: never; theme: Record<keyof typeof THEMES, string> });
};

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }

  return context;
}

const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    config: ChartConfig;
    children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
  }
>(({ id, className, children, config, ...props }, ref) => {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        ref={ref}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
});
ChartContainer.displayName = "Chart";

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(([_, config]) => config.theme || config.color);

  if (!colorConfig.length) {
    return null;
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(
            ([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => {
    const color = itemConfig.theme?.[theme as keyof typeof itemConfig.theme] || itemConfig.color;
    return color ? `  --color-${key}: ${color};` : null;
  })
  .join("\n")}
}
`,
          )
          .join("\n"),
      }}
    />
  );
};

const ChartTooltip = RechartsPrimitive.Tooltip;

const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
    React.ComponentProps<"div"> & {
      hideLabel?: boolean;
      hideIndicator?: boolean;
      indicator?: "line" | "dot" | "dashed";
      nameKey?: string;
      labelKey?: string;
    }
>(({ active, payload, label, hideLabel = false, hideIndicator = false, indicator = "dot", nameKey, labelKey }, ref) => {
  const { config } = useChart();

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload || payload.length === 0) {
      return null;
    }

    const item = payload[0];
    const key = `${labelKey || item.dataKey || item.name || "value"}`;
    const itemConfig = config[key as keyof typeof config];

    const value =
      !labelKey && typeof label === "string"
        ? label
        : itemConfig?.label || key;

    return value;
  }, [config, hideLabel, label, labelKey, payload]);

  if (!active || !payload || payload.length === 0) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={cn(
        "pointer-events-none absolute left-[clamp(var(--x),0px,var(--content-width))] top-[clamp(var(--y),0px,var(--content-height))] z-50 flex flex-col rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-sm shadow-xl",
      )}
    >
      {!hideLabel ? (
        <span className="text-muted-foreground text-xs">{tooltipLabel}</span>
      ) : null}
      <div className="flex flex-col gap-1.5">
        {payload.map((item, index) => {
          const key = `${nameKey || item.dataKey || item.name || "value"}`;
          const itemConfig = config[key as keyof typeof config];
          const indicatorColor =
            item.payload.fill || item.color;

          return (
            <div
              key={`${item.dataKey}-${index}`}
              className="flex w-full flex-shrink-0 flex-wrap items-center gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5"
            >
              {hideIndicator !== true ? (
                <div
                  className="shrink-0 rounded-[2px]"
                  style={{
                    backgroundColor: indicatorColor,
                  }}
                  {...(indicator === "dashed" && {
                    borderWidth: "2px",
                    backgroundColor: "transparent",
                    borderColor: indicatorColor,
                  })}
                />
              ) : null}
              <span className="flex text-xs text-muted-foreground">
                {itemConfig?.label || key}
                <span className="ml-auto pl-4 font-bold text-foreground">
                  {item.value}
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
ChartTooltipContent.displayName = "ChartTooltipContent";

export { ChartContainer, ChartStyle, ChartTooltip, ChartTooltipContent, useChart };
