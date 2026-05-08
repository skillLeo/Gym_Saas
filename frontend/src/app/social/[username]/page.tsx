import UserProfilePageClient from './UserProfilePageClient';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return [
    { username: 'kelvinsilas' },
    { username: 'marcusfit' },
    { username: 'sarahwellness' },
    { username: 'dereklifts' },
    { username: 'aliciaruns' },
    { username: 'tylerbfit' },
  ];
}

export default function Page() {
  return <UserProfilePageClient />;
}
