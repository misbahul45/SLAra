ai/
├── app/
│
├── core/
│   ├── config.py
│   ├── logging.py
│   └── settings.py
│
├── api/
│   ├── router.py
│   ├── dependencies.py
│   └── endpoints/
│       ├── health.py
│       ├── prediction.py
│       ├── optimization.py
│       └── training.py
│
├── modules/
│
│   ├── eta/
│   │   ├── service.py
│   │   ├── model.py
│   │   ├── inference.py
│   │   ├── training.py
│   │   └── schemas.py
│   │
│   ├── delay/
│   │
│   ├── carbon/
│   │
│   ├── optimization/
│   │
│   └── hub_risk/
│
├── ml/
│   ├── datasets/
│   ├── preprocessing/
│   ├── feature_engineering/
│   ├── pipelines/
│   ├── metrics/
│   ├── models/
│   ├── trainers/
│   ├── inference/
│   └── evaluation/
│
├── integrations/
│   ├── kafka/
│   ├── redis/
│   ├── mongodb/
│   └── data_service/
│
├── utils/
├── tests/
├── main.py
└── pyproject.toml