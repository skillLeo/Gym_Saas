import { create } from 'zustand';
import { mockPosts, mockMembers } from '@/lib/mockData';

export type Reaction = '👍' | '❤️' | '🔥' | '😍' | '💪' | '🎉';

export interface Reply {
  id: string;
  author: (typeof mockMembers)[0];
  text: string;
  timeAgo: string;
  likes: number;
  likedByMe: boolean;
}

export interface Comment {
  id: string;
  author: (typeof mockMembers)[0];
  text: string;
  timeAgo: string;
  likes: number;
  likedByMe: boolean;
  replies: Reply[];
  showReplies: boolean;
  replyInputOpen: boolean;
}

export interface Post {
  id: string;
  author: (typeof mockMembers)[0];
  content: string;
  images: string[];
  likes: number;
  likedByMe: boolean;
  myReaction: Reaction | null;
  comments: Comment[];
  commentsOpen: boolean;
  timeAgo: string;
  isAchievement: boolean;
  achievementIcon?: string;
  achievementTitle?: string;
  achievementPoster?: string;
}

const buildInitialPosts = (): Post[] =>
  mockPosts.map(p => ({
    id: p.id,
    author: p.author,
    content: p.content,
    images: p.images,
    likes: p.likes,
    likedByMe: p.isLiked,
    myReaction: p.isLiked ? '👍' : null,
    comments: [
      {
        id: `${p.id}-c1`,
        author: mockMembers[0],
        text: 'That\'s amazing! Keep crushing it! 🔥',
        timeAgo: '1 hour ago',
        likes: 4,
        likedByMe: false,
        replies: [
          { id: `${p.id}-r1`, author: mockMembers[2], text: 'Agreed! Total beast mode 💪', timeAgo: '55 min ago', likes: 2, likedByMe: false },
          { id: `${p.id}-r2`, author: mockMembers[1], text: 'Facts. This is what dedication looks like!', timeAgo: '45 min ago', likes: 1, likedByMe: false },
        ],
        showReplies: false,
        replyInputOpen: false,
      },
      {
        id: `${p.id}-c2`,
        author: mockMembers[2],
        text: 'Incredible progress! What was your training split?',
        timeAgo: '2 hours ago',
        likes: 2,
        likedByMe: false,
        replies: [
          { id: `${p.id}-r3`, author: mockMembers[3], text: 'I do push/pull/legs — highly recommend', timeAgo: '1.5 hours ago', likes: 0, likedByMe: false },
        ],
        showReplies: false,
        replyInputOpen: false,
      },
    ],
    commentsOpen: false,
    timeAgo: p.timeAgo,
    isAchievement: p.isAchievement,
  }));

interface SocialState {
  posts: Post[];
  followedIds: Set<string>;
  toggleReaction: (postId: string, reaction: Reaction) => void;
  toggleComments: (postId: string) => void;
  addPost: (post: Omit<Post, 'id' | 'likes' | 'likedByMe' | 'myReaction' | 'comments' | 'commentsOpen'>) => void;
  shareAchievement: (achievement: { id: string; title: string; icon: string; description: string; poster?: string | null }) => void;
  addComment: (postId: string, text: string, author: (typeof mockMembers)[0]) => void;
  toggleCommentLike: (postId: string, commentId: string) => void;
  toggleReplies: (postId: string, commentId: string) => void;
  toggleReplyInput: (postId: string, commentId: string) => void;
  addReply: (postId: string, commentId: string, text: string, author: (typeof mockMembers)[0]) => void;
  toggleReplyLike: (postId: string, commentId: string, replyId: string) => void;
  toggleFollow: (memberId: string) => void;
  isFollowing: (memberId: string) => boolean;
}

