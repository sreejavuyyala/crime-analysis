# Crime Analysis

Exploratory data analysis of the UCI **Communities and Crime** dataset — cleaning,
missing-value handling, feature engineering, visualization, correlation analysis,
and PCA on violent crime rates (`ViolentCrimesPerPop`) across 1,994 US communities.

**Live dashboard: https://sreejavuyyala.github.io/crime-analysis/** — an interactive
view of the same metrics (correlations, decile trends, PCA variance, rent
distribution) that renders directly in the browser, no setup required.

## Dataset

[UCI Machine Learning Repository — Communities and Crime](https://archive.ics.uci.edu/ml/machine-learning-databases/communities/communities.data)

128 socio-economic, demographic, and law-enforcement attributes per community
(normalized 0–1), including the target variable `ViolentCrimesPerPop`. The
script downloads the data directly from the UCI archive at runtime.

## Setup

```bash
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Usage

```bash
python crime_analysis.py
```

Running the script will:

1. Load the raw dataset (128 columns, 1994 rows) from the UCI archive.
2. Drop non-predictive identifier columns (`state`, `county`, `community`,
   `communityname`, `fold`).
3. Convert `'?'` placeholders to `NaN`, mean-impute `OtherPerCap` (only 1
   missing value), and drop the 22 law-enforcement columns missing in >80%
   of rows (not usable for imputation) — leaving 101 columns.
4. Engineer features: `highCrime` (boolean, >0.1), `violent_crime_occurence`
   (above/below the dataset mean), and `population_bin` (5 equal-width bins).
5. Produce exploratory plots: violent crime vs. age groups, race/household
   size, employment categories, population-bin boxplot, and rent
   distributions (raw vs. log-transformed).
6. Compute Pearson correlations of every feature against
   `ViolentCrimesPerPop`.
7. Run PCA (14 components, ~84% of variance) on the 100 predictive features
   after standardization and a 70/30 train/test split.

## Key findings

Strongest **negative** correlations with violent crime:
- `PctKids2Par` (-0.74), `PctFam2Par` (-0.71), `racePctWhite` (-0.68),
  `PctYoungKids2Par` (-0.67), `PctTeen2Par` (-0.66) — two-parent household
  rates are the strongest protective factor in this dataset.

Strongest **positive** correlations:
- `PctIlleg` (0.74), `racepctblack` (0.63), `highCrime` (0.61),
  `pctWPubAsst` (0.57), `FemalePctDiv` (0.56), `TotalPctDiv` (0.55).

Interpretation should be cautious: many of these variables are proxies for
poverty and family structure rather than independent causal factors, and the
dataset itself carries known sampling/reporting biases.

## Dashboard

`docs/` is a static, dependency-free site (published via GitHub Pages) that
renders the pipeline's key metrics as an interactive dashboard — stat tiles,
a diverging correlation chart, decile trend lines, a population-size box
plot, a rent histogram with a raw/log toggle, and PCA variance — each with a
"View as table" fallback and light/dark themes. It reads a precomputed
`docs/data/dashboard.json`; regenerate it after changing the pipeline with:

```bash
python scripts/generate_dashboard_data.py
```

To preview locally:

```bash
cd docs && python -m http.server 8000   # then open http://localhost:8000
```

## Project structure

```
crime-analysis/
├── crime_analysis.py               # full analysis pipeline (load → clean → engineer → visualize → correlate → PCA)
├── scripts/
│   └── generate_dashboard_data.py  # runs the pipeline, exports docs/data/dashboard.json
├── docs/                           # static dashboard (published via GitHub Pages)
│   ├── index.html
│   ├── chart.js
│   └── data/dashboard.json
├── requirements.txt
├── .gitignore
└── README.md
```

## License

MIT — see [LICENSE](LICENSE).
