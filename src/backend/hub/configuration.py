from enum import Enum
from typing import List, Optional

from configurations import values
from pydantic import BaseModel, Field, TypeAdapter, model_validator

from core.configuration.values import SecretJsonFileValue


class MessagingBackendKind(Enum):
    """Enumeration of messaging backend kinds."""

    MATRIX = "matrix"
    # Add other backend kinds here as needed


# messaging_backends.matrix backend specific
class MatrixHomeserverConfig(BaseModel):
    """Configuration of a Matrix homeserver for Matrix backend."""

    hrid: str = Field(..., description="Human-readable identifier for the homeserver.")
    url: str = Field(..., description="The URL of the Matrix homeserver.")
    access_token: str = Field(..., description="Access token for the bot user.")
    as_bot_localpart: str = Field(..., description="Local part of the AS bot user.")
    bot_localpart: str = Field(..., description="Local part of the bot user.")
    server_name: str = Field(..., description="Name of the Matrix homeserver.")

    # Optional fields for additional configuration
    timeout: int = Field(10, description="Timeout for API requests in seconds.")
    sync_timeout: int = Field(30, description="Timeout for sync requests in seconds.")
    control_room_alias_localpart: str = Field(
        "_hub_control", description="Local part of the Hub control room alias."
    )

    @property
    def control_room_alias(self) -> str:
        """Return the one reserved control-room alias for a homeserver."""
        return f"#{self.control_room_alias_localpart}:{self.server_name}"

    @property
    def as_bot_mxid(self) -> str:
        """Return the Matrix ID of the AS bot user."""
        return f"@{self.as_bot_localpart}:{self.server_name}"

    @property
    def bot_mxid(self) -> str:
        """Return the Matrix ID of the bot user."""
        return f"@{self.bot_localpart}:{self.server_name}"


# global messaging backend configuration
class MessagingBackendConfig(BaseModel):
    """Configuration for a messaging backend."""

    hrid: str = Field(..., description="Human-readable identifier for the homeserver.")
    kind: MessagingBackendKind = Field(..., description="The kind of the messaging backend.")

    mx_homeserver: Optional[List[MatrixHomeserverConfig]] = Field(
        None, description="List of Matrix homeserver configurations."
    )

    @model_validator(mode="after")
    def validate_kind_specific_config(self) -> "MessagingBackendConfig":
        """Enforce required config depending on messaging backend kind."""
        if self.kind == MessagingBackendKind.MATRIX and not self.mx_homeserver:
            raise ValueError("mx_homeserver must contain at least one element for MATRIX")
        return self


class MessagingBackendConfigFileValue(SecretJsonFileValue):
    """Class to read configuration values as JSON from a file or the environment."""

    caster = TypeAdapter(List[MessagingBackendConfig]).validate_json
