import os
import lightgbm as lgb

BASE_DIR = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
MODEL_DIR = os.environ.get("MODEL_DIR", os.path.join(BASE_DIR, "models"))

Models = {
    "m1": {
        "type": "lightgbm",
        "model": lgb.Booster(
            model_file=os.path.join(MODEL_DIR, "m1_eta_lightgbm.txt")
        ),
    },

    "m2": {
        "type": None,
        "model": None,
    },

    "m3": {
        "type": None,
        "model": None,
    },

    "m4": {
        "type": None,
        "model": None,
    },

    "m5": {
        "type": None,
        "model": None,
    },
}