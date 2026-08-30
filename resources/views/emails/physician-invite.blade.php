<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F4F4F5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F5;padding:40px 20px;">
  <tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #D4D4D8;border-radius:8px;max-width:560px;width:100%;">
      <tr><td style="padding:32px 32px 24px;border-bottom:1px solid #E4E4E7;">
        <p style="color:#3F3F46;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;margin:0;">My EXtreme Trainer — Coaching Portal</p>
      </td></tr>
      <tr><td style="padding:32px;">
        <h2 style="color:#18181B;font-size:20px;margin:0 0 16px;">Coaching access approved</h2>
        <p style="color:#52525B;font-size:15px;line-height:1.6;margin:0 0 16px;">
          {{ $authorization->physician_name }} has been approved for read-only coaching access to one
          patient's fitness data through {{ $authorization->practice_name }}. This link creates the
          portal account and expires in 72 hours.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:16px 0;">
          <a href="{{ $url }}" style="background:#1D4ED8;color:#FFFFFF;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:15px;font-weight:bold;display:inline-block;">Create portal account</a>
        </td></tr></table>
        <p style="color:#71717A;font-size:13px;line-height:1.6;margin:16px 0 0;">
          This link is single-use and expires {{ $authorization->invite_expires_at?->format('F j, Y g:i A') }}.
          If it expires, contact My EXtreme Trainer to request a new one.
        </p>
      </td></tr>
      <tr><td style="padding:16px 32px;border-top:1px solid #E4E4E7;text-align:center;">
        <p style="color:#A1A1AA;font-size:11px;margin:0;">This portal shows coaching data only — workout history, nutrition adherence, and body-stat trends. It is not a clinical health record.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>
