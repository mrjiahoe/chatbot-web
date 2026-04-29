from __future__ import annotations

from typing import Any

import pandas as pd


def numeric_series(df: pd.DataFrame, column: str) -> pd.Series:
    return pd.to_numeric(df[column], errors="coerce")


def strength_label(value: float) -> str:
    absolute = abs(value)

    if absolute >= 0.8:
        return "very strong"
    if absolute >= 0.6:
        return "strong"
    if absolute >= 0.4:
        return "moderate"
    if absolute >= 0.2:
        return "weak"
    return "very weak"


def build_trend(df: pd.DataFrame, column: str, group_by: str) -> dict[str, Any]:
    grouped = (
        df.assign(**{column: numeric_series(df, column)})[[group_by, column]]
        .dropna()
        .groupby(group_by, as_index=False)[column]
        .mean()
        .sort_values(group_by)
    )

    if grouped.empty:
        return {
            "summary": f"Trend analysis could not find numeric values for {column} across {group_by}.",
            "rows": [],
        }

    values = grouped[column].tolist()
    direction = "flat"
    if len(values) >= 2:
        if values[-1] > values[0]:
            direction = "increasing"
        elif values[-1] < values[0]:
            direction = "decreasing"

    return {
        "summary": f"Trend analysis shows an overall {direction} pattern in {column} across {group_by}.",
        "rows": grouped.to_dict(orient="records"),
        "direction": direction,
    }


def build_comparison(df: pd.DataFrame, column: str, group_by: str) -> dict[str, Any]:
    grouped = (
        df.assign(**{column: numeric_series(df, column)})[[group_by, column]]
        .dropna()
        .groupby(group_by, as_index=False)[column]
        .mean()
        .sort_values(column, ascending=False)
    )

    if grouped.empty:
        return {
            "summary": f"Comparison analysis could not find numeric values for {column} grouped by {group_by}.",
            "rows": [],
        }

    return {
        "summary": f"Comparison analysis grouped {column} by {group_by} using the mean value per group.",
        "rows": grouped.to_dict(orient="records"),
    }


def build_distribution(df: pd.DataFrame, column: str) -> dict[str, Any]:
    series = df[column].dropna()
    numeric = pd.to_numeric(series, errors="coerce")

    if len(series) > 0 and numeric.notna().sum() == len(series):
        distribution: dict[str, Any] = {
            "summary": f"Distribution analysis calculated descriptive statistics for {column}.",
            "distribution_type": "numeric",
            "rows": [
                {
                    "count": int(numeric.count()),
                    "mean": float(numeric.mean()),
                    "median": float(numeric.median()),
                    "min": float(numeric.min()),
                    "max": float(numeric.max()),
                }
            ],
        }

        unique_values = int(numeric.nunique())
        if unique_values > 1:
            bin_count = min(8, unique_values)
            binned = pd.cut(numeric, bins=bin_count, include_lowest=True)
            counts = binned.value_counts(sort=False)
            distribution["bins"] = [
                {
                    "label": str(interval),
                    "count": int(count),
                }
                for interval, count in counts.items()
            ]
        else:
            distribution["bins"] = [
                {
                    "label": str(float(numeric.iloc[0])),
                    "count": int(numeric.count()),
                }
            ]

        return distribution

    counts = series.astype(str).value_counts().reset_index()
    counts.columns = [column, "count"]

    return {
        "summary": f"Distribution analysis calculated category counts for {column}.",
        "distribution_type": "categorical",
        "rows": counts.to_dict(orient="records"),
    }


def sample_points(
    df: pd.DataFrame,
    x_column: str,
    y_column: str,
    max_points: int = 80,
) -> list[dict[str, float]]:
    if len(df) <= max_points:
        sample = df
    else:
        sample = df.sample(n=max_points, random_state=42)

    return [
        {
            "x": float(row[x_column]),
            "y": float(row[y_column]),
        }
        for _, row in sample.iterrows()
    ]