export const useSocialStore = create<SocialState>((set, get) => ({
  posts: buildInitialPosts(),
  followedIds: new Set(mockMembers.filter(m => m.isFollowing).map(m => m.id)),

  toggleReaction: (postId, reaction) =>
    set(s => ({
      posts: s.posts.map(p => {
        if (p.id !== postId) return p;
        const alreadyReacted = p.myReaction === reaction;
        return {
          ...p,
          myReaction: alreadyReacted ? null : reaction,
          likedByMe: !alreadyReacted,
          likes: alreadyReacted ? p.likes - 1 : p.likedByMe ? p.likes : p.likes + 1,
        };
      }),
    })),

  toggleComments: (postId) =>
    set(s => ({
      posts: s.posts.map(p => p.id === postId ? { ...p, commentsOpen: !p.commentsOpen } : p),
    })),

  addPost: (draft) =>
    set(s => ({
      posts: [{ ...draft, id: `post-${Date.now()}`, likes: 0, likedByMe: false, myReaction: null, comments: [], commentsOpen: false }, ...s.posts],
    })),

  shareAchievement: (achievement) =>
    set(s => ({
      posts: [{
        id: `ach-${Date.now()}`,
        author: mockMembers[0],
        content: `🏆 I just earned the "${achievement.title}" achievement! ${achievement.description}`,
        images: achievement.poster ? [achievement.poster] : [],
        likes: 0, likedByMe: false, myReaction: null, comments: [], commentsOpen: false,
        timeAgo: 'Just now', isAchievement: true,
        achievementIcon: achievement.icon,
        achievementTitle: achievement.title,
        achievementPoster: achievement.poster ?? undefined,
      }, ...s.posts],
    })),

  addComment: (postId, text, author) =>
    set(s => ({
      posts: s.posts.map(p => p.id !== postId ? p : {
        ...p,
        comments: [...p.comments, { id: `c-${Date.now()}`, author, text, timeAgo: 'Just now', likes: 0, likedByMe: false, replies: [], showReplies: false, replyInputOpen: false }],
      }),
    })),

  toggleCommentLike: (postId, commentId) =>
    set(s => ({
      posts: s.posts.map(p => p.id !== postId ? p : {
        ...p,
        comments: p.comments.map(c => c.id !== commentId ? c : { ...c, likedByMe: !c.likedByMe, likes: c.likedByMe ? c.likes - 1 : c.likes + 1 }),
      }),
    })),

  toggleReplies: (postId, commentId) =>
    set(s => ({
      posts: s.posts.map(p => p.id !== postId ? p : {
        ...p,
        comments: p.comments.map(c => c.id !== commentId ? c : { ...c, showReplies: !c.showReplies }),
      }),
    })),

  toggleReplyInput: (postId, commentId) =>
    set(s => ({
      posts: s.posts.map(p => p.id !== postId ? p : {
        ...p,
        comments: p.comments.map(c => c.id !== commentId ? c : { ...c, replyInputOpen: !c.replyInputOpen, showReplies: true }),
      }),
    })),

  addReply: (postId, commentId, text, author) =>
    set(s => ({
      posts: s.posts.map(p => p.id !== postId ? p : {
        ...p,
        comments: p.comments.map(c => c.id !== commentId ? c : {
          ...c, showReplies: true, replyInputOpen: false,
          replies: [...c.replies, { id: `r-${Date.now()}`, author, text, timeAgo: 'Just now', likes: 0, likedByMe: false }],
        }),
      }),
    })),

  toggleReplyLike: (postId, commentId, replyId) =>
    set(s => ({
      posts: s.posts.map(p => p.id !== postId ? p : {
        ...p,
        comments: p.comments.map(c => c.id !== commentId ? c : {
          ...c,
          replies: c.replies.map(r => r.id !== replyId ? r : { ...r, likedByMe: !r.likedByMe, likes: r.likedByMe ? r.likes - 1 : r.likes + 1 }),
        }),
      }),
    })),

  toggleFollow: (memberId) =>
    set(s => {
      const next = new Set(s.followedIds);
      next.has(memberId) ? next.delete(memberId) : next.add(memberId);
      return { followedIds: next };
    }),

  isFollowing: (memberId) => get().followedIds.has(memberId),
}));
