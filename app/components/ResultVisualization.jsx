'use client';

import React from 'react';

const CHART_COLORS = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
];

function toNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function formatValue(value) {
    if (value == null) {
        return 'N/A';
    }

    const numeric = toNumber(value);
    if (numeric == null) {
        return String(value);
    }

    return new Intl.NumberFormat(undefined, {
        maximumFractionDigits: Math.abs(numeric) >= 100 ? 1 : 2,
    }).format(numeric);
}

function getRowLabelKey(row, excludeKeys = []) {
    return Object.keys(row).find((key) => !excludeKeys.includes(key)) || Object.keys(row)[0];
}

function normalizeBars(rows, labelKey, valueKey, secondaryKey = null) {
    return rows
        .map((row) => ({
            label: String(row[labelKey] ?? ''),
            value: toNumber(row[valueKey]),
            secondary: secondaryKey ? row[secondaryKey] : null,
        }))
        .filter((row) => row.label && row.value != null);
}

function buildVisualizationModel({ execution, data, request }) {
    if (!execution || !data || (!Array.isArray(data.rows) && !Array.isArray(data?.points))) {
        return null;
    }

    if (execution.type === 'analysis') {
        if (execution.analysis === 'trend' && Array.isArray(data.rows) && data.rows.length > 1) {
            return {
                kind: 'line',
                title: 'Trend',
                xLabel: request?.group_by || getRowLabelKey(data.rows[0], [request?.column]),
                yLabel: request?.column || Object.keys(data.rows[0])[1],
                points: normalizeBars(
                    data.rows,
                    request?.group_by || getRowLabelKey(data.rows[0], [request?.column]),
                    request?.column || Object.keys(data.rows[0])[1]
                ),
            };
        }

        if (
            (execution.analysis === 'comparison' || execution.analysis === 'composition') &&
            Array.isArray(data.rows) &&
            data.rows.length > 0
        ) {
            const labelKey = request?.group_by || getRowLabelKey(data.rows[0], [request?.column, 'share_pct']);
            const valueKey = execution.analysis === 'composition' && 'share_pct' in data.rows[0]
                ? 'share_pct'
                : (request?.column || Object.keys(data.rows[0])[1]);

            return {
                kind: 'bars',
                title: execution.analysis === 'composition' ? 'Composition' : 'Comparison',
                metricLabel: valueKey,
                bars: normalizeBars(data.rows, labelKey, valueKey, valueKey === 'share_pct' ? request?.column : null),
            };
        }

        if (execution.analysis === 'distribution') {
            if (data.distribution_type === 'numeric' && Array.isArray(data.bins) && data.bins.length > 0) {
                return {
                    kind: 'histogram',
                    title: 'Distribution',
                    bins: data.bins
                        .map((bin) => ({
                            label: String(bin.label),
                            count: toNumber(bin.count),
                        }))
                        .filter((bin) => bin.count != null),
                    stats: data.rows?.[0] || null,
                };
            }

            if (Array.isArray(data.rows) && data.rows.length > 0) {
                const labelKey = request?.column || getRowLabelKey(data.rows[0], ['count']);
                return {
                    kind: 'bars',
                    title: 'Category Counts',
                    metricLabel: 'count',
                    bars: normalizeBars(data.rows, labelKey, 'count'),
                };
            }
        }

        if (execution.analysis === 'outlier') {
            if (Array.isArray(data.rows) && data.rows.length > 0) {
                const labelKey = request?.group_by || getRowLabelKey(data.rows[0], [request?.column, 'distance_from_median']);
                return {
                    kind: 'bars',
                    title: 'Outliers',
                    metricLabel: request?.column || 'value',
                    subtitle: data.bounds
                        ? `Bounds: ${formatValue(data.bounds.lower)} to ${formatValue(data.bounds.upper)}`
                        : null,
                    bars: normalizeBars(data.rows, labelKey, request?.column || Object.keys(data.rows[0])[0]),
                };
            }

            if (data.bounds) {
                return {
                    kind: 'stats',
                    title: 'Outlier Bounds',
                    stats: {
                        lower: data.bounds.lower,
                        upper: data.bounds.upper,
                    },
                };
            }
        }

        if (execution.analysis === 'correlation') {
            const summary = data.rows?.[0] || null;
            if (Array.isArray(data.points) && data.points.length > 1) {
                return {
                    kind: 'scatter',
                    title: 'Correlation',
                    xLabel: request?.column || 'x',
                    yLabel: request?.second_column || 'y',
                    meta: summary,
                    points: data.points
                        .map((point) => ({
                            x: toNumber(point.x),
                            y: toNumber(point.y),
                        }))
                        .filter((point) => point.x != null && point.y != null),
                };
            }

            if (summary) {
                return {
                    kind: 'stats',
                    title: 'Correlation Summary',
                    stats: summary,
                };
            }
        }
    }

    if (
        execution.type === 'query' &&
        Array.isArray(data.rows) &&
        data.rows.length > 0 &&
        Object.prototype.hasOwnProperty.call(data.rows[0], 'value')
    ) {
        const labelKey = getRowLabelKey(data.rows[0], ['value']);
        return {
            kind: 'bars',
            title: 'Query Result',
            metricLabel: 'value',
            bars: normalizeBars(data.rows, labelKey, 'value'),
        };
    }

    return null;
}

