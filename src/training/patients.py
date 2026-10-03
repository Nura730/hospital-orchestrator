"""Models 3 & 4 — Patient length of stay (regression) and ICU need (binary)."""
from .common import add_calendar, group_stat, load, run_model

DATES = ["arrival_time", "admission_time", "discharge_time"]


def build_features(patients):
    df = patients.copy()
    add_calendar(df, "arrival_time", prefix="arrival_")
    df["admit_delay_hours"] = (df["admission_time"] - df["arrival_time"]).dt.total_seconds() / 3600
    return df


LOS_CATS = ["gender", "department", "priority", "required_bed_type", "diagnostic_type"]
LOS_FEATS = ["age", "acuity_level", "requires_icu", "requires_ot", "requires_diagnostic",
             "admit_delay_hours", "arrival_hour", "arrival_day_of_week", "arrival_is_weekend"] + LOS_CATS

# department / required_bed_type reveal ICU placement -> excluded for the ICU classifier.
ICU_CATS = ["gender", "priority", "diagnostic_type"]
ICU_FEATS = ["age", "acuity_level", "requires_ot", "requires_diagnostic",
             "arrival_hour", "arrival_day_of_week", "arrival_is_weekend"] + ICU_CATS


def train():
    df = build_features(load("patients", DATES))
    los = run_model(
        name="length_of_stay", df=df, features=LOS_FEATS, cats=LOS_CATS,
        target="length_of_stay_hours", time_col="arrival_time", target_transform="log1p",
        baselines={"Median LOS per department": group_stat(["department"], "length_of_stay_hours")},
        description="Predict inpatient length of stay (hours) at admission",
    )
    icu = run_model(
        name="icu_need", df=df, features=ICU_FEATS, cats=ICU_CATS,
        target="requires_icu", time_col="arrival_time", task="binary",
        baselines={"ICU rate per acuity level": group_stat(["acuity_level"], "requires_icu", "mean")},
        description="Classify whether an arriving patient will need an ICU bed",
    )
    return [los, icu]
