"""Server-side verification for Google Identity Services ID tokens."""

import json
import os

import jwt
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientConnectionError, PyJWTError

GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
_jwks_client = PyJWKClient(GOOGLE_JWKS_URL, cache_keys=True, timeout=10)


class GoogleAuthConfigurationError(RuntimeError):
    """Google sign-in has not been configured for this backend."""


class GoogleVerificationUnavailable(RuntimeError):
    """Google's signing keys could not be reached for token verification."""


class InvalidGoogleCredential(ValueError):
    """Google rejected the supplied ID token or its verified claims."""


def verify_google_id_token(credential: str) -> dict:
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    if not client_id:
        raise GoogleAuthConfigurationError("GOOGLE_CLIENT_ID is not configured")

    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(credential)
        claims = jwt.decode(
            credential,
            signing_key.key,
            algorithms=["RS256"],
            audience=client_id,
            issuer=["accounts.google.com", "https://accounts.google.com"],
            options={
                "require": ["exp", "iat", "sub", "aud", "iss", "email", "email_verified"],
            },
        )
    except PyJWKClientConnectionError as exc:
        raise GoogleVerificationUnavailable("Could not reach Google's token keys") from exc
    except (PyJWTError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise InvalidGoogleCredential("Google ID token is invalid") from exc

    if not isinstance(claims.get("sub"), str) or not claims["sub"].strip():
        raise InvalidGoogleCredential("Google ID token has no subject")
    if not isinstance(claims.get("email"), str) or not claims["email"].strip():
        raise InvalidGoogleCredential("Google ID token has no email")
    if claims.get("email_verified") is not True:
        raise InvalidGoogleCredential("Google email is not verified")
    return claims