export function canVisualizeStructuredResult(payload) {
    return Boolean(buildVisualizationModel(payload));
}

export function stripVisualizationTableFromMessage(text) {
    if (!text) {
        return text;
    }

    const lines = text.split('\n');
    const output = [];
    let skippingTable = false;
    let skippedTable = false;

    for (let index = 0; index < lines.length; index += 1) {
        const currentLine = lines[index];
        const nextLine = lines[index + 1] || '';
        const isTableHeader = currentLine.trim().startsWith('|') && nextLine.trim().startsWith('|');

        if (!skippedTable && !skippingTable && isTableHeader) {
            skippingTable = true;
            skippedTable = true;
            continue;
        }

        if (skippingTable) {
            if (currentLine.trim().startsWith('|')) {
                continue;
            }

            if (currentLine.trim() === '') {
                continue;
            }

            skippingTable = false;
        }

        output.push(currentLine);
    }

    return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function Panel({ title, subtitle, children }) {
    return (
        <div className="mb-4 overflow-hidden rounded-2xl border border-border/80 bg-muted/20">
            <div className="border-b border-border/70 px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {title}
                </div>
                {subtitle && (
                    <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>
                )}
            </div>
            <div className="p-4">{children}</div>
        </div>
    );
}

function MetricGrid({ stats }) {
    return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(stats).map(([key, value]) => (
                <div key={key} className="rounded-xl border border-border/80 bg-card px-3 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {key.replace(/_/g, ' ')}
                    </div>
                    <div className="mt-1 text-lg font-semibold text-foreground">
                        {formatValue(value)}
                    </div>
                </div>
            ))}
        </div>
    );
}

