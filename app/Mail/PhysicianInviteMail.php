<?php

namespace App\Mail;

use App\Models\CoachingAuthorization;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Sent synchronously from CoachingAdminController::approve() — not queued.
 * No queue worker runs in this environment (§4.0); queuing this would mean an
 * admin clicks "Approve" and the invite silently never goes out.
 */
class PhysicianInviteMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public CoachingAuthorization $authorization,
        public string $rawToken,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Coaching portal access — My EXtreme Trainer');
    }

    public function content(): Content
    {
        $url = rtrim(config('app.frontend_url', 'http://localhost:3000'), '/')
            . '/coaching/invite/' . $this->rawToken;

        return new Content(view: 'emails.physician-invite', with: [
            'authorization' => $this->authorization,
            'url'           => $url,
        ]);
    }
}
