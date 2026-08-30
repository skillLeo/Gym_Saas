<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0D1117;font-family:'DM Sans',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0D1117;padding:40px 20px;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#161B22;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">

      <tr><td style="background:#F87404;padding:36px 40px;text-align:center;">
        <h1 style="color:#fff;font-size:26px;margin:0;letter-spacing:2px;">MY EXTREME TRAINER</h1>
        <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:14px;">{{ $grant->offer->discount_label }}</p>
      </td></tr>

      {{-- Admin-authored copy. Already escaped and placeholder-substituted in
           CouponOfferMail::render(), so it is emitted unescaped here on
           purpose — escaping again would print the HTML tags as text. --}}
      <tr><td style="padding:36px 40px;color:#8B949E;font-size:16px;line-height:1.6;">
        {!! $bodyHtml !!}
      </td></tr>

      <tr><td style="padding:0 40px 12px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0D1117;border:1px dashed #30363D;border-radius:8px;">
          <tr><td align="center" style="padding:22px;">
            <p style="color:#8B949E;font-size:12px;margin:0 0 8px;letter-spacing:1px;text-transform:uppercase;">Your code</p>
            <p style="color:#E6EDF3;font-size:26px;margin:0;font-family:'Courier New',monospace;letter-spacing:3px;font-weight:bold;">{{ $grant->code }}</p>
            @if ($grant->expires_at)
              <p style="color:#484F58;font-size:12px;margin:10px 0 0;">Valid until {{ $grant->expires_at->format('j F Y') }}</p>
            @endif
          </td></tr>
        </table>
      </td></tr>

      <tr><td align="center" style="padding:20px 40px 36px;">
        <a href="{{ rtrim(config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:3000')), '/') }}/membership"
           style="background:#F87404;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:bold;display:inline-block;">Choose a plan</a>
      </td></tr>

      <tr><td style="padding:20px 40px;border-top:1px solid #30363D;text-align:center;">
        <p style="color:#484F58;font-size:12px;margin:0;">&copy; {{ date('Y') }} My EXtreme Trainer.</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>
