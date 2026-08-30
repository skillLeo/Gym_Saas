<?php

namespace Database\Seeders;

use App\Models\MotivationalMessage;
use App\Models\NotificationSchedule;
use Illuminate\Database\Seeder;

/**
 * Starting message pool and schedule (§4.4).
 *
 * All of it is editable from the admin panel; these are defaults, not fixed
 * behaviour. Copy is deliberately plain — no exclamation-mark stacking, no
 * invented statistics, nothing claiming to know what the member did today,
 * because the sender has no idea who it is writing to.
 */
class MotivationalMessageSeeder extends Seeder
{
    public function run(): void
    {
        $messages = [
            ['title' => 'Small things add up',        'body' => 'One logged meal or one finished session today is worth more than a perfect week you never start.'],
            ['title' => 'Show up as you are',         'body' => 'Training tired counts. Training sore counts. The only session that does not count is the one you talk yourself out of.'],
            ['title' => 'Progress is not a straight line', 'body' => 'Weight fluctuates, strength stalls, motivation dips. None of that is failure. Staying in it is the whole skill.'],
            ['title' => 'Log it while it is fresh',   'body' => 'Your food journal is most useful when it is honest and immediate. Two minutes now beats guessing tonight.'],
            ['title' => 'Rest is part of the plan',   'body' => 'Recovery is when the work you did becomes the strength you keep. A planned rest day is training.'],
            ['title' => 'Compare to last month',      'body' => 'Not to yesterday, and not to anyone else. Open your progress charts and look at where you were four weeks ago.'],
            ['title' => 'Drink some water',           'body' => 'It is the least glamorous habit on here and one of the few that changes how you feel the same day.'],
            ['title' => 'Plan tomorrow tonight',      'body' => 'Deciding what you will eat and when you will train, before the day starts, removes the decision you usually lose.'],
            ['title' => 'Consistency beats intensity', 'body' => 'Four steady sessions a week for a year will take you further than two brutal ones you cannot sustain past February.'],
            ['title' => 'You are allowed to start over', 'body' => 'A missed week is a missed week. It is not a verdict. Open the app, log one thing, carry on.'],
        ];

        foreach ($messages as $message) {
            MotivationalMessage::firstOrCreate(
                ['body' => $message['body']],
                $message + ['is_active' => true],
            );
        }

        // Monday, Wednesday, Friday at 9am. ISO day numbers (1 = Monday).
        NotificationSchedule::firstOrCreate(
            ['name' => 'Weekday mornings'],
            [
                'days_of_week' => [1, 3, 5],
                'send_time'    => '09:00:00',
                'timezone'     => 'UTC',
                'is_active'    => true,
            ],
        );
    }
}
