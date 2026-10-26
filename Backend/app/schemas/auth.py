from pydantic import BaseModel, EmailStr, Field, field_validator

MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128


def normalise_email(value: str) -> str:
    """Lowercased and trimmed: the form used as the unique key."""
    return value.strip().lower()


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=MAX_PASSWORD_LENGTH)

    @field_validator("email")
    @classmethod
    def _normalise(cls, value: str) -> str:
        return normalise_email(str(value))


class LoginRequest(BaseModel):
    """Deliberately loose: every login failure must be the same 401, never a 422."""

    email: str
    password: str = Field(max_length=MAX_PASSWORD_LENGTH)


class RegisterResponse(BaseModel):
    email: str
    verification_required: bool = True
    message: str = "We've sent a 6-digit code to your email."


class VerifyRequest(BaseModel):
    email: str
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class ResendRequest(BaseModel):
    email: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = Field(description="Access token lifetime in seconds")
    user_id: str
    email: str


class UserResponse(BaseModel):
    user_id: str
    email: str
