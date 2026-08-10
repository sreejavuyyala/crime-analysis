"""
Runs the crime_analysis pipeline and exports every aggregate the static
dashboard (docs/index.html) needs as a single JSON file. No raw per-row
data leaves this script -- only summary stats, correlations, and binned
aggregates, so the published dashboard stays small and self-contained.
"""

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from crime_analysis import clean_data, engineer_features, load_data  # noqa: E402

OUT_PATH = Path(__file__).resolve().parent.parent / "docs" / "data" / "dashboard.json"

AGE_COLUMNS = ["agePct12t21", "agePct12t29", "agePct16t24", "agePct65up"]
EMPLOYMENT_COLUMNS = ["PctUnemployed", "PctEmploy", "PctEmplManu", "PctEmplProfServ"]
RENT_COLUMN = "RentMedian"
N_DECILES = 10


def summary_stats(raw: pd.DataFrame, clean: pd.DataFrame) -> dict:
    return {
        "communities": int(clean.shape[0]),
        "rawColumns": int(raw.shape[1]),
        "cleanColumns": int(clean.shape[1]) - 4,  # exclude engineered columns
        "highCrimeCount": int(clean["highCrime"].sum()),
        "lowCrimeCount": int((~clean["highCrime"]).sum()),
        "meanViolentCrime": round(float(clean["ViolentCrimesPerPop"].mean()), 4),
        "medianViolentCrime": round(float(clean["ViolentCrimesPerPop"].median()), 4),
    }


def correlation_extremes(df: pd.DataFrame, n: int = 10) -> dict:
    exclude = {"ViolentCrimesPerPop", "mean_violent_crimes", "highCrime", "population_bin"}
    corr = df.corr(method="pearson", numeric_only=True)["ViolentCrimesPerPop"]
    corr = corr.drop(labels=[c for c in exclude if c in corr.index]).dropna()
    corr = corr.round(4)

    top_positive = corr.sort_values(ascending=False).head(n)
    top_negative = corr.sort_values(ascending=True).head(n)

    return {
        "positive": [{"feature": k, "r": v} for k, v in top_positive.items()],
        "negative": [{"feature": k, "r": v} for k, v in top_negative.items()],
    }


def decile_trend(df: pd.DataFrame, columns: list) -> dict:
    deciles = pd.qcut(df["ViolentCrimesPerPop"], N_DECILES, labels=False, duplicates="drop")
    grouped = df.groupby(deciles)[columns + ["ViolentCrimesPerPop"]].mean().round(4)
    grouped = grouped.sort_index()
    return {
        "deciles": [f"D{i + 1}" for i in range(len(grouped))],
        "meanViolentCrime": grouped["ViolentCrimesPerPop"].tolist(),
        "series": {col: grouped[col].tolist() for col in columns},
    }


def population_bin_distribution(df: pd.DataFrame) -> dict:
    rows = []
    for b in sorted(df["population_bin"].unique()):
        subset = df.loc[df["population_bin"] == b, "ViolentCrimesPerPop"]
        rows.append({
            "bin": int(b),
            "count": int(subset.shape[0]),
            "min": round(float(subset.min()), 4),
            "q1": round(float(subset.quantile(0.25)), 4),
            "median": round(float(subset.median()), 4),
            "q3": round(float(subset.quantile(0.75)), 4),
            "max": round(float(subset.max()), 4),
            "mean": round(float(subset.mean()), 4),
        })
    return {"bins": rows}


def histogram(series: pd.Series, n_bins: int = 10) -> dict:
    counts, edges = np.histogram(series.dropna(), bins=n_bins)
    return {
        "counts": counts.tolist(),
        "edges": [round(float(e), 3) for e in edges],
    }


def rent_distribution(df: pd.DataFrame) -> dict:
    raw = df[RENT_COLUMN].dropna()
    log = np.log(raw + 1)
    return {
        "column": RENT_COLUMN,
        "raw": histogram(raw),
        "log": histogram(log),
    }


def pca_variance(df: pd.DataFrame, n_components: int = 14, seed: int = 0) -> dict:
    from sklearn.decomposition import PCA
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler

    X = df.iloc[:, 0:100].values
    y = df.iloc[:, 100].values
    X_train, _, _, _ = train_test_split(X, y, test_size=0.3, random_state=seed)

    X_train = StandardScaler().fit_transform(X_train)
    pca = PCA(n_components=n_components)
    pca.fit(X_train)

    ratio = pca.explained_variance_ratio_.round(4)
    return {
        "components": [f"PC{i + 1}" for i in range(n_components)],
        "varianceRatio": ratio.tolist(),
        "cumulativeVariance": round(float(ratio.sum()), 4),
    }


def main() -> None:
    raw = load_data()
    clean = clean_data(raw)
    df = engineer_features(clean)

    payload = {
        "summary": summary_stats(raw, df),
        "correlations": correlation_extremes(df),
        "ageTrend": decile_trend(df, AGE_COLUMNS),
        "employmentTrend": decile_trend(df, EMPLOYMENT_COLUMNS),
        "populationBins": population_bin_distribution(df),
        "rent": rent_distribution(df),
        "pca": pca_variance(df),
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, indent=2))
    print(f"Wrote {OUT_PATH} ({OUT_PATH.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
