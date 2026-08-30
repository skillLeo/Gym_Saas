import { create } from 'zustand';

export type Reaction = '👍' | '❤️' | '🔥' | '😍' | '💪' | '🎉';

export interface Author {
  id: string | number;
  name: string;
  avatar: string | null;
  username?: string;
}

export interface Reply {
  id: string;
  author: Author;
  text: string;
  timeAgo: string;
  likes: number;
  likedByMe: boolean;
}

export interface Comment {
  id: string;
  author: Author;
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
  author: Author;
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

interface SocialState {
  posts: Post[];
  followedIds: Set<string>;
  setPosts: (posts: Post[]) => void;
  prependPost: (post: Post) => void;
  toggleReaction: (postId: string, reaction: Reaction) => void;
  toggleComments: (postId: string) => void;
  addPost: (post: Omit<Post, 'id' | 'likes' | 'likedByMe' | 'myReaction' | 'comments' | 'commentsOpen'>) => void;
  shareAchievement: (achievement: { id: string; title: string; icon: string; description: string; poster?: string | null }, author: Author) => void;
  addComment: (postId: string, text: string, author: Author) => void;
  toggleCommentLike: (postId: string, commentId: string) => void;
  toggleReplies: (postId: string, commentId: string) => void;
  toggleReplyInput: (postId: string, commentId: string) => void;
  addReply: (postId: string, commentId: string, text: string, author: Author) => void;
  toggleReplyLike: (postId: string, commentId: string, replyId: string) => void;
  toggleFollow: (memberId: string) => void;
  isFollowing: (memberId: string) => boolean;
}

export const useSocialStore = create<SocialState>((set, get) => ({
  posts: [],
  followedIds: new Set<string>(),

  setPosts: (posts) => set({ posts }),

  prependPost: (post) => set(s => ({ posts: [post, ...s.posts] })),

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

  shareAchievement: (achievement, author) =>
    set(s => ({
      posts: [{
        id: `ach-${Date.now()}`,
        author,
        content: `I just earned the "${achievement.title}" achievement! ${achievement.description}`,
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
        comments: [...p.comments, {
          id: `c-${Date.now()}`, author, text, timeAgo: 'Just now',
          likes: 0, likedByMe: false, replies: [], showReplies: false, replyInputOpen: false,
        }],
      }),
    })),

  toggleCommentLike: (postId, commentId) =>
    set(s => ({
      posts: s.posts.map(p => p.id !== postId ? p : {
        ...p,
        comments: p.comments.map(c => c.id !== commentId ? c : {
          ...c, likedByMe: !c.likedByMe, likes: c.likedByMe ? c.likes - 1 : c.likes + 1,
        }),
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
          replies: c.replies.map(r => r.id !== replyId ? r : {
            ...r, likedByMe: !r.likedByMe, likes: r.likedByMe ? r.likes - 1 : r.likes + 1,
          }),
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
