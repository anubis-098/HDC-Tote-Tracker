from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_database_url: str = ''
    image_database_url: str = ''
    app_db_password: str = ''
    image_db_password: str = ''
    cookie_secure: bool = False


@lru_cache
def settings():
    return Settings()
