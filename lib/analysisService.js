function isPresent(value) {
    return value !== null && value !== undefined;
}

function toNumber(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string' && value.trim() === '') {
        return null;
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
}

function strengthLabel(value) {
    const absolute = Math.abs(value);

    if (absolute >= 0.8) {
        return 'very strong';
    }
    if (absolute >= 0.6) {
        return 'strong';
    }
    if (absolute >= 0.4) {
        return 'moderate';
    }
    if (absolute >= 0.2) {
        return 'weak';
    }
    return 'very weak';
}

function compareValues(a, b) {
    if (typeof a === 'number' && typeof b === 'number') {
        return a - b;
    }

    return String(a).localeCompare(String(b), undefined, {
        numeric: true,
        sensitivity: 'base',
    });
}

function mean(values) {
    if (values.length === 0) {
        return null;
    }

    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function quantile(sortedValues, q) {
    if (sortedValues.length === 0) {
        return null;
    }

    if (sortedValues.length === 1) {
        return sortedValues[0];
    }

    const position = (sortedValues.length - 1) * q;
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.ceil(position);

    if (lowerIndex === upperIndex) {
        return sortedValues[lowerIndex];
    }

    const lower = sortedValues[lowerIndex];
    const upper = sortedValues[upperIndex];
    return lower + (upper - lower) * (position - lowerIndex);
}

function median(sortedValues) {
    return quantile(sortedValues, 0.5);
}

function round(value, decimals = 4) {
    const multiplier = 10 ** decimals;
    return Math.round(value * multiplier) / multiplier;
}

function formatBinEdge(value) {
    if (Number.isInteger(value)) {
        return String(value);
    }

    return Number(value.toFixed(6)).toString();
}

function buildNumericBins(values, binCount) {
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    if (minValue === maxValue) {
        return [{
            label: String(Number(minValue)),
            count: values.length,
        }];
    }

    const width = (maxValue - minValue) / binCount;
    const bins = Array.from({ length: binCount }, (_, index) => {
        const left = minValue + index * width;
        const right = index === binCount - 1 ? maxValue : minValue + (index + 1) * width;

        return {
            left,
            right,
            count: 0,
        };
    });

    values.forEach((value) => {
        let index = Math.floor((value - minValue) / width);

        if (index >= binCount) {
            index = binCount - 1;
        }

        bins[index].count += 1;
    });

    return bins.map((bin, index) => ({
        label: index === 0
            ? `[${formatBinEdge(bin.left)}, ${formatBinEdge(bin.right)}]`
            : `(${formatBinEdge(bin.left)}, ${formatBinEdge(bin.right)}]`,
        count: bin.count,
    }));
}

function groupNumericValues(rows, column, groupBy, reducer = mean) {
    const groupedValues = new Map();

    rows.forEach((row) => {
        const groupValue = row[groupBy];
        const numericValue = toNumber(row[column]);

        if (!isPresent(groupValue) || numericValue === null) {
            return;
        }

        if (!groupedValues.has(groupValue)) {
            groupedValues.set(groupValue, []);
        }

        groupedValues.get(groupValue).push(numericValue);
    });

    return Array.from(groupedValues.entries()).map(([groupValue, values]) => ({
        [groupBy]: groupValue,
        [column]: reducer(values),
    }));
}

function samplePoints(rows, xColumn, yColumn, maxPoints = 80) {
    if (rows.length <= maxPoints) {
        return rows.map((row) => ({
            x: row[xColumn],
            y: row[yColumn],
        }));
    }

    const step = rows.length / maxPoints;

    return Array.from({ length: maxPoints }, (_, index) => rows[Math.floor(index * step)]).map((row) => ({
        x: row[xColumn],
        y: row[yColumn],
    }));
}

function pearsonCorrelation(xValues, yValues) {
    const xMean = mean(xValues);
    const yMean = mean(yValues);
    let numerator = 0;
    let xVariance = 0;
    let yVariance = 0;

    for (let index = 0; index < xValues.length; index += 1) {
        const xDiff = xValues[index] - xMean;
        const yDiff = yValues[index] - yMean;
        numerator += xDiff * yDiff;
        xVariance += xDiff ** 2;
        yVariance += yDiff ** 2;
    }

    const denominator = Math.sqrt(xVariance * yVariance);
    return denominator === 0 ? null : numerator / denominator;
}

function buildTrend(rows, column, groupBy) {
    const grouped = groupNumericValues(rows, column, groupBy)
        .sort((left, right) => compareValues(left[groupBy], right[groupBy]));

    if (grouped.length === 0) {
        return {
            summary: `Trend analysis could not find numeric values for ${column} across ${groupBy}.`,
            rows: [],
        };
    }

    const values = grouped.map((row) => row[column]);
    let direction = 'flat';

    if (values.length >= 2) {
        if (values[values.length - 1] > values[0]) {
            direction = 'increasing';
        } else if (values[values.length - 1] < values[0]) {
            direction = 'decreasing';
        }
    }

    return {
        summary: `Trend analysis shows an overall ${direction} pattern in ${column} across ${groupBy}.`,
        rows: grouped,
        direction,
    };
}

function buildComparison(rows, column, groupBy) {
    const grouped = groupNumericValues(rows, column, groupBy)
        .sort((left, right) => right[column] - left[column]);

    if (grouped.length === 0) {
        return {
            summary: `Comparison analysis could not find numeric values for ${column} grouped by ${groupBy}.`,
            rows: [],
        };
    }

    return {
        summary: `Comparison analysis grouped ${column} by ${groupBy} using the mean value per group.`,
        rows: grouped,
    };
}

function buildDistribution(rows, column) {
    const series = rows
        .map((row) => row[column])
        .filter((value) => isPresent(value));

    const numericValues = series
        .map((value) => toNumber(value))
        .filter((value) => value !== null);

    if (series.length > 0 && numericValues.length === series.length) {
        const sortedValues = [...numericValues].sort((left, right) => left - right);
        const uniqueValues = new Set(sortedValues).size;
        const distribution = {
            summary: `Distribution analysis calculated descriptive statistics for ${column}.`,
            distribution_type: 'numeric',
            rows: [{
                count: sortedValues.length,
                mean: mean(sortedValues),
                median: median(sortedValues),
                min: sortedValues[0],
                max: sortedValues[sortedValues.length - 1],
            }],
            bins: uniqueValues > 1
                ? buildNumericBins(sortedValues, Math.min(8, uniqueValues))
                : [{
                    label: String(Number(sortedValues[0])),
                    count: sortedValues.length,
                }],
        };

        return distribution;
    }

    const counts = new Map();

    series.forEach((value) => {
        const label = String(value);
        counts.set(label, (counts.get(label) || 0) + 1);
    });

    return {
        summary: `Distribution analysis calculated category counts for ${column}.`,
        distribution_type: 'categorical',
        rows: Array.from(counts.entries())
            .map(([label, count]) => ({
                [column]: label,
                count,
            }))
            .sort((left, right) => right.count - left.count),
    };
}

function buildComposition(rows, column, groupBy) {
    const grouped = groupNumericValues(
        rows,
        column,
        groupBy,
        (values) => values.reduce((sum, value) => sum + value, 0)
    ).sort((left, right) => right[column] - left[column]);

    if (grouped.length === 0) {
        return {
            summary: `Composition analysis could not find numeric values for ${column} grouped by ${groupBy}.`,
            rows: [],
        };
    }

    const total = grouped.reduce((sum, row) => sum + row[column], 0);

    return {
        summary: `Composition analysis calculated each ${groupBy} group's share of total ${column}.`,
        rows: grouped.map((row) => ({
            ...row,
            share_pct: total ? round((row[column] / total) * 100, 2) : 0,
        })),
        total,
    };
}

function buildOutlier(rows, column, groupBy = null) {
    const cleanRows = rows
        .map((row) => {
            const numericValue = toNumber(row[column]);

            if (numericValue === null) {
                return null;
            }

            return {
                ...row,
                [column]: numericValue,
            };
        })
        .filter(Boolean);

    if (cleanRows.length === 0) {
        return {
            summary: `Outlier analysis could not find numeric values for ${column}.`,
            rows: [],
        };
    }

    const sortedValues = cleanRows
        .map((row) => row[column])
        .sort((left, right) => left - right);
    const q1 = quantile(sortedValues, 0.25);
    const q3 = quantile(sortedValues, 0.75);
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;
    const medianValue = median(sortedValues);
    const outliers = cleanRows
        .filter((row) => row[column] < lowerBound || row[column] > upperBound)
        .map((row) => ({
            ...(groupBy ? { [groupBy]: row[groupBy] } : {}),
            [column]: row[column],
            distance_from_median: round(row[column] - medianValue),
        }))
        .sort((left, right) => right[column] - left[column]);

    return {
        summary: `Outlier analysis found ${outliers.length} potential outlier${outliers.length === 1 ? '' : 's'} in ${column} using the IQR method.`,
        rows: outliers,
        bounds: {
            lower: lowerBound,
            upper: upperBound,
        },
    };
}

function buildCorrelation(rows, column, secondColumn) {
    const cleanRows = rows
        .map((row) => {
            const xValue = toNumber(row[column]);
            const yValue = toNumber(row[secondColumn]);

            if (xValue === null || yValue === null) {
                return null;
            }

            return {
                [column]: xValue,
                [secondColumn]: yValue,
            };
        })
        .filter(Boolean);

    if (cleanRows.length < 2) {
        return {
            summary: `Correlation analysis needs at least 2 rows with numeric values for ${column} and ${secondColumn}.`,
            rows: [],
        };
    }

    const xValues = cleanRows.map((row) => row[column]);
    const yValues = cleanRows.map((row) => row[secondColumn]);
    const coefficient = pearsonCorrelation(xValues, yValues);

    if (coefficient === null || Number.isNaN(coefficient)) {
        return {
            summary: `Correlation analysis could not compute a stable correlation for ${column} and ${secondColumn}.`,
            rows: [],
        };
    }

    const direction = coefficient > 0 ? 'positive' : coefficient < 0 ? 'negative' : 'flat';
    const strength = strengthLabel(coefficient);

    return {
        summary: `Correlation analysis found a ${strength} ${direction} relationship between ${column} and ${secondColumn}.`,
        points: samplePoints(cleanRows, column, secondColumn),
        rows: [{
            column,
            second_column: secondColumn,
            correlation: round(coefficient),
            strength,
            direction,
            sample_size: cleanRows.length,
        }],
    };
}

export function runAnalysis(payload) {
    const request = payload.request || {};
    const rows = Array.isArray(payload.rows) ? payload.rows : [];

    if (rows.length === 0) {
        return {
            summary: 'No data matched the analysis request.',
            rows: [],
        };
    }

    const { analysis, column, second_column: secondColumn, group_by: groupBy } = request;

    if (analysis === 'trend') {
        return buildTrend(rows, column, groupBy);
    }

    if (analysis === 'comparison') {
        return buildComparison(rows, column, groupBy);
    }

    if (analysis === 'distribution') {
        return buildDistribution(rows, column);
    }

    if (analysis === 'composition') {
        return buildComposition(rows, column, groupBy);
    }

    if (analysis === 'outlier') {
        return buildOutlier(rows, column, groupBy);
    }

    if (analysis === 'correlation') {
        return buildCorrelation(rows, column, secondColumn);
    }

    throw new Error(`Unsupported analysis type: ${analysis}`);
}
