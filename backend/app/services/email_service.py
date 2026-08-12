"""
Email sending via Resend (resend.com). Uses their plain HTTP API directly —
no SDK dependency needed, it's a single POST request.

If RESEND_API_KEY isn't set, emails are logged instead of sent — this keeps
local dev working with zero setup, and makes it obvious in the logs what
would have been sent.
"""
import httpx
from loguru import logger

from app.core.config import settings

RESEND_API_URL = "https://api.resend.com/emails"


async def send_email(to: str, subject: str, html: str) -> None:
    if not settings.RESEND_API_KEY:
        logger.info(f"[email skipped, no RESEND_API_KEY set] To: {to} | Subject: {subject}")
        return

    async with httpx.AsyncClient() as client:
        response = await client.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            json={
                "from": settings.RESEND_FROM_EMAIL,
                "to": [to],
                "subject": subject,
                "html": html,
            },
            timeout=10.0,
        )
        if response.status_code >= 400:
            logger.error(f"Resend API error ({response.status_code}): {response.text}")


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
