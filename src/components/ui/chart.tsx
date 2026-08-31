"use client"

import type {
  Formatter as RechartsTooltipFormatter,
  NameType as RechartsTooltipName,
  Payload as RechartsTooltipPayloadItem,
  ValueType as RechartsTooltipValue,
} from "recharts/types/component/DefaultTooltipContent"
import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode
    icon?: React.ComponentType
  } & (
    | { color?: string; theme?: never }
    | { color?: never; theme: Record<keyof typeof THEMES, string> }
  )
}

type ChartConfigItem = ChartConfig[string]
type ChartThemeName = keyof typeof THEMES
type ChartStyleColorConfigItem = {
  key: string
  config: ChartConfigItem
}
type ChartStyleColorConfigItemList = ChartStyleColorConfigItem[]

type ChartContextProps = {
  config: ChartConfig
}

export type ChartContainerChildren = React.ReactElement

export type ChartLegendPayloadItemPayload = {
  [fieldName: string]: unknown
}

export type ChartLegendPayloadItem = {
  [fieldName: string]: unknown
  value: React.Key
  type?: string
  color?: string
  dataKey?: React.Key
  payload?: ChartLegendPayloadItemPayload
}

export type ChartLegendPayload = ChartLegendPayloadItem[]

export type ChartLegendVerticalAlign = "top" | "bottom" | "middle"

export type ChartLegendContentProps = React.ComponentProps<"div"> & {
  hideIcon?: boolean
  nameKey?: string
  payload?: ChartLegendPayload
  verticalAlign?: ChartLegendVerticalAlign
}

export type ChartTooltipPayloadItemPayload = {
  [fieldName: string]: unknown
  fill?: string
}

export type ChartTooltipPayloadItem = RechartsTooltipPayloadItem<
  RechartsTooltipValue,
  RechartsTooltipName
>
export type ChartTooltipPayload = ChartTooltipPayloadItem[]
type ChartTooltipFormatter = RechartsTooltipFormatter<
  RechartsTooltipValue,
  RechartsTooltipName
>
type ChartTooltipIndicator = "line" | "dot" | "dashed"

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />")
  }

  return context
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig
  children: ChartContainerChildren
}) {
  const uniqueId = React.useId()
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border flex aspect-video justify-center text-xs [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-surface]:outline-hidden",
          className
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

function hasChartStyleColorConfigItem(config: ChartConfigItem) {
  if (config.theme !== undefined) {
    return true
  }

  if (config.color !== undefined) {
    return true
  }

  return false
}

function getChartStyleColorConfigItems(
  config: ChartConfig
): ChartStyleColorConfigItemList {
  const colorConfigItems: ChartStyleColorConfigItemList = []

  for (const key in config) {
    const itemConfig = config[key]
    const hasColorConfig = hasChartStyleColorConfigItem(itemConfig)
    if (hasColorConfig === false) {
      continue
    }

    colorConfigItems.push({
      key,
      config: itemConfig,
    })
  }

  return colorConfigItems
}

function getChartStyleThemeColor(
  itemConfig: ChartConfigItem,
  theme: ChartThemeName
): string | undefined {
  const themeConfig = itemConfig.theme
  if (themeConfig !== undefined) {
    return themeConfig[theme]
  }

  const color = itemConfig.color
  if (color !== undefined) {
    return color
  }

  return undefined
}

function materializeChartStyleThemeCssVariables(
  colorConfigItems: ChartStyleColorConfigItemList,
  theme: ChartThemeName
) {
  const cssVariables: string[] = []

  for (const item of colorConfigItems) {
    const color = getChartStyleThemeColor(item.config, theme)
    if (color === undefined) {
      continue
    }

    cssVariables.push(`  --color-${item.key}: ${color};`)
  }

  return cssVariables.join("\n")
}

function materializeChartStyleCss(
  id: string,
  colorConfigItems: ChartStyleColorConfigItemList
) {
  const cssBlocks: string[] = []

  for (const themeName in THEMES) {
    const theme = themeName as ChartThemeName
    const prefix = THEMES[theme]
    const cssVariables = materializeChartStyleThemeCssVariables(
      colorConfigItems,
      theme
    )

    cssBlocks.push(`
${prefix} [data-chart=${id}] {
${cssVariables}
}
`)
  }

  return cssBlocks.join("\n")
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfigItems = getChartStyleColorConfigItems(config)

  if (colorConfigItems.length === 0) {
    return null
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: materializeChartStyleCss(id, colorConfigItems),
      }}
    />
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  labelClassName,
  formatter,
  color,
  nameKey,
  labelKey,
}: React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
  React.ComponentProps<"div"> & {
    hideLabel?: boolean
    hideIndicator?: boolean
    indicator?: "line" | "dot" | "dashed"
    nameKey?: string
    labelKey?: string
  }) {
  const { config } = useChart()

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload?.length) {
      return null
    }

    const [item] = payload
    const key = `${labelKey || item?.dataKey || item?.name || "value"}`
    const itemConfig = getPayloadConfigFromPayload(config, item, key)
    const value =
      !labelKey && typeof label === "string"
        ? config[label as keyof typeof config]?.label || label
        : itemConfig?.label

    if (labelFormatter) {
      return (
        <div className={cn("font-medium", labelClassName)}>
          {labelFormatter(value, payload)}
        </div>
      )
    }

    if (!value) {
      return null
    }

    return <div className={cn("font-medium", labelClassName)}>{value}</div>
  }, [
    label,
    labelFormatter,
    payload,
    hideLabel,
    labelClassName,
    config,
    labelKey,
  ])

  if (!active || !payload?.length) {
    return null
  }

  const nestLabel = payload.length === 1 && indicator !== "dot"
  const tooltipItemNodes = materializeChartTooltipItemNodes({
    color,
    config,
    formatter,
    hideIndicator,
    indicator,
    nameKey,
    nestLabel,
    payload,
    tooltipLabel,
  })

  return (
    <div
      className={cn(
        "border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl",
        className
      )}
    >
      {!nestLabel ? tooltipLabel : null}
      <div className="grid gap-1.5">
        {tooltipItemNodes}
      </div>
    </div>
  )
}

