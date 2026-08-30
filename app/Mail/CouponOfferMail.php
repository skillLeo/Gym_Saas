<?php
namespace App\Mail;

use App\Models\CouponGrant;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Sends a granted conversion offer.
 *
 * Subject and body come from the `coupon_offers` row so the client can edit
 * both without a deploy. Placeholders are substituted here rather than in the
 * template, because the body is admin-supplied HTML rather than a Blade file.
 */
class CouponOfferMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public CouponGrant $grant) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->substitute($this->grant->offer->email_subject)
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.coupon-offer',
            with: [
                'bodyHtml' => $this->substitute($this->grant->offer->email_body_html),
                'grant'    => $this->grant,
            ],
        );
    }

    /**
     * Substitute the placeholders available to admin-written copy.
     *
     * Values are escaped: the copy is written by an admin, but the name comes
     * from the user and must not be able to inject markup into an email.
     *
     * Named `substitute`, not `render` — Mailable already declares a public
     * render() and PHP will not allow a subclass to narrow its visibility.
     */
    private function substitute(string $template): string
    {
        $user    = $this->grant->user;
        $appUrl  = rtrim((string) config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:3000')), '/');

        $replacements = [
            '{{name}}'     => e($user->name),
            '{{code}}'     => e($this->grant->code),
            '{{expires}}'  => e(optional($this->grant->expires_at)->format('j F Y') ?? ''),
            '{{discount}}' => e($this->grant->offer->discount_label),
            '{{url}}'      => $appUrl . '/membership',
        ];

        return strtr($template, $replacements);
    }
}
