from datetime import timedelta

from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from .models import User


def issue_tokens(user, *, otp_verified=False):
    refresh = RefreshToken.for_user(user)
    refresh["role"] = user.role
    refresh["otp"] = bool(otp_verified)
    if user.role == User.Role.KIOSK:
        refresh["mode"] = "guest"
    return {"refresh": str(refresh), "access": str(refresh.access_token)}


def reception_token(user, minutes):
    """Short-lived, non-refreshable access token for reception mode."""
    token = AccessToken.for_user(user)
    token["role"] = user.role
    token["otp"] = False
    token["mode"] = "reception"
    token.set_exp(lifetime=timedelta(minutes=minutes))
    return str(token)
