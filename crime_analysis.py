"""
Crime Analysis
==============
Exploratory data analysis of the UCI "Communities and Crime" dataset:
data cleaning, missing-value handling, feature engineering, visualization,
correlation analysis, and PCA on violent crime rates across US communities.

Dataset: https://archive.ics.uci.edu/ml/machine-learning-databases/communities/communities.data
"""

import numpy as np
import pandas as pd
import seaborn as sns
from matplotlib import pyplot as plt
from sklearn.decomposition import PCA
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

sns.set(style="whitegrid")

TITLE_FONT = {"family": "arial", "weight": "bold", "color": "darkred", "size": 13}
LABEL_FONT = {"family": "arial", "weight": "bold", "color": "darkblue", "size": 10}

DATA_URL = (
    "https://archive.ics.uci.edu/ml/machine-learning-databases/"
    "communities/communities.data"
)

COLUMN_NAMES = [
    "state", "county", "community", "communityname", "fold", "population",
    "householdsize", "racepctblack", "racePctWhite", "racePctAsian",
    "racePctHisp", "agePct12t21", "agePct12t29", "agePct16t24", "agePct65up",
    "numbUrban", "pctUrban", "medIncome", "pctWWage", "pctWFarmSelf",
    "pctWInvInc", "pctWSocSec", "pctWPubAsst", "pctWRetire", "medFamInc",
    "perCapInc", "whitePerCap", "blackPerCap", "indianPerCap", "AsianPerCap",
    "OtherPerCap", "HispPerCap", "NumUnderPov", "PctPopUnderPov",
    "PctLess9thGrade", "PctNotHSGrad", "PctBSorMore", "PctUnemployed",
    "PctEmploy", "PctEmplManu", "PctEmplProfServ", "PctOccupManu",
    "PctOccupMgmtProf", "MalePctDivorce", "MalePctNevMarr", "FemalePctDiv",
    "TotalPctDiv", "PersPerFam", "PctFam2Par", "PctKids2Par",
    "PctYoungKids2Par", "PctTeen2Par", "PctWorkMomYoungKids", "PctWorkMom",
    "NumIlleg", "PctIlleg", "NumImmig", "PctImmigRecent", "PctImmigRec5",
    "PctImmigRec8", "PctImmigRec10", "PctRecentImmig", "PctRecImmig5",
    "PctRecImmig8", "PctRecImmig10", "PctSpeakEnglOnly",
    "PctNotSpeakEnglWell", "PctLargHouseFam", "PctLargHouseOccup",
    "PersPerOccupHous", "PersPerOwnOccHous", "PersPerRentOccHous",
    "PctPersOwnOccup", "PctPersDenseHous", "PctHousLess3BR", "MedNumBR",
    "HousVacant", "PctHousOccup", "PctHousOwnOcc", "PctVacantBoarded",
    "PctVacMore6Mos", "MedYrHousBuilt", "PctHousNoPhone", "PctWOFullPlumb",
    "OwnOccLowQuart", "OwnOccMedVal", "OwnOccHiQuart", "RentLowQ",
    "RentMedian", "RentHighQ", "MedRent", "MedRentPctHousInc",
    "MedOwnCostPctInc", "MedOwnCostPctIncNoMtg", "NumInShelters",
    "NumStreet", "PctForeignBorn", "PctBornSameState", "PctSameHouse85",
    "PctSameCity85", "PctSameState85", "LemasSwornFT", "LemasSwFTPerPop",
    "LemasSwFTFieldOps", "LemasSwFTFieldPerPop", "LemasTotalReq",
    "LemasTotReqPerPop", "PolicReqPerOffic", "PolicPerPop",
    "RacialMatchCommPol", "PctPolicWhite", "PctPolicBlack", "PctPolicHisp",
    "PctPolicAsian", "PctPolicMinor", "OfficAssgnDrugUnits",
    "NumKindsDrugsSeiz", "PolicAveOTWorked", "LandArea", "PopDens",
    "PctUsePubTrans", "PolicCars", "PolicOperBudg", "LemasPctPolicOnPatr",
    "LemasGangUnitDeploy", "LemasPctOfficDrugUn", "PolicBudgPerPop",
    "ViolentCrimesPerPop",
]

