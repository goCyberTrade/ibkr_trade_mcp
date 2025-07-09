import os
from typing import Optional

def get_env_var(key: str, default: Optional[str] = None) -> str:
    value = os.getenv(key)
    if value is None:
        if default is None:
            raise ValueError(f"Environment variable {key} is not set")
        return default
    return value