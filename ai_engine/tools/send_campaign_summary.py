"""
MCP tool: send_campaign_summary.

Sends a campaign summary email via Gmail SMTP using an App Password.
Used by the Report Generator skill at workflow step 10 to notify the
team when a campaign report is finalized.

Requires two environment variables:
    GMAIL_USER           The sender Gmail address
    GMAIL_APP_PASSWORD   A 16-character App Password generated from
                         Google Account > Security > 2-Step Verification > App Passwords

CLI:
    python -m tools.send_campaign_summary \\
        --to merna@example.com \\
        --campaign "Mother's Day Beauty Event" \\
        --subject "Campaign Complete" \\
        --body "Executive summary text here"
"""

from __future__ import annotations

import argparse
import os
import smtplib
import sys
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any


def send_campaign_summary(
    recipients: list[str],
    campaign_name: str,
    subject: str,
    summary_body: str,
) -> dict[str, Any]:
    """Send a campaign summary email via Gmail SMTP.

    Args:
        recipients: list of email addresses to send to.
        campaign_name: campaign name for logging and message metadata.
        subject: email subject line.
        summary_body: plain text body of the email.

    Returns:
        Dict with status ('sent' or 'error'), recipients_count, and
        message_id or error string.
    """
    gmail_user = os.environ.get("GMAIL_USER")
    gmail_password = os.environ.get("GMAIL_APP_PASSWORD")

    if not gmail_user or not gmail_password:
        return {
            "status": "error",
            "recipients_count": 0,
            "message_id": None,
            "error": (
                "Gmail credentials not configured. Set GMAIL_USER and "
                "GMAIL_APP_PASSWORD environment variables."
            ),
        }

    if not recipients:
        return {
            "status": "error",
            "recipients_count": 0,
            "message_id": None,
            "error": "No recipients specified.",
        }

    msg = MIMEMultipart()
    msg["From"] = gmail_user
    msg["To"] = ", ".join(recipients)
    msg["Subject"] = subject
    msg["X-Campaign-Name"] = campaign_name

    # Build a clean email body with campaign header
    body = (
        f"Campaign: {campaign_name}\n"
        f"{'=' * 50}\n\n"
        f"{summary_body}\n\n"
        f"{'=' * 50}\n"
        f"Sent by Macy's AI Coworker (MGT 449)\n"
    )
    msg.attach(MIMEText(body, "plain", "utf-8"))

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(gmail_user, gmail_password)
            server.send_message(msg)
        return {
            "status": "sent",
            "recipients_count": len(recipients),
            "message_id": "smtp-success",
            "error": None,
        }
    except smtplib.SMTPAuthenticationError:
        return {
            "status": "error",
            "recipients_count": 0,
            "message_id": None,
            "error": (
                "Gmail authentication failed. Check GMAIL_USER and "
                "GMAIL_APP_PASSWORD. Make sure you are using an App Password, "
                "not your regular Google password."
            ),
        }
    except Exception as exc:
        return {
            "status": "error",
            "recipients_count": 0,
            "message_id": None,
            "error": str(exc),
        }


def _cli(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Send a campaign summary email.")
    parser.add_argument("--to", nargs="+", required=True, help="Recipient email addresses")
    parser.add_argument("--campaign", required=True, help="Campaign name")
    parser.add_argument("--subject", required=True, help="Email subject")
    parser.add_argument("--body", required=True, help="Email body text")
    args = parser.parse_args(argv)
    result = send_campaign_summary(args.to, args.campaign, args.subject, args.body)
    print(f"status: {result['status']}")
    if result["error"]:
        print(f"error: {result['error']}")
    else:
        print(f"sent to {result['recipients_count']} recipient(s)")
    return 0 if result["status"] == "sent" else 1


if __name__ == "__main__":
    raise SystemExit(_cli(sys.argv[1:]))
