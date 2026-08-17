"""
Email sending via Gmail SMTP.

Uses Python's built-in smtplib (no extra dependency) wrapped in a thread
since smtplib is synchronous. Requires a Gmail *App Password* (Google
Account -> Security -> App Passwords) — the regular account password will
not work once 2-Step Verification is enabled, which App Passwords require.

If GMAIL_ADDRESS / GMAIL_APP_PASSWORD aren't set, emails are logged instead
of sent — this keeps local dev working with zero setup, and makes it
obvious in the logs what would have been sent.
"""
import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from loguru import logger

from app.core.config import settings

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587


def _send_sync(to: str, subject: str, html: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.GMAIL_FROM_NAME} <{settings.GMAIL_ADDRESS}>"
    msg["To"] = to
    msg.attach(MIMEText(html, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
        server.starttls()
        server.login(settings.GMAIL_ADDRESS, settings.GMAIL_APP_PASSWORD)
        server.sendmail(settings.GMAIL_ADDRESS, [to], msg.as_string())


async def send_email(to: str, subject: str, html: str) -> None:
    if not settings.GMAIL_ADDRESS or not settings.GMAIL_APP_PASSWORD:
        logger.info(f"[email skipped, Gmail SMTP not configured] To: {to} | Subject: {subject}")
        return

    try:
        # smtplib is blocking — run it off the event loop so it doesn't
        # stall other requests while the SMTP handshake happens.
        await asyncio.to_thread(_send_sync, to, subject, html)
    except smtplib.SMTPAuthenticationError:
        logger.error(
            "Gmail SMTP authentication failed — check GMAIL_ADDRESS and GMAIL_APP_PASSWORD "
            "(must be an App Password, not the regular account password)."
        )
    except Exception as exc:  # noqa: BLE001 — log and continue, never crash the request over email
        logger.error(f"Gmail SMTP send failed: {exc}")


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
