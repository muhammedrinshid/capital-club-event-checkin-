from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class LoginThrottle(AnonRateThrottle):
    scope = "login"


class OTPThrottle(AnonRateThrottle):
    scope = "otp"


class UnlockThrottle(UserRateThrottle):
    scope = "unlock"