function BarList({ bars, metricLabel }) {
    const maxValue = Math.max(...bars.map((bar) => bar.value), 1);

    return (
        <div className="space-y-3">
            {bars.slice(0, 10).map((bar, index) => (
                <div key={`${bar.label}-${index}`} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                        <div className="truncate font-medium text-foreground">{bar.label}</div>
                        <div className="shrink-0 text-muted-foreground">
                            {formatValue(bar.value)}
                            {metricLabel === 'share_pct' ? '%' : ''}
                        </div>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-border/70">
                        <div
                            className="h-full rounded-full transition-[width]"
                            style={{
                                width: `${Math.max((bar.value / maxValue) * 100, 4)}%`,
                                background: CHART_COLORS[index % CHART_COLORS.length],
                            }}
                        />
                    </div>
                    {bar.secondary != null && (
                        <div className="text-xs text-muted-foreground">
                            Raw value: {formatValue(bar.secondary)}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

function buildLinePath(points, width, height, padding) {
    const values = points.map((point) => point.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const xStep = points.length === 1 ? 0 : (width - padding * 2) / (points.length - 1);

    const coordinates = points.map((point, index) => {
        const x = padding + xStep * index;
        const yRange = maxValue - minValue || 1;
        const y = height - padding - ((point.value - minValue) / yRange) * (height - padding * 2);
        return { ...point, x, y };
    });

    const path = coordinates
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
        .join(' ');

    return { coordinates, path };
}

function LineChart({ points, xLabel, yLabel }) {
    const width = 560;
    const height = 220;
    const padding = 28;
    const { coordinates, path } = buildLinePath(points, width, height, padding);
    const labelStep = Math.max(Math.ceil(points.length / 4), 1);

    return (
        <div className="space-y-3">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible">
                <line
                    x1={padding}
                    y1={height - padding}
                    x2={width - padding}
                    y2={height - padding}
                    stroke="var(--border)"
                    strokeWidth="1"
                />
                <path
                    d={path}
                    fill="none"
                    stroke="var(--chart-4)"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                {coordinates.map((point, index) => (
                    <g key={`${point.label}-${index}`}>
                        <circle cx={point.x} cy={point.y} r="4" fill="var(--chart-2)" />
                        {index % labelStep === 0 || index === coordinates.length - 1 ? (
                            <text
                                x={point.x}
                                y={height - 8}
                                textAnchor="middle"
                                fontSize="11"
                                fill="var(--muted-foreground)"
                            >
                                {point.label}
                            </text>
                        ) : null}
                    </g>
                ))}
            </svg>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{xLabel}</span>
                <span>{yLabel}</span>
            </div>
        </div>
    );
}

function ScatterPlot({ points, xLabel, yLabel, meta }) {
    const width = 560;
    const height = 240;
    const padding = 30;
    const xValues = points.map((point) => point.x);
    const yValues = points.map((point) => point.y);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);

    const normalizedPoints = points.map((point) => ({
        ...point,
        xPos: padding + ((point.x - minX) / (maxX - minX || 1)) * (width - padding * 2),
        yPos: height - padding - ((point.y - minY) / (maxY - minY || 1)) * (height - padding * 2),
    }));

    return (
        <div className="space-y-3">
            {meta && (
                <MetricGrid
                    stats={{
                        correlation: meta.correlation,
                        strength: meta.strength,
                        direction: meta.direction,
                        sample_size: meta.sample_size,
                    }}
                />
            )}
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full overflow-visible">
                <rect
                    x={padding}
                    y={padding}
                    width={width - padding * 2}
                    height={height - padding * 2}
                    fill="transparent"
                    stroke="var(--border)"
                    strokeWidth="1"
                    rx="12"
                />
                {normalizedPoints.map((point, index) => (
                    <circle
                        key={`${point.x}-${point.y}-${index}`}
                        cx={point.xPos}
                        cy={point.yPos}
                        r="4"
                        fill={CHART_COLORS[index % CHART_COLORS.length]}
                        opacity="0.8"
                    />
                ))}
            </svg>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{xLabel}</span>
                <span>{yLabel}</span>
            </div>
        </div>
    );
}

function Histogram({ bins, stats }) {
    const maxValue = Math.max(...bins.map((bin) => bin.count), 1);

    return (
        <div className="space-y-4">
            {stats && <MetricGrid stats={stats} />}
            <div className="flex items-end gap-2 overflow-x-auto pb-1">
                {bins.map((bin, index) => (
                    <div key={`${bin.label}-${index}`} className="min-w-14 flex-1">
                        <div className="flex h-40 items-end rounded-xl border border-border/70 bg-card px-2 pb-2">
                            <div
                                className="w-full rounded-md"
                                style={{
                                    height: `${Math.max((bin.count / maxValue) * 100, 6)}%`,
                                    background: CHART_COLORS[index % CHART_COLORS.length],
                                }}
                            />
                        </div>
                        <div className="mt-2 text-center text-[11px] text-muted-foreground">
                            {bin.count}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function ResultVisualization({ execution, data, request }) {
    const model = buildVisualizationModel({ execution, data, request });

    if (!model) {
        return null;
    }

    if (model.kind === 'line') {
        return (
            <Panel title={model.title}>
                <LineChart points={model.points} xLabel={model.xLabel} yLabel={model.yLabel} />
            </Panel>
        );
    }

    if (model.kind === 'bars') {
        return (
            <Panel title={model.title} subtitle={model.subtitle}>
                <BarList bars={model.bars} metricLabel={model.metricLabel} />
            </Panel>
        );
    }

    if (model.kind === 'histogram') {
        return (
            <Panel title={model.title}>
                <Histogram bins={model.bins} stats={model.stats} />
            </Panel>
        );
    }

    if (model.kind === 'scatter') {
        return (
            <Panel title={model.title}>
                <ScatterPlot
                    points={model.points}
                    xLabel={model.xLabel}
                    yLabel={model.yLabel}
                    meta={model.meta}
                />
            </Panel>
        );
    }

    if (model.kind === 'stats') {
        return (
            <Panel title={model.title}>
                <MetricGrid stats={model.stats} />
            </Panel>
        );
    }

    return null;
}
