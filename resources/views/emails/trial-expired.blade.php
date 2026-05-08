<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0D1117;font-family:'DM Sans',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0D1117;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#161B22;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
      <tr><td style="background:#E63946;padding:40px;text-align:center;">
        <h1 style="color:#fff;font-size:28px;margin:0;letter-spacing:2px;">MY EXTREME TRAINER</h1>
        <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Trial Ended</p>
      </td></tr>
      <tr><td style="padding:40px;">
        <h2 style="color:#E6EDF3;font-size:22px;margin:0 0 16px;">{{ $user->name }}, your trial has ended.</h2>
        <p style="color:#8B949E;font-size:16px;line-height:1.6;margin:0 0 20px;">Your free trial period has ended but your data is safe. Upgrade within 90 days to keep all your progress, food logs, and fitness history.</p>
        <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px 0;">
          <a href="{{ env('FRONTEND_URL', 'http://localhost:3000') }}/membership" style="background:#1E6FD9;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:bold;display:inline-block;">Reactivate My Account →</a>
        </td></tr></table>
      </td></tr>
      <tr><td style="padding:20px 40px;border-top:1px solid #30363D;text-align:center;">
        <p style="color:#484F58;font-size:12px;margin:0;">© {{ date('Y') }} My EXtreme Trainer. All rights reserved.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>
