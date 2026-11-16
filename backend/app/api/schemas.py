from typing import Literal
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


class CleanInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')


class WorkerInput(CleanInput):
    name: str = Field(min_length=2, max_length=160)


class LoginInput(BaseModel):
    username: str = Field(min_length=1, max_length=60)
    password: str = Field(min_length=1, max_length=200)


class StoreInput(CleanInput):
    code: str = Field(pattern=r'^[A-Za-z0-9_-]{1,30}$')
    name: str = Field(min_length=1, max_length=160)
    active: bool = True


class ToteInput(CleanInput):
    code: str = Field(pattern=r'^HDC-?[0-9]+$', max_length=100)


class DeleteInput(BaseModel):
    confirmation: str = Field(min_length=1, max_length=150)


class TransitionInput(CleanInput):
    action: Literal['DISPATCH', 'RETURN', 'RESET']
    expected_version: int = Field(ge=0)
    request_id: UUID
    store_code: str | None = Field(default=None, max_length=30)
    truck_registration: str | None = Field(default=None, min_length=1, max_length=40)
    note: str = Field(default='', max_length=500)