function getChartTooltipItemKey(
  nameKey: string | undefined,
  item: ChartTooltipPayloadItem
) {
  return `${nameKey || item.name || item.dataKey || "value"}`
}

function getChartTooltipIndicatorColor(
  color: string | undefined,
  item: ChartTooltipPayloadItem
) {
  if (color !== undefined) {
    return color
  }

  const payloadFill = readChartTooltipPayloadFill(item.payload)
  if (payloadFill !== undefined) {
    return payloadFill
  }

  return item.color
}

function readChartTooltipPayloadFill(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null) {
    return undefined
  }

  if ("fill" in payload && typeof payload.fill === "string") {
    return payload.fill
  }

  return undefined
}

function shouldRenderChartTooltipItem(item: ChartTooltipPayloadItem) {
  if (item.type === "none") {
    return false
  }

  return true
}

function canRenderChartTooltipFormattedValue(
  formatter: ChartTooltipFormatter | undefined,
  item: ChartTooltipPayloadItem
) {
  if (formatter === undefined) {
    return false
  }

  if (item.value === undefined) {
    return false
  }

  if (item.name === undefined) {
    return false
  }

  return true
}

function materializeChartTooltipItemNodes({
  color,
  config,
  formatter,
  hideIndicator,
  indicator,
  nameKey,
  nestLabel,
  payload,
  tooltipLabel,
}: {
  color: string | undefined
  config: ChartConfig
  formatter: ChartTooltipFormatter | undefined
  hideIndicator: boolean
  indicator: ChartTooltipIndicator
  nameKey: string | undefined
  nestLabel: boolean
  payload: ChartTooltipPayload
  tooltipLabel: React.ReactNode
}) {
  const nodes: React.ReactNode[] = []

  for (let index = 0; index < payload.length; index += 1) {
    const item = payload[index]
    const shouldRenderItem = shouldRenderChartTooltipItem(item)
    if (shouldRenderItem === false) {
      continue
    }

    const key = getChartTooltipItemKey(nameKey, item)
    const itemConfig = getPayloadConfigFromPayload(config, item, key)
    const indicatorColor = getChartTooltipIndicatorColor(color, item)
    const canRenderFormattedValue = canRenderChartTooltipFormattedValue(
      formatter,
      item
    )

    nodes.push(
      <div
        key={item.dataKey}
        className={cn(
          "[&>svg]:text-muted-foreground flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5",
          indicator === "dot" && "items-center"
        )}
      >
        {canRenderFormattedValue === true &&
        formatter !== undefined &&
        item.value !== undefined &&
        item.name !== undefined ? (
          formatter(item.value, item.name, item, index, item.payload)
        ) : (
          <>
            {itemConfig?.icon ? (
              <itemConfig.icon />
            ) : (
              !hideIndicator && (
                <div
                  className={cn(
                    "shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)",
                    {
                      "h-2.5 w-2.5": indicator === "dot",
                      "w-1": indicator === "line",
                      "w-0 border-[1.5px] border-dashed bg-transparent":
                        indicator === "dashed",
                      "my-0.5": nestLabel && indicator === "dashed",
                    }
                  )}
                  style={
                    {
                      "--color-bg": indicatorColor,
                      "--color-border": indicatorColor,
                    } as React.CSSProperties
                  }
                />
              )
            )}
            <div
              className={cn(
                "flex flex-1 justify-between leading-none",
                nestLabel ? "items-end" : "items-center"
              )}
            >
              <div className="grid gap-1.5">
                {nestLabel ? tooltipLabel : null}
                <span className="text-muted-foreground">
                  {itemConfig?.label || item.name}
                </span>
              </div>
              {item.value && (
                <span className="text-foreground font-mono font-medium tabular-nums">
                  {item.value.toLocaleString()}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  return nodes
}

const ChartLegend = RechartsPrimitive.Legend

function ChartLegendContent({
  className,
  hideIcon = false,
  payload,
  verticalAlign = "bottom",
  nameKey,
}: ChartLegendContentProps) {
  const { config } = useChart()

  if (!payload?.length) {
    return null
  }

  const legendItemNodes = materializeChartLegendItemNodes({
    config,
    hideIcon,
    nameKey,
    payload,
  })

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-4",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className
      )}
    >
      {legendItemNodes}
    </div>
  )
}

function getChartLegendItemKey(
  nameKey: string | undefined,
  item: ChartLegendPayloadItem
) {
  return `${nameKey || item.dataKey || "value"}`
}

function shouldRenderChartLegendItem(item: ChartLegendPayloadItem) {
  if (item.type === "none") {
    return false
  }

  return true
}

function materializeChartLegendItemNodes({
  config,
  hideIcon,
  nameKey,
  payload,
}: {
  config: ChartConfig
  hideIcon: boolean
  nameKey: string | undefined
  payload: ChartLegendPayload
}) {
  const nodes: React.ReactNode[] = []

  for (const item of payload) {
    const shouldRenderItem = shouldRenderChartLegendItem(item)
    if (shouldRenderItem === false) {
      continue
    }

    const key = getChartLegendItemKey(nameKey, item)
    const itemConfig = getPayloadConfigFromPayload(config, item, key)

    nodes.push(
      <div
        key={item.value}
        className={cn(
          "[&>svg]:text-muted-foreground flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3"
        )}
      >
        {itemConfig?.icon && !hideIcon ? (
          <itemConfig.icon />
        ) : (
          <div
            className="h-2 w-2 shrink-0 rounded-[2px]"
            style={{
              backgroundColor: item.color,
            }}
          />
        )}
        {itemConfig?.label}
      </div>
    )
  }

  return nodes
}

// Helper to extract item config from a payload.
function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: unknown,
  key: string
) {
  if (typeof payload !== "object" || payload === null) {
    return undefined
  }

  const payloadPayload =
    "payload" in payload &&
    typeof payload.payload === "object" &&
    payload.payload !== null
      ? payload.payload
      : undefined

  let configLabelKey: string = key

  if (
    key in payload &&
    typeof payload[key as keyof typeof payload] === "string"
  ) {
    configLabelKey = payload[key as keyof typeof payload] as string
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key as keyof typeof payloadPayload] === "string"
  ) {
    configLabelKey = payloadPayload[
      key as keyof typeof payloadPayload
    ] as string
  }

  return configLabelKey in config
    ? config[configLabelKey]
    : config[key as keyof typeof config]
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
}
