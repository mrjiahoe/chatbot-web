'use client';

import React from 'react';
import {
    Bar,
    BarChart as RechartsBarChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart as RechartsLineChart,
    ResponsiveContainer,
    Scatter,
    ScatterChart as RechartsScatterChart,
    XAxis,
    YAxis,
} from 'recharts';

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    ChartContainer,
    ChartLegendContent,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

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

function formatChartMetric(value, metricLabel = null) {
    const formatted = formatValue(value);
    return metricLabel === 'share_pct' ? `${formatted}%` : formatted;
}

function titleCase(value) {
    return String(value ?? '')
        .split(' ')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function formatColumnHeading(key) {
    const normalized = String(key ?? '')
        .split('.')
        .pop()
        ?.replace(/_/g, ' ')
        .trim();

    if (!normalized) {
        return 'Value';
    }

    if (normalized.toLowerCase() === 'name') {
        return 'Name';
    }

    if (normalized.toLowerCase().includes('school')) {
        return 'School Name';
    }

    return titleCase(normalized);
}

function getColumnRefLabel(column) {
    if (!column) {
        return null;
    }

    if (typeof column === 'string') {
        return column;
    }

    return column.outputLabel || column.column || column.sourceColumn || null;
}

function getGroupByLabels(request) {
    if (!request?.group_by) {
        return [];
    }

    const groupByValues = Array.isArray(request.group_by)
        ? request.group_by
        : [request.group_by];

    return groupByValues
        .map((column) => getColumnRefLabel(column))
        .filter(Boolean);
}

function isGenderLikeCategory(value) {
    const normalized = String(value ?? '').trim().toLowerCase();
    return ['male', 'female', 'other', 'unknown', 'unspecified'].includes(normalized);
}

function isGenderLikeKey(key, categories = []) {
    const normalizedKey = String(key ?? '').trim().toLowerCase();

    return normalizedKey.endsWith('gender')
        || normalizedKey.endsWith('sex')
        || categories.every((category) => isGenderLikeCategory(category));
}

function normalizeCategoryLabel(value) {
    if (value == null || value === '') {
        return 'Unspecified';
    }

    return String(value);
}

function orderPivotCategories(categories, categoryKey) {
    if (!isGenderLikeKey(categoryKey, categories)) {
        return categories;
    }

    const ranking = new Map([
        ['male', 0],
        ['female', 1],
        ['other', 2],
        ['unknown', 3],
        ['unspecified', 4],
    ]);

    return [...categories].sort((left, right) => {
        const leftRank = ranking.get(String(left).toLowerCase()) ?? 99;
        const rightRank = ranking.get(String(right).toLowerCase()) ?? 99;

        if (leftRank !== rightRank) {
            return leftRank - rightRank;
        }

        return String(left).localeCompare(String(right));
    });
}

function formatPivotCategoryHeading(category, categoryKey) {
    const label = titleCase(String(category ?? '').replace(/_/g, ' '));

    return isGenderLikeKey(categoryKey, [category])
        ? `${label} Teachers`
        : label;
}

function buildTableSummary(headers, rows) {
    if (!headers?.length || !rows?.length) {
        return [];
    }

    const numericHeaders = headers.filter((header) => header.numeric);
    if (!numericHeaders.length) {
        return [{ label: 'Rows', value: formatValue(rows.length) }];
    }

    return [
        { label: 'Rows', value: formatValue(rows.length) },
        ...numericHeaders.slice(0, 3).map((header) => ({
            label: header.label,
            value: formatValue(
                rows.reduce((sum, row) => sum + (toNumber(row[header.key]) || 0), 0)
            ),
        })),
    ];
}

function buildPivotTableModel(rows, dimensionKeys, valueKey) {
    if (dimensionKeys.length !== 2) {
        return null;
    }

    const categories = Array.from(
        new Set(rows.map((row) => normalizeCategoryLabel(row[dimensionKeys[1]])))
    );

    if (categories.length === 0 || categories.length > 6) {
        return null;
    }

    const rowKey = dimensionKeys[0];
    const categoryKey = dimensionKeys[1];
    const orderedCategories = orderPivotCategories(categories, categoryKey);
    const pivotRows = [];
    const pivotMap = new Map();

    rows.forEach((row) => {
        const rowLabel = String(row[rowKey] ?? 'N/A');
        const categoryLabel = normalizeCategoryLabel(row[categoryKey]);
        const numericValue = toNumber(row[valueKey]) || 0;

        if (!pivotMap.has(rowLabel)) {
            const nextRow = { [rowKey]: rowLabel, total: 0 };
            orderedCategories.forEach((category) => {
                nextRow[category] = 0;
            });
            pivotMap.set(rowLabel, nextRow);
            pivotRows.push(nextRow);
        }

        const targetRow = pivotMap.get(rowLabel);
        targetRow[categoryLabel] = (toNumber(targetRow[categoryLabel]) || 0) + numericValue;
        targetRow.total += numericValue;
    });

    const headers = [
        { key: rowKey, label: formatColumnHeading(rowKey), numeric: false },
        ...orderedCategories.map((category) => ({
            key: category,
            label: formatPivotCategoryHeading(category, categoryKey),
            numeric: true,
        })),
        {
            key: 'total',
            label: isGenderLikeKey(categoryKey, orderedCategories) ? 'Total Teachers' : 'Total',
            numeric: true,
        },
    ];

    return {
        kind: 'table',
        title: 'Query Result',
        headers,
        rows: pivotRows,
        summaryItems: buildTableSummary(headers, pivotRows),
    };
}

function buildGenericTableModel(rows, title = 'Query Result') {
    const headers = Object.keys(rows[0] || {}).map((key) => ({
        key,
        label: formatColumnHeading(key),
        numeric: rows.every((row) => toNumber(row[key]) != null),
    }));

    return {
        kind: 'table',
        title,
        headers,
        rows,
        summaryItems: buildTableSummary(headers, rows),
    };
}

function getQueryMetricLabel(request) {
    if (request?.operation === 'count') {
        return 'count';
    }

    const metricColumn = Array.isArray(request?.columns)
        ? request.columns[0]
        : request?.columns;

    return getColumnRefLabel(metricColumn) || 'value';
}

function buildQueryVisualizationModel({ data, request }) {
    if (!Array.isArray(data.rows) || data.rows.length === 0) {
        return null;
    }

    const firstRow = data.rows[0];
    const rowKeys = Object.keys(firstRow);
    const groupByLabels = getGroupByLabels(request);
    const hasValueMetric = Object.prototype.hasOwnProperty.call(firstRow, 'value');

    if (hasValueMetric && groupByLabels.length > 1) {
        const pivotModel = buildPivotTableModel(data.rows, groupByLabels, 'value');

        if (pivotModel) {
            return pivotModel;
        }

        return buildGenericTableModel(data.rows);
    }

    if (hasValueMetric && rowKeys.length === 2) {
        const labelKey = getRowLabelKey(firstRow, ['value']);
        return {
            kind: 'bars',
            title: 'Query Result',
            metricLabel: getQueryMetricLabel(request),
            bars: normalizeBars(data.rows, labelKey, 'value'),
        };
    }

    return buildGenericTableModel(data.rows);
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

        if (execution.analysis === 'period_change' && Array.isArray(data.rows) && data.rows.length > 0) {
            const labelKey = request?.group_by || getRowLabelKey(data.rows[0], [request?.column, 'previous_value', 'absolute_change', 'pct_change']);
            const points = normalizeBars(
                data.rows,
                labelKey,
                request?.column || Object.keys(data.rows[0])[1]
            );

            return {
                kind: points.length > 1 ? 'line' : 'stats',
                title: 'Period Change',
                xLabel: labelKey,
                yLabel: request?.column || 'value',
                points,
                stats: {
                    latest_pct_change: data.latest_pct_change,
                },
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

        if (execution.analysis === 'data_quality') {
            if (data.scope === 'table' && Array.isArray(data.rows) && data.rows.length > 0) {
                return {
                    kind: 'bars',
                    title: 'Missing Data By Column',
                    subtitle: data.overview
                        ? `${formatValue(data.overview.total_missing_cells)} missing cells across ${formatValue(data.overview.column_count)} columns`
                        : null,
                    metricLabel: 'missing_pct',
                    stats: data.overview,
                    bars: normalizeBars(data.rows, 'column', 'missing_pct'),
                };
            }

            if (data.scope === 'column') {
                return {
                    kind: 'stats',
                    title: 'Column Quality',
                    stats: data.overview || data.rows?.[0] || null,
                };
            }
        }
    }

    if (execution.type === 'query') {
        return buildQueryVisualizationModel({ data, request });
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
        <Card className="mb-4 overflow-hidden border-border/80 bg-muted/20 shadow-none">
            <CardHeader className="gap-1 border-b border-border/70 px-4 py-3">
                <CardTitle className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {title}
                </CardTitle>
                {subtitle ? <CardDescription className="text-xs">{subtitle}</CardDescription> : null}
            </CardHeader>
            <CardContent className="p-4">{children}</CardContent>
        </Card>
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

function truncateLabel(value, limit = 22) {
    const stringValue = String(value ?? '');
    return stringValue.length > limit
        ? `${stringValue.slice(0, Math.max(limit - 1, 1))}…`
        : stringValue;
}

function MetricStrip({ items }) {
    if (!items?.length) {
        return null;
    }

    return (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {items.map((item) => (
                <div key={item.label} className="rounded-xl border border-border/70 bg-card/70 px-3 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {item.label}
                    </div>
                    <div className="mt-1 text-base font-semibold text-foreground">{item.value}</div>
                </div>
            ))}
        </div>
    );
}

function buildBarSummary(bars, metricLabel) {
    if (!bars?.length) {
        return [];
    }

    const topBar = [...bars].sort((left, right) => right.value - left.value)[0];
    const totalValue = bars.reduce((sum, bar) => sum + (bar.value || 0), 0);

    return [
        { label: 'Categories', value: formatValue(bars.length) },
        { label: 'Top Segment', value: topBar?.label || 'N/A' },
        { label: 'Top Value', value: formatChartMetric(topBar?.value, metricLabel) },
        { label: 'Combined Total', value: formatChartMetric(totalValue, metricLabel) },
    ];
}

function CategoryLegend({ items, metricLabel }) {
    const legendItems = items.slice(0, 5).map((item) => ({
        key: item.label,
        label: truncateLabel(item.label, 20),
        meta: formatChartMetric(item.value, metricLabel),
        color: item.fill,
    }));

    return (
        <ChartLegendContent
            items={legendItems}
            className="mt-4 border-t border-border/60 pt-3"
        />
    );
}

function BarList({ bars, metricLabel }) {
    const chartData = bars.slice(0, 12).map((bar, index) => ({
        ...bar,
        fill: CHART_COLORS[index % CHART_COLORS.length],
    }));
    const summaryItems = buildBarSummary(chartData, metricLabel);

    return (
        <div>
            <MetricStrip items={summaryItems} />
            <ChartContainer
                config={{
                    value: {
                        label: metricLabel === 'share_pct' ? 'Share %' : 'Value',
                        color: 'var(--chart-2)',
                    },
                }}
                className="min-h-[280px]"
            >
                <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart
                        accessibilityLayer
                        data={chartData}
                        layout="vertical"
                        margin={{ top: 4, right: 12, bottom: 4, left: 12 }}
                    >
                        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                        <YAxis
                            dataKey="label"
                            type="category"
                            tickLine={false}
                            axisLine={false}
                            width={150}
                            tickFormatter={(value) => truncateLabel(value, 24)}
                        />
                        <XAxis
                            dataKey="value"
                            type="number"
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => formatChartMetric(value, metricLabel)}
                        />
                        <ChartTooltip
                            cursor={false}
                            content={
                                <ChartTooltipContent
                                    labelFormatter={(value) => value}
                                    valueFormatter={(value) => formatChartMetric(value, metricLabel)}
                                    footer={(item) =>
                                        item?.payload?.secondary != null
                                            ? `Raw value: ${formatValue(item.payload.secondary)}`
                                            : null
                                    }
                                />
                            }
                        />
                        <Bar dataKey="value" radius={8}>
                            {chartData.map((entry, index) => (
                                <Cell key={`${entry.label}-${index}`} fill={entry.fill} />
                            ))}
                        </Bar>
                    </RechartsBarChart>
                </ResponsiveContainer>
            </ChartContainer>
            <CategoryLegend items={chartData} metricLabel={metricLabel} />
        </div>
    );
}

function LineChart({ points, xLabel, yLabel }) {
    const summaryItems = [
        { label: 'Points', value: formatValue(points.length) },
        { label: 'Start', value: formatValue(points[0]?.value) },
        { label: 'Latest', value: formatValue(points[points.length - 1]?.value) },
        {
            label: 'Change',
            value: formatValue((points[points.length - 1]?.value || 0) - (points[0]?.value || 0)),
        },
    ];

    return (
        <div>
            <MetricStrip items={summaryItems} />
            <ChartContainer
                config={{
                    value: {
                        label: yLabel || 'Value',
                        color: 'var(--chart-1)',
                    },
                }}
                className="min-h-[280px]"
            >
                <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart
                        accessibilityLayer
                        data={points}
                        margin={{ top: 4, right: 12, bottom: 4, left: 12 }}
                    >
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            interval="preserveStartEnd"
                            minTickGap={24}
                            tickFormatter={(value) => truncateLabel(value, 18)}
                            label={{
                                value: xLabel,
                                position: 'insideBottom',
                                offset: -4,
                                fill: 'var(--muted-foreground)',
                            }}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={formatValue}
                            label={{
                                value: yLabel,
                                angle: -90,
                                position: 'insideLeft',
                                fill: 'var(--muted-foreground)',
                            }}
                        />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent valueFormatter={formatValue} />}
                        />
                        <Line
                            type="monotone"
                            dataKey="value"
                            stroke="var(--color-value)"
                            strokeWidth={3}
                            dot={{ fill: 'var(--chart-4)', r: 4 }}
                            activeDot={{ r: 6, fill: 'var(--chart-2)' }}
                        />
                    </RechartsLineChart>
                </ResponsiveContainer>
            </ChartContainer>
            <ChartLegendContent
                items={[{ key: 'value', label: yLabel || 'Value', color: 'var(--chart-1)', meta: xLabel || null }]}
                className="mt-4 border-t border-border/60 pt-3"
            />
        </div>
    );
}

function ScatterPlot({ points, xLabel, yLabel, meta }) {
    const xValues = points.map((point) => point.x);
    const yValues = points.map((point) => point.y);
    const summaryItems = [
        { label: 'Samples', value: formatValue(points.length) },
        { label: `${xLabel} Min`, value: formatValue(Math.min(...xValues)) },
        { label: `${yLabel} Max`, value: formatValue(Math.max(...yValues)) },
    ];

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
            <MetricStrip items={summaryItems} />
            <ChartContainer
                config={{
                    series: {
                        label: `${xLabel} vs ${yLabel}`,
                        color: 'var(--chart-3)',
                    },
                }}
                className="min-h-[300px]"
            >
                <ResponsiveContainer width="100%" height="100%">
                    <RechartsScatterChart
                        accessibilityLayer
                        margin={{ top: 8, right: 12, bottom: 8, left: 12 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                            type="number"
                            dataKey="x"
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={formatValue}
                            label={{
                                value: xLabel,
                                position: 'insideBottom',
                                offset: -4,
                                fill: 'var(--muted-foreground)',
                            }}
                        />
                        <YAxis
                            type="number"
                            dataKey="y"
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={formatValue}
                            label={{
                                value: yLabel,
                                angle: -90,
                                position: 'insideLeft',
                                fill: 'var(--muted-foreground)',
                            }}
                        />
                        <ChartTooltip
                            cursor={{ strokeDasharray: '4 4' }}
                            content={
                                <ChartTooltipContent
                                    hideLabel
                                    valueFormatter={(value, _, item) =>
                                        item.dataKey === 'x'
                                            ? `${xLabel}: ${formatValue(value)}`
                                            : `${yLabel}: ${formatValue(value)}`
                                    }
                                />
                            }
                        />
                        <Scatter data={points} fill="var(--color-series)" />
                    </RechartsScatterChart>
                </ResponsiveContainer>
            </ChartContainer>
            <ChartLegendContent
                items={[{ key: 'series', label: `${xLabel} vs ${yLabel}`, color: 'var(--chart-3)' }]}
                className="border-t border-border/60 pt-3"
            />
        </div>
    );
}

function Histogram({ bins, stats }) {
    const totalCount = bins.reduce((sum, bin) => sum + (bin.count || 0), 0);
    const peakBin = [...bins].sort((left, right) => right.count - left.count)[0];

    return (
        <div className="space-y-4">
            {stats && <MetricGrid stats={stats} />}
            <MetricStrip
                items={[
                    { label: 'Bins', value: formatValue(bins.length) },
                    { label: 'Observations', value: formatValue(totalCount) },
                    { label: 'Peak Range', value: peakBin?.label || 'N/A' },
                    { label: 'Peak Count', value: formatValue(peakBin?.count) },
                ]}
            />
            <ChartContainer
                config={{
                    count: {
                        label: 'Count',
                        color: 'var(--chart-5)',
                    },
                }}
                className="min-h-[280px]"
            >
                <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart
                        accessibilityLayer
                        data={bins}
                        margin={{ top: 4, right: 12, bottom: 4, left: 12 }}
                    >
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            interval="preserveStartEnd"
                            minTickGap={18}
                            tickFormatter={(value) => truncateLabel(value, 12)}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                        />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent valueFormatter={formatValue} />}
                        />
                        <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                            {bins.map((bin, index) => (
                                <Cell
                                    key={`${bin.label}-${index}`}
                                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                                />
                            ))}
                        </Bar>
                    </RechartsBarChart>
                </ResponsiveContainer>
            </ChartContainer>
            <CategoryLegend
                items={bins.map((bin, index) => ({
                    ...bin,
                    value: bin.count,
                    fill: CHART_COLORS[index % CHART_COLORS.length],
                }))}
                metricLabel="count"
            />
        </div>
    );
}

function ResultTable({ headers, rows, summaryItems }) {
    return (
        <div className="space-y-4">
            <MetricStrip items={summaryItems} />
            <div className="overflow-hidden rounded-xl border border-border/70 bg-card/70">
                <Table>
                    <TableHeader>
                        <TableRow>
                            {headers.map((header) => (
                                <TableHead
                                    key={header.key}
                                    className={header.numeric ? 'text-right' : undefined}
                                >
                                    {header.label}
                                </TableHead>
                            ))}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row, index) => (
                            <TableRow key={`${row[headers[0]?.key] ?? 'row'}-${index}`}>
                                {headers.map((header) => (
                                    <TableCell
                                        key={header.key}
                                        className={header.numeric ? 'text-right font-medium tabular-nums' : undefined}
                                    >
                                        {formatValue(row[header.key])}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
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
                {model.stats ? <div className="mb-4"><MetricGrid stats={model.stats} /></div> : null}
                <LineChart points={model.points} xLabel={model.xLabel} yLabel={model.yLabel} />
            </Panel>
        );
    }

    if (model.kind === 'bars') {
        return (
            <Panel title={model.title} subtitle={model.subtitle}>
                {model.stats ? <div className="mb-4"><MetricGrid stats={model.stats} /></div> : null}
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

    if (model.kind === 'table') {
        return (
            <Panel title={model.title}>
                <ResultTable
                    headers={model.headers}
                    rows={model.rows}
                    summaryItems={model.summaryItems}
                />
            </Panel>
        );
    }

    return null;
}
