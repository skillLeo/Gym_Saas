# TLS certificate for test.myextremetrainer.com

Covers **both** `test.myextremetrainer.com` and `www.test.myextremetrainer.com`
in one SAN certificate. Both names must stay on it: the docroot `.htaccess`
redirects http to https for whatever host was requested, so a name the
certificate does not cover gets redirected straight into a TLS handshake
failure — worse than not redirecting at all.

**The certificate expires 1 December 2026 and does NOT renew itself.**
Renew it before then or the site starts throwing browser security warnings.

## Why this exists

The cPanel account has no `autossl` feature — the API answers *"You do not have
the feature autossl"* — and there is no Let's Encrypt plugin, so cPanel will not
issue or renew anything on its own. The account also has **no shell**
(`noshell`), so a normal ACME client cannot be installed and run on the server.

`acme.ps1` is a minimal ACME v2 (RFC 8555) client that runs **on your machine**
and does HTTP-01 validation, placing the challenge file on the server over SFTP.
openssl does the crypto (it ships with Git for Windows); PowerShell does HTTP
and JSON. Nothing is downloaded at runtime.

## Renewing

1. You need SFTP access on port **21098** with a key authorised for the
   `myextremetrainer` cPanel user, and the cPanel login for the install step.
2. Run `acme.ps1` with `-Domains @('test.myextremetrainer.com',
   'www.test.myextremetrainer.com')` and a `-PublishChallenge` script block
   (`param($token, $keyAuth, $name)`) that uploads the key authorization to
   `/home/myextremetrainer/test.myextremetrainer.com/.well-known/acme-challenge/<token>`
   and then confirms it is readable over plain HTTP before returning. Verifying
   there turns an opaque CA-side "invalid" into an obvious local failure. Both
   names share one docroot, since www is a ServerAlias of the same vhost.
3. Point `-Directory` at the **staging** endpoint first
   (`https://acme-staging-v02.api.letsencrypt.org/directory`). Failed
   validations count against a limit of 5 per hostname per hour, and burning it
   locks you out exactly when you are trying to fix something.
4. Split the returned `fullchain.pem`: the first certificate block is the leaf,
   the rest are the CA bundle. Install with cPanel UAPI `SSL/install_ssl`
   (`domain`, `cert`, `key`, `cabundle`).
5. Confirm with `curl` **without** `-k`. Exit code 0 means the chain actually
   validates against the system trust store; `-k` would hide a broken install.

## Things that will bite you

- **Passenger owns the docroot.** `/.well-known/` has its own `.htaccess` with
  `PassengerEnabled off`, otherwise the Next.js app answers the challenge URL
  with its 404 page and issuance fails for no visible reason. Do not delete it.
- **The HTTPS redirect excludes `/.well-known/acme-challenge/`** on purpose.
  Validation happens over HTTP; redirecting it breaks renewal precisely when the
  certificate has expired.
- **`Invoke-WebRequest.Content` returns a byte array** for the certificate's
  content type. Writing it straight to a file produces a text file full of
  decimal numbers rather than PEM. Decode it as UTF-8 first.
- **PowerShell 5.1 reads these scripts as ANSI.** Keep them ASCII-only; a stray
  em dash inside a string literal is a parse error.
- **Publish every challenge before triggering any of them.** With more than one
  name, triggering as you go lets the CA validate the first while the second is
  still unserved.
- Verify with `curl` **without** `-k`, once per hostname. `-k` would hide
  exactly the kind of missing-SAN problem this certificate exists to fix.