def build_composition(df: pd.DataFrame, column: str, group_by: str) -> dict[str, Any]:
    numeric_df = df.assign(**{column: numeric_series(df, column)})[[group_by, column]].dropna()

    if numeric_df.empty:
        return {
            "summary": f"Composition analysis could not find numeric values for {column} grouped by {group_by}.",
            "rows": [],
        }

    grouped = (
        numeric_df.groupby(group_by, as_index=False)[column]
        .sum()
        .sort_values(column, ascending=False)
    )
    total = grouped[column].sum()
    grouped["share_pct"] = grouped[column].apply(
        lambda value: round((value / total) * 100, 2) if total else 0
    )

    return {
        "summary": f"Composition analysis calculated each {group_by} group's share of total {column}.",
        "rows": grouped.to_dict(orient="records"),
        "total": float(total),
    }


def build_outlier(
    df: pd.DataFrame,
    column: str,
    group_by: str | None = None,
) -> dict[str, Any]:
    working = df.copy()
    working[column] = numeric_series(working, column)
    selected_columns = [column] + ([group_by] if group_by else [])
    clean = working[selected_columns].dropna(subset=[column])

    if clean.empty:
        return {
            "summary": f"Outlier analysis could not find numeric values for {column}.",
            "rows": [],
        }

    q1 = clean[column].quantile(0.25)
    q3 = clean[column].quantile(0.75)
    iqr = q3 - q1
    lower_bound = q1 - 1.5 * iqr
    upper_bound = q3 + 1.5 * iqr
    outliers = clean[(clean[column] < lower_bound) | (clean[column] > upper_bound)].copy()
    outliers["distance_from_median"] = (outliers[column] - clean[column].median()).round(4)
    outliers = outliers.sort_values(column, ascending=False)

    return {
        "summary": (
            f"Outlier analysis found {len(outliers)} potential outlier"
            f"{'' if len(outliers) == 1 else 's'} in {column} using the IQR method."
        ),
        "rows": outliers.to_dict(orient="records"),
        "bounds": {
            "lower": float(lower_bound),
            "upper": float(upper_bound),
        },
    }


def build_correlation(df: pd.DataFrame, column: str, second_column: str) -> dict[str, Any]:
    working = df.copy()
    working[column] = numeric_series(working, column)
    working[second_column] = numeric_series(working, second_column)
    clean = working[[column, second_column]].dropna()

    if len(clean) < 2:
        return {
            "summary": f"Correlation analysis needs at least 2 rows with numeric values for {column} and {second_column}.",
            "rows": [],
        }

    coefficient = clean[column].corr(clean[second_column])
    if pd.isna(coefficient):
        return {
            "summary": f"Correlation analysis could not compute a stable correlation for {column} and {second_column}.",
            "rows": [],
        }

    direction = "positive" if coefficient > 0 else "negative" if coefficient < 0 else "flat"
    strength = strength_label(float(coefficient))

    return {
        "summary": (
            f"Correlation analysis found a {strength} {direction} relationship "
            f"between {column} and {second_column}."
        ),
        "points": sample_points(clean, column, second_column),
        "rows": [
            {
                "column": column,
                "second_column": second_column,
                "correlation": round(float(coefficient), 4),
                "strength": strength,
                "direction": direction,
                "sample_size": int(len(clean)),
            }
        ],
    }


def run_analysis(payload: dict[str, Any]) -> dict[str, Any]:
    request = payload["request"]
    rows = payload.get("rows", [])
    df = pd.DataFrame(rows)

    if df.empty:
        return {"summary": "No data matched the analysis request.", "rows": []}

    analysis_type = request["analysis"]
    column = request["column"]
    second_column = request.get("second_column")
    group_by = request.get("group_by")

    if analysis_type == "trend":
        return build_trend(df, column, group_by)
    if analysis_type == "comparison":
        return build_comparison(df, column, group_by)
    if analysis_type == "distribution":
        return build_distribution(df, column)
    if analysis_type == "composition":
        return build_composition(df, column, group_by)
    if analysis_type == "outlier":
        return build_outlier(df, column, group_by)
    if analysis_type == "correlation":
        return build_correlation(df, column, second_column)

    raise ValueError(f"Unsupported analysis type: {analysis_type}")
