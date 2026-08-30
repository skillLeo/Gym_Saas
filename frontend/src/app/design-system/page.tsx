'use client';

/**
 * DESIGN SYSTEM REFERENCE — every primitive in every state.
 *
 * This is the verification surface for the Stage 3 consistency audit: if two
 * pages solve the same UI problem differently, the difference shows up here
 * rather than being eyeballed across 64 routes.
 *
 * Not linked from any navigation. Excluded from the sitemap via `robots`.
 */

import { useState } from 'react';
import { Bell, Dumbbell, Plus, Search, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardEyebrow } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Icon, ICON_NAMES } from '@/components/ui/Icon';
import { Field, Input, NumericField, Textarea } from '@/components/ui/Field';
import { Select, SegmentedControl, Switch, Chip, Tabs } from '@/components/ui/Controls';
import { Sheet } from '@/components/ui/Sheet';
import { ListRow, ListGroup, SwipeableRow } from '@/components/ui/ListRow';
import { StatTile } from '@/components/ui/StatTile';
import { EmptyState, ErrorState, Alert } from '@/components/ui/States';
import {
  Skeleton, SkeletonText, SkeletonCard, SkeletonRow, SkeletonChart, SkeletonStatTile,
} from '@/components/ui/Skeleton';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { RingChart } from '@/components/ui/RingChart';
import { MacroBar } from '@/components/ui/MacroBar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { PageHeader, HeaderAction } from '@/components/ui/PageHeader';

const SECTIONS = ['social', 'fitness', 'food', 'calendar', 'coaching'] as const;

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-overline font-semibold uppercase text-content-tertiary">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  );
}

