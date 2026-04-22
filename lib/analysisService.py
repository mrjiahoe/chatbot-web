import json
import sys

try:
    import pandas as pd
except ImportError as error:
    sys.stderr.write(
        'pandas is required for analysisService.py. Install it with "pip install pandas".\n'
    )
    raise error


def build_trend(df, column, group_by):
    grouped = (
        df[[group_by, column]]
        .dropna()
        .groupby(group_by, as_index=False)[column]
        .mean()
        .sort_values(group_by)
    )

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


def build_comparison(df, column, group_by):
    grouped = (
        df[[group_by, column]]
        .dropna()
        .groupby(group_by, as_index=False)[column]
        .mean()
        .sort_values(column, ascending=False)
    )

    return {
        "summary": f"Comparison analysis grouped {column} by {group_by} using the mean value per group.",
        "rows": grouped.to_dict(orient="records"),
    }


def build_distribution(df, column):
    series = df[column].dropna()

    if pd.api.types.is_numeric_dtype(series):
        return {
            "summary": f"Distribution analysis calculated descriptive statistics for {column}.",
            "rows": [
                {
                    "count": int(series.count()),
                    "mean": float(series.mean()),
                    "median": float(series.median()),
                    "min": float(series.min()),
                    "max": float(series.max()),
                }
            ],
        }

    counts = series.astype(str).value_counts().reset_index()
    counts.columns = [column, "count"]

    return {
        "summary": f"Distribution analysis calculated category counts for {column}.",
        "rows": counts.to_dict(orient="records"),
    }


def main():
    payload = json.load(sys.stdin)
    request = payload["request"]
    rows = payload.get("rows", [])
    df = pd.DataFrame(rows)

    if df.empty:
        print(json.dumps({"summary": "No data matched the analysis request.", "rows": []}))
        return

    analysis_type = request["analysis"]
    column = request["column"]
    group_by = request.get("group_by")

    if analysis_type == "trend":
        result = build_trend(df, column, group_by)
    elif analysis_type == "comparison":
        result = build_comparison(df, column, group_by)
    elif analysis_type == "distribution":
        result = build_distribution(df, column)
    else:
        raise ValueError(f"Unsupported analysis type: {analysis_type}")

    print(json.dumps(result, default=str))


if __name__ == "__main__":
    main()
