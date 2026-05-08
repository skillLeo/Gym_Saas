import ConversationPageClient from './ConversationPageClient';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return [
    { conversationId: 'cv1' },
    { conversationId: 'cv2' },
    { conversationId: 'cv3' },
  ];
}

export default function Page() {
  return <ConversationPageClient />;
}