export default function DesignSystemPage() {
  const [section, setSection] = useState<string>('social');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [num, setNum] = useState('12');
  const [text, setText] = useState('');
  const [sel, setSel] = useState<string>('');
  const [seg, setSeg] = useState('week');
  const [tab, setTab] = useState('overview');
  const [sw, setSw] = useState(true);
  const [chip, setChip] = useState('all');

  return (
    <div data-section={section} className="min-h-screen bg-surface-base">
      <PageHeader
        title="Design System"
        subtitle="Every primitive, every state"
        actions={
          <>
            <HeaderAction label="Notifications" badge={3}>
              <Bell size={20} strokeWidth={1.75} />
            </HeaderAction>
            <ThemeToggle />
          </>
        }
      />

      <div className="px-4 py-6 flex flex-col gap-10 max-w-3xl mx-auto pb-24">
        {/* ── Section accent switcher ── */}
        <Row title="Section accent (surfaces stay neutral)">
          {SECTIONS.map((s) => (
            <Chip key={s} active={section === s} onClick={() => setSection(s)}>
              {s}
            </Chip>
          ))}
        </Row>

        {/* ── Type scale ── */}
        <section className="flex flex-col gap-2">
          <h2 className="text-overline font-semibold uppercase text-content-tertiary">
            Type scale
          </h2>
          <p className="text-display font-display text-content-primary">Display 32</p>
          <p className="text-h1 font-display text-content-primary">Heading 1 — 26</p>
          <p className="text-h2 font-display text-content-primary">Heading 2 — 20</p>
          <p className="text-h3 font-semibold text-content-primary">Heading 3 — 17</p>
          <p className="text-body-lg text-content-primary">Body large — 16</p>
          <p className="text-body text-content-primary">Body — 15, the default UI size</p>
          <p className="text-body-sm text-content-secondary">Body small — 13, secondary</p>
          <p className="text-caption text-content-tertiary">Caption — 12, meta and timestamps</p>
          <p className="text-overline font-semibold uppercase text-content-tertiary">
            Overline — 11
          </p>
        </section>

        {/* ── Buttons ── */}
        <Row title="Buttons — variants">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="warning">Warning</Button>
        </Row>
        <Row title="Buttons — sizes, states, icons">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
          <Button icon={<Plus size={16} strokeWidth={2} />}>With icon</Button>
        </Row>

        {/* ── Badges ── */}
        <Row title="Badges — semantic variants pair color with an icon">
          <Badge variant="success">Active</Badge>
          <Badge variant="warning">Trial</Badge>
          <Badge variant="error">Expired</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="neutral">Neutral</Badge>
          <Badge variant="orange" icon={false}>
            Category
          </Badge>
        </Row>

        {/* ── Avatars ── */}
        <Row title="Avatars">
          <Avatar name="Kelvin Silas" size="xs" />
          <Avatar name="Kelvin Silas" size="sm" />
          <Avatar name="Kelvin Silas" size="md" online />
          <Avatar name="Kelvin Silas" size="lg" />
          <Avatar name="Kelvin Silas" size="xl" />
        </Row>

        {/* ── Form controls ── */}
        <section className="flex flex-col gap-4">
          <h2 className="text-overline font-semibold uppercase text-content-tertiary">
            Form controls
          </h2>
          <Input label="Text input" placeholder="you@example.com" hint="With a hint" />
          <Input label="With error" defaultValue="not-an-email" error="Enter a valid email address." />
          <Input label="Disabled" placeholder="Disabled" disabled />
          <NumericField
            label="Numeric field"
            value={num}
            onValueChange={setNum}
            min={0}
            max={1440}
            suffix="min"
            hint="Try typing a minus sign — it is blocked at the keystroke."
          />
          <NumericField
            label="Integer only, with error"
            value="8"
            onValueChange={() => {}}
            allowDecimal={false}
            error="Sets must be between 1 and 20."
          />
          <Textarea label="Textarea" placeholder="Say something" value={text} onChange={(e) => setText(e.target.value)} />
          <Select
            label="Select (sheet on mobile, native on desktop)"
            value={sel}
            onChange={setSel}
            options={[
              { value: 'breakfast', label: 'Breakfast' },
              { value: 'lunch', label: 'Lunch' },
              { value: 'dinner', label: 'Dinner', description: 'Evening meal' },
            ]}
          />
          <Field label="Segmented control">
            <SegmentedControl
              value={seg}
              onChange={setSeg}
              options={[
                { value: 'day', label: 'Day' },
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
              ]}
            />
          </Field>
          <Switch checked={sw} onChange={setSw} label="Push notifications" description="Daily reminders and streak alerts" />
          <Switch checked={false} onChange={() => {}} label="Disabled toggle" disabled />
        </section>

        {/* ── Tabs & chips ── */}
        <section className="flex flex-col gap-3">
          <h2 className="text-overline font-semibold uppercase text-content-tertiary">
            Tabs and chips
          </h2>
          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              { value: 'overview', label: 'Overview' },
              { value: 'history', label: 'History' },
              { value: 'stats', label: 'Stats' },
            ]}
          />
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {['all', 'breakfast', 'lunch', 'dinner', 'snacks'].map((c) => (
              <Chip key={c} active={chip === c} onClick={() => setChip(c)}>
                {c}
              </Chip>
            ))}
          </div>
        </section>

        {/* ── Cards & stat tiles ── */}
        <section className="flex flex-col gap-3">
          <h2 className="text-overline font-semibold uppercase text-content-tertiary">
            Cards and stat tiles
          </h2>
          <Card>
            <CardHeader>
              <div>
                <CardEyebrow>Today</CardEyebrow>
                <CardTitle>Flat surface, hairline border</CardTitle>
              </div>
              <Badge variant="success">On track</Badge>
            </CardHeader>
            <p className="text-body-sm text-content-secondary">
              No drop shadow. Elevation is reserved for things that genuinely float.
            </p>
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Calories" value="1,840" unit="kcal" delta={12} deltaLabel="vs avg" />
            <StatTile label="Weight" value="184.2" unit="lbs" delta={-1.4} deltaLabel="this week" lowerIsBetter />
            <StatTile label="Workouts" value="4" delta={0} deltaLabel="same" icon={<Dumbbell size={16} strokeWidth={1.75} />} />
            <StatTile label="Streak" value="12" unit="days" />
          </div>
        </section>

        {/* ── Progress ── */}
        <section className="flex flex-col gap-4">
          <h2 className="text-overline font-semibold uppercase text-content-tertiary">Progress</h2>
          <ProgressBar value={62} max={100} label="Daily calories" showLabel />
          <div className="flex items-center gap-6">
            <RingChart value={62} max={100} label="62%" sublabel="of goal" />
            <div className="flex-1 flex flex-col gap-3">
              <MacroBar label="Protein" current={98} goal={140} color="var(--cat-2)" />
              <MacroBar label="Carbs" current={180} goal={220} color="var(--cat-1)" />
              <MacroBar label="Fat" current={44} goal={60} color="var(--cat-3)" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LoadingSpinner size="sm" />
            <LoadingSpinner size="md" />
            <LoadingSpinner size="lg" />
          </div>
        </section>

        {/* ── Lists ── */}
        <section className="flex flex-col gap-3">
          <h2 className="text-overline font-semibold uppercase text-content-tertiary">Lists</h2>
          <ListGroup title="Today's meals">
            <ListRow leading={<Icon name="egg-fried" size="md" className="text-content-tertiary" />} title="Scrambled eggs" subtitle="2 servings" value="320 kcal" onClick={() => {}} />
            <ListRow leading={<Icon name="salad" size="md" className="text-content-tertiary" />} title="Chicken salad" subtitle="1 serving" value="450 kcal" onClick={() => {}} />
            <SwipeableRow action={{ label: 'Delete', tone: 'danger', icon: <Trash2 size={16} strokeWidth={2} />, onAction: () => {} }}>
              <ListRow leading={<Icon name="apple" size="md" className="text-content-tertiary" />} title="Swipe me left" subtitle="Reveals a destructive action" value="95 kcal" />
            </SwipeableRow>
          </ListGroup>
        </section>

        {/* ── Feedback states ── */}
        <section className="flex flex-col gap-3">
          <h2 className="text-overline font-semibold uppercase text-content-tertiary">
            Alerts — never color alone
          </h2>
          <Alert tone="success" title="Workout logged">Your streak is now 12 days.</Alert>
          <Alert tone="warning" title="Trial ending soon">3 days left. Subscribe to keep your history.</Alert>
          <Alert tone="error" title="Could not save recipe">Check the nutrition values and try again.</Alert>
          <Alert tone="info" title="New feature">Vibe Thread is now open to everyone.</Alert>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-overline font-semibold uppercase text-content-tertiary">
            Empty and error states
          </h2>
          <Card padding="none">
            <EmptyState icon="dumbbell" title="No workouts logged yet" description="Log your first workout and it will show up here." action={<Button size="sm">Log workout</Button>} />
          </Card>
          <Card padding="none">
            <ErrorState onRetry={() => {}} />
          </Card>
        </section>

        {/* ── Skeletons ── */}
        <section className="flex flex-col gap-3">
          <h2 className="text-overline font-semibold uppercase text-content-tertiary">
            Skeletons — shape-matched
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <SkeletonStatTile />
            <SkeletonStatTile />
          </div>
          <SkeletonCard />
          <SkeletonChart />
          <Card padding="none">
            <div className="px-4 divide-y divide-border-subtle">
              <SkeletonRow />
              <SkeletonRow />
            </div>
          </Card>
          <SkeletonText lines={3} />
          <Skeleton className="h-11 w-full" rounded="sm" />
        </section>

        {/* ── Overlays ── */}
        <Row title="Overlays">
          <Button onClick={() => setSheetOpen(true)}>Open bottom sheet</Button>
        </Row>

        {/* ── Icon registry ── */}
        <section className="flex flex-col gap-3">
          <h2 className="text-overline font-semibold uppercase text-content-tertiary">
            Icon registry — {ICON_NAMES.length} names, zero emoji
          </h2>
          <Card>
            <div className="grid grid-cols-8 sm:grid-cols-12 gap-3">
              {ICON_NAMES.map((n) => (
                <div key={n} className="flex items-center justify-center text-content-secondary" title={n}>
                  <Icon name={n} size="md" />
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>

      <Sheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Bottom sheet"
        description="Drag down, tap the scrim, or press Escape to dismiss."
        footer={
          <Button fullWidth onClick={() => setSheetOpen(false)}>
            Done
          </Button>
        }
      >
        <div className="flex flex-col gap-3 py-2">
          <p className="text-body text-content-secondary">
            This is the default overlay on mobile. On desktop it centers as a dialog, so callers
            never branch on viewport.
          </p>
          <Input label="Search" placeholder="Type to filter" />
          <div className="flex items-center gap-2 text-content-tertiary">
            <Search size={16} strokeWidth={1.75} />
            <span className="text-body-sm">Focus is trapped inside the sheet.</span>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
