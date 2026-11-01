# app/schemas/threshold.py
from pydantic import BaseModel, Field, field_validator, model_validator
from app.domain.enums import Complication


class ThresholdItem(BaseModel):
    type: Complication
    yellow: float = Field(ge=0, le=100)
    red: float = Field(ge=0, le=100)

    @model_validator(mode="after")
    def check_order(self):
        if self.yellow >= self.red:
            raise ValueError("Жёлтый порог должен быть меньше красного")
        return self


class ThresholdsIn(BaseModel):
    items: list[ThresholdItem] = Field(min_length=1, max_length=3)

    @field_validator("items")
    @classmethod
    def unique_types(cls, v):
        if len({i.type for i in v}) != len(v):
            raise ValueError("Типы осложнений не должны повторяться")
        return v