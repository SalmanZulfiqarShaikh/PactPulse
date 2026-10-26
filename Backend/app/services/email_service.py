"""Sending email over SMTP (a Gmail app password works).

If SMTP is not configured the message is logged instead of sent, so sign-up
can be tested locally without an email account.
"""

import logging
from email.message import EmailMessage

import aiosmtplib

from Backend.app.core.config import settings
from Backend.app.core.errors import ServiceUnavailableError

logger = logging.getLogger(__name__)


def _verification_email(to: str, code: str, minutes: int) -> EmailMessage:
    message = EmailMessage()
    message["From"] = f"{settings.email.from_name} <{settings.email.user}>"
    message["To"] = to
    message["Subject"] = f"{code} is your Pact Pulse code"
    message.set_content(
        f"Your Pact Pulse verification code is {code}\n\n"
        f"It expires in {minutes} minutes. If you didn't try to sign up, ignore this email."
    )
    message.add_alternative(
        f"""\
<div style="font-family:Arial,sans-serif;color:#1B2A38;max-width:420px">
  <p style="font-size:15px">Your Pact Pulse verification code is</p>
  <p style="font-size:32px;font-weight:bold;letter-spacing:6px;margin:12px 0">{code}</p>
  <p style="font-size:13px;color:#5b6773">It expires in {minutes} minutes.
  If you didn't try to sign up, ignore this email.</p>
</div>""",
        subtype="html",
    )
    return message


async def send_verification_code(to: str, code: str) -> None:
    minutes = settings.limits.code_minutes
    cfg = settings.email
    if not cfg.enabled:
        logger.warning("SMTP is not configured. Verification code for %s: %s", to, code)
        return
    try:
        await aiosmtplib.send(
            _verification_email(to, code, minutes),
            hostname=cfg.host,
            port=cfg.port,
            username=cfg.user,
            password=cfg.password,
            start_tls=True,
            timeout=20,
        )
    except aiosmtplib.SMTPException as exc:
        logger.exception("Could not send the verification email to %s.", to)
        raise ServiceUnavailableError(
            "We couldn't send the verification email right now. Try again in a minute."
        ) from exc
