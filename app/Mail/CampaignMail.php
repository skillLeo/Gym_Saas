<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Generic wrapper for admin-authored bulk campaigns (§E1). The admin supplies
 * raw HTML directly (same trust level as the rest of the admin panel — no
 * further templating layer needed for a one-off announcement).
 */
class CampaignMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public string $emailSubject, public string $bodyHtml) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->emailSubject);
    }

    public function content(): Content
    {
        return new Content(htmlString: $this->bodyHtml);
    }
}
