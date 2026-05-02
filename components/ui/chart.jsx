'use client';

import * as React from 'react';
import { Tooltip as RechartsTooltip } from 'recharts';

import { cn } from '@/lib/utils';

const ChartContext = React.createContext({ config: {} });

function getPayloadConfig(config, item, key) {
    if (!item || typeof item !== 'object') {
        return undefined;
    }

    const itemKey =
        key ||
        item.dataKey ||
        item.name ||
        (typeof item.payload === 'object' && item.payload !== null
            ? item.payload.fillKey
            : undefined);

    return itemKey ? config?.[itemKey] : undefined;
}

export function useChart() {
    return React.useContext(ChartContext);
}

export function ChartContainer({ id, className, children, config = {}, ...props }) {
    const generatedId = React.useId().replace(/:/g, '');
    const chartId = `chart-${id || generatedId}`;
    const style = Object.entries(config).reduce((accumulator, [key, value]) => {
        if (value?.color) {
            accumulator[`--color-${key}`] = value.color;
        }

        return accumulator;
    }, {});

    return (
        <ChartContext.Provider value={{ config }}>
            <div
                data-chart={chartId}
                className={cn(
                    'flex aspect-video min-h-[220px] w-full items-center justify-center text-xs',
                    '[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground',
                    '[&_.recharts-cartesian-grid_line[stroke="#ccc"]]:stroke-border/60',
                    '[&_.recharts-reference-line_[stroke="#ccc"]]:stroke-border',
                    '[&_.recharts-tooltip-cursor]:stroke-border',
                    '[&_.recharts-layer:focus]:outline-none',
                    className
                )}
                style={style}
                {...props}
            >
                {children}
            </div>
        </ChartContext.Provider>
    );
}

export const ChartTooltip = RechartsTooltip;

export function ChartLegend({ className, children, ...props }) {
    return (
        <div
            className={cn(
                'flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground',
                className
            )}
            {...props}
        >
            {children}
        </div>
    );
}

export function ChartLegendContent({ items = [], className }) {
    if (!items.length) {
        return null;
    }

    return (
        <ChartLegend className={className}>
            {items.map((item) => (
                <div key={item.key || item.label} className="flex items-center gap-2">
                    <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: item.color || 'var(--chart-1)' }}
                    />
                    <span className="font-medium text-foreground">{item.label}</span>
                    {item.meta ? <span className="text-muted-foreground">{item.meta}</span> : null}
                </div>
            ))}
        </ChartLegend>
    );
}

export function ChartTooltipContent({
    active,
    payload,
    label,
    className,
    hideLabel = false,
    valueFormatter,
    labelFormatter,
    footer,
}) {
    const { config } = useChart();

    if (!active || !payload?.length) {
        return null;
    }

    const displayLabel = labelFormatter ? labelFormatter(label, payload) : label;
    const footerContent = footer ? footer(payload[0]) : null;

    return (
        <div
            className={cn(
                'min-w-40 rounded-xl border border-border/80 bg-background/95 px-3 py-2 shadow-lg backdrop-blur',
                className
            )}
        >
            {!hideLabel && displayLabel != null ? (
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    {String(displayLabel)}
                </div>
            ) : null}
            <div className="space-y-1.5">
                {payload.map((item, index) => {
                    const payloadConfig = getPayloadConfig(config, item);
                    const tone =
                        item.color ||
                        item.payload?.fill ||
                        payloadConfig?.color ||
                        'var(--chart-1)';
                    const itemLabel =
                        payloadConfig?.label ||
                        item.name ||
                        item.dataKey ||
                        `Series ${index + 1}`;

                    return (
                        <div key={`${itemLabel}-${index}`} className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                                <span
                                    className="size-2.5 rounded-full"
                                    style={{ backgroundColor: tone }}
                                />
                                <span className="text-sm text-foreground">{itemLabel}</span>
                            </div>
                            <span className="text-sm font-medium text-foreground">
                                {valueFormatter
                                    ? valueFormatter(item.value, item.name, item)
                                    : String(item.value ?? '')}
                            </span>
                        </div>
                    );
                })}
            </div>
            {footerContent ? (
                <div className="mt-2 border-t border-border/70 pt-2 text-xs text-muted-foreground">
                    {footerContent}
                </div>
            ) : null}
        </div>
    );
}