# Columns where '?' means "not reported" for >80% of communities;
# not usable for imputation, so they are dropped rather than filled.
HIGH_MISSING_COLUMNS = [
    "LemasSwornFT", "LemasSwFTPerPop", "LemasSwFTFieldOps",
    "LemasSwFTFieldPerPop", "LemasTotalReq", "LemasTotReqPerPop",
    "PolicReqPerOffic", "PolicPerPop", "RacialMatchCommPol", "PctPolicWhite",
    "PctPolicBlack", "PctPolicHisp", "PctPolicAsian", "PctPolicMinor",
    "OfficAssgnDrugUnits", "NumKindsDrugsSeiz", "PolicAveOTWorked",
    "PolicCars", "PolicOperBudg", "LemasPctPolicOnPatr",
    "LemasGangUnitDeploy", "PolicBudgPerPop",
]


def load_data() -> pd.DataFrame:
    return pd.read_csv(DATA_URL, names=COLUMN_NAMES)


def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """Drop non-predictive identifiers, coerce '?' to NaN, and resolve
    missing values (mean-impute OtherPerCap, drop the high-missing columns).
    """
    df = df.drop(columns=["state", "county", "community", "communityname", "fold"])
    df = df.replace("?", np.nan)

    imputer = SimpleImputer(missing_values=np.nan, strategy="mean")
    df[["OtherPerCap"]] = imputer.fit_transform(df[["OtherPerCap"]])

    df = df.drop(columns=HIGH_MISSING_COLUMNS)
    return df


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add binary/binned crime indicators used throughout the analysis."""
    df["highCrime"] = df["ViolentCrimesPerPop"] > 0.1

    mean_violent_crimes = df["ViolentCrimesPerPop"].mean()
    df["mean_violent_crimes"] = mean_violent_crimes
    df["violent_crime_occurence"] = np.where(
        df["ViolentCrimesPerPop"] >= mean_violent_crimes, "1", "0"
    )

    num_bins = 5
    bin_width = (df["population"].max() - df["population"].min()) / num_bins
    bin_boundaries = [df["population"].min() + i * bin_width for i in range(num_bins + 1)]
    df["population_bin"] = np.digitize(df["population"], bin_boundaries)

    return df


def plot_age_vs_crime(df: pd.DataFrame) -> None:
    ax = df.plot(x="ViolentCrimesPerPop", y="agePct12t21", kind="scatter", c="red", s=2, label="Age%12-21")
    df.plot(x="ViolentCrimesPerPop", y="agePct12t29", kind="scatter", c="green", s=2, label="Age%12-29", ax=ax)
    df.plot(x="ViolentCrimesPerPop", y="agePct16t24", kind="scatter", c="blue", s=2, label="Age%16-24", ax=ax)
    df.plot(x="ViolentCrimesPerPop", y="agePct65up", kind="scatter", c="black", s=2, label="Age%65up", ax=ax)
    plt.title("Violent Crimes by all age%")
    plt.xlabel("Violent crimes per pop")
    plt.ylabel("age%")
    plt.show()


def plot_age12t29_crosstab(df: pd.DataFrame) -> None:
    pd.crosstab(df["agePct12t29"], df["violent_crime_occurence"]).plot(kind="bar")
    plt.title("Age Per Count from 12 to 29 yrs by Violent Crime Occurence")
    plt.xlabel("Age Per Count from 12 to 29 yrs")
    plt.xticks(rotation="vertical")
    plt.ylabel("Frequency")
    plt.show()


def plot_race_household_vs_crime(df: pd.DataFrame) -> None:
    ax = df.plot(x="ViolentCrimesPerPop", y="householdsize", kind="scatter", c="blue", label="householdsize")
    df.plot(x="ViolentCrimesPerPop", y="racepctblack", kind="scatter", c="pink", label="racepctblack", ax=ax)
    plt.title("racepctblack, householdsize vs ViolentCrimesPerPop")
    plt.show()


def plot_employment_vs_crime(df: pd.DataFrame) -> None:
    ax = df.plot(x="ViolentCrimesPerPop", y="PctUnemployed", kind="scatter", c="pink", s=2, label="PctUnemployed")
    df.plot(x="ViolentCrimesPerPop", y="PctEmploy", kind="scatter", c="green", s=2, label="PctEmploy", ax=ax)
    df.plot(x="ViolentCrimesPerPop", y="PctEmplManu", kind="scatter", c="blue", s=2, label="PctEmplManu", ax=ax)
    df.plot(x="ViolentCrimesPerPop", y="PctEmplProfServ", kind="scatter", c="black", s=2, label="PctEmplProfServ", ax=ax)
    plt.title("Violent Crimes by all Employment")
    plt.xlabel("Violent crimes per pop")
    plt.ylabel("Employment")
    plt.show()


def plot_population_bin_boxplot(df: pd.DataFrame) -> None:
    sns.boxplot(data=df, x="population_bin", y="ViolentCrimesPerPop")
    plt.show()


def plot_rent_distributions(df: pd.DataFrame) -> None:
    sns.set_style("whitegrid")
    for name in ["RentLowQ", "RentMedian", "RentHighQ"]:
        plt.figure(figsize=(15, 6))
        plt.subplot(2, 2, 1)
        plt.hist(df[name])
        plt.title(name, fontdict=TITLE_FONT)

        plt.subplot(2, 2, 2)
        plt.hist(np.log(df[name] + 1))
        plt.title(name + " (log transformation)", fontdict=TITLE_FONT)
        plt.show()


def correlation_with_target(df: pd.DataFrame) -> pd.Series:
    corr = df.corr(method="pearson", numeric_only=True).round(4)
    corr = corr.sort_values(by=["ViolentCrimesPerPop"])
    return corr["ViolentCrimesPerPop"]


def run_pca(df: pd.DataFrame, n_components: int = 14, seed: int = 0):
    """Split the 100 predictive features from the target, standardize,
    and reduce to `n_components` principal components.
    """
    X = df.iloc[:, 0:100].values
    y = df.iloc[:, 100].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.3, random_state=seed
    )

    sc = StandardScaler()
    X_train = sc.fit_transform(X_train)
    X_test = sc.transform(X_test)

    pca = PCA(n_components=n_components)
    X_train = pca.fit_transform(X_train)
    X_test = pca.transform(X_test)

    print("Amount of variance:", pca.explained_variance_)
    print("Sum of the variance:", round(sum(pca.explained_variance_), 2))
    print("Percentage of variance:", pca.explained_variance_ratio_)
    print("Sum of the percentage of variance:", round(sum(pca.explained_variance_ratio_), 2))

    plt.scatter(np.arange(1, n_components + 1), pca.explained_variance_, c="blue")
    plt.plot((0, 15), (1, 1), color="black", linestyle="dashed")
    plt.xlabel("PC")
    plt.ylabel("Amount of variance explained")
    plt.show()

    return pca, X_train, X_test, y_train, y_test


def main() -> None:
    df = load_data()
    print("Raw shape:", df.shape)

    df = clean_data(df)
    print("Shape after cleaning:", df.shape)

    df = engineer_features(df)
    print(df["highCrime"].value_counts())

    plot_age_vs_crime(df)
    plot_age12t29_crosstab(df)
    plot_race_household_vs_crime(df)
    plot_employment_vs_crime(df)
    plot_population_bin_boxplot(df)
    plot_rent_distributions(df)

    correlations = correlation_with_target(df)
    print(correlations.to_string())

    run_pca(df)


if __name__ == "__main__":
    main()
