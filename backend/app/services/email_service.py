"""
Email sending via Brevo's HTTP API (api.brevo.com). Deliberately HTTP-based
rather than SMTP — Render's free tier blocks all outbound SMTP ports
(25/465/587), so any SMTP-based sender (Gmail included) fails there
regardless of credentials. A plain HTTPS POST like this one isn't affected.

If BREVO_API_KEY isn't set, emails are logged instead of sent — this keeps
local dev working with zero setup, and makes it obvious in the logs what
would have been sent.
"""
import httpx
from loguru import logger

from app.core.config import settings

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


def _parse_from_address(raw: str) -> dict:
    # settings.BREVO_FROM_EMAIL is stored as "Name <email@domain.com>" —
    # Brevo wants name/email as separate fields.
    if "<" in raw and raw.endswith(">"):
        name, email = raw.rsplit("<", 1)
        return {"name": name.strip(), "email": email.rstrip(">").strip()}
    return {"email": raw.strip()}


async def send_email(to: str, subject: str, html: str) -> None:
    if not settings.BREVO_API_KEY:
        logger.info(f"[email skipped, no BREVO_API_KEY set] To: {to} | Subject: {subject}")
        return

    async with httpx.AsyncClient() as client:
        response = await client.post(
            BREVO_API_URL,
            headers={
                "api-key": settings.BREVO_API_KEY,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            json={
                "sender": _parse_from_address(settings.BREVO_FROM_EMAIL),
                "to": [{"email": to}],
                "subject": subject,
                "htmlContent": html,
            },
            timeout=10.0,
        )
        if response.status_code >= 400:
            logger.error(f"Brevo API error ({response.status_code}): {response.text}")


async def send_otp_email(to: str, code: str) -> None:
    await send_email(
        to=to,
        subject=f"{code} is your ScholarAI verification code",
        html=f"""
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2>Verify your email</h2>
            <p>Enter this code in ScholarAI to finish creating your account:</p>
            <div style="font-family: monospace; font-size: 32px; font-weight: bold;
                        letter-spacing: 8px; background: #F4F0FB; color: #A855F7;
                        padding: 16px 24px; border-radius: 8px; text-align: center;
                        margin: 16px 0;">
                {code}
            </div>
            <p style="color: #888; font-size: 13px;">
                This code expires in 10 minutes. If you didn't request this,
                you can safely ignore this email.
            </p>
        </div>
        """,
    )
