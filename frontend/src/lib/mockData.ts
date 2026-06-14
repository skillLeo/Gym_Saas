// ── Mock data for My EXtreme Trainer ──

export const mockMembers = [
  { id: '1', name: 'Kelvin Silas', username: 'kelvinsilas', avatar: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=80&h=80&fit=crop&crop=face', bio: 'Fitness coach & founder of Team Extreme', followers: 342, following: 128, goal: 'Build Muscle', isFollowing: false, isOnline: true, coverPhoto: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=300&fit=crop', friends: 87, mutualConnections: 0 },
  { id: '2', name: 'Marcus Johnson', username: 'marcusfit', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face', bio: 'Personal trainer | Marathon runner', followers: 891, following: 234, goal: 'Lose Weight', isFollowing: true, isOnline: true, coverPhoto: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800&h=300&fit=crop', friends: 124, mutualConnections: 12 },
  { id: '3', name: 'Sarah Williams', username: 'sarahwellness', avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612d5ca?w=80&h=80&fit=crop&crop=face', bio: 'Yoga instructor & nutrition coach', followers: 1240, following: 89, goal: 'Eat Healthier', isFollowing: true, isOnline: false, coverPhoto: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800&h=300&fit=crop', friends: 56, mutualConnections: 8 },
  { id: '4', name: 'Derek Thompson', username: 'dereklifts', avatar: 'https://images.unsplash.com/photo-1542206395-9feb3edaa68d?w=80&h=80&fit=crop&crop=face', bio: 'Powerlifter | 3x State Champion', followers: 2100, following: 310, goal: 'Build Muscle', isFollowing: false, isOnline: true, coverPhoto: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&h=300&fit=crop', friends: 211, mutualConnections: 5 },
  { id: '5', name: 'Alicia Monroe', username: 'aliciaruns', avatar: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=80&h=80&fit=crop&crop=face', bio: '5K to marathon journey 🏃‍♀️', followers: 567, following: 445, goal: 'Improve Stamina', isFollowing: false, isOnline: false, coverPhoto: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800&h=300&fit=crop', friends: 78, mutualConnections: 3 },
  { id: '6', name: 'Tyler Brooks', username: 'tylerbfit', avatar: 'https://images.unsplash.com/photo-1567784177951-6fa58317e16b?w=80&h=80&fit=crop&crop=face', bio: 'HIIT specialist | Dad of 3', followers: 430, following: 198, goal: 'Lose Weight', isFollowing: true, isOnline: true, coverPhoto: 'https://images.unsplash.com/photo-1599058945522-28d584b6f0ff?w=800&h=300&fit=crop', friends: 43, mutualConnections: 19 },
];

export const mockPosts = [
  {
    id: 'p1',
    author: mockMembers[1],
    content: 'Just crushed my morning run — 6.2 miles in 48 minutes! New personal best. The consistency is finally paying off. Keep pushing everyone! 💪🔥',
    images: ['https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=600&h=400&fit=crop'],
    likes: 47,
    comments: 12,
    isLiked: false,
    timeAgo: '2 hours ago',
    isAchievement: false,
  },
  {
    id: 'p2',
    author: mockMembers[2],
    content: 'Today\'s meal prep done! 🥗 Grilled chicken, brown rice, and roasted veggies for the whole week. Eating clean doesn\'t have to be boring — this is delicious AND hits all my macros.',
    images: [
      'https://images.unsplash.com/photo-1547592180-85f173990554?w=400&h=400&fit=crop',
      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=400&fit=crop',
    ],
    likes: 83,
    comments: 21,
    isLiked: true,
    timeAgo: '4 hours ago',
    isAchievement: false,
  },
  {
    id: 'p3',
    author: mockMembers[3],
    content: 'NEW PERSONAL RECORD! Bench pressed 275 lbs today. Six months ago I could barely do 185. This platform and this community changed everything for me. Thank you Team Extreme! 🏆',
    images: [],
    likes: 156,
    comments: 44,
    isLiked: false,
    timeAgo: '6 hours ago',
    isAchievement: true,
  },
  {
    id: 'p4',
    author: mockMembers[4],
    content: 'Morning yoga flow at sunrise. Starting the day with intention and gratitude. 30 minutes of mindful movement sets the tone for everything that follows 🧘‍♀️✨',
    images: ['https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&h=400&fit=crop'],
    likes: 62,
    comments: 8,
    isLiked: true,
    timeAgo: '8 hours ago',
    isAchievement: false,
  },
  {
    id: 'p5',
    author: mockMembers[5],
    content: '30 days of consistent workouts COMPLETE! 🎉 Used the My EXtreme Trainer app every single day. Food log kept me accountable. Never felt better. Who else is on a streak?',
    images: [],
    likes: 214,
    comments: 67,
    isLiked: false,
    timeAgo: '1 day ago',
    isAchievement: true,
  },
];

export const mockComments = [
  { id: 'c1', author: mockMembers[0], text: 'That\'s amazing! Keep crushing it! 🔥', timeAgo: '1 hour ago', likes: 4 },
  { id: 'c2', author: mockMembers[2], text: 'Incredible progress! What was your training split?', timeAgo: '2 hours ago', likes: 2 },
  { id: 'c3', author: mockMembers[4], text: 'You\'re an inspiration to us all!', timeAgo: '3 hours ago', likes: 7 },
];

export const mockFoodLog = {
  date: '2026-06-14',
  dailyGoal: { calories: 2000, protein: 150, carbs: 200, fat: 65 },
  consumed: { calories: 1340, protein: 98, carbs: 142, fat: 41 },
  waterGlasses: 5,
  waterGoal: 8,
  meals: {
    breakfast: [
      { id: 'f1', name: 'Scrambled Eggs (3 large)', calories: 234, protein: 19, carbs: 2, fat: 17, serving: '3 eggs' },
      { id: 'f2', name: 'Whole Wheat Toast', calories: 138, protein: 5, carbs: 26, fat: 2, serving: '2 slices' },
      { id: 'f3', name: 'Orange Juice', calories: 112, protein: 2, carbs: 26, fat: 0, serving: '8 fl oz' },
    ],
    lunch: [
      { id: 'f4', name: 'Grilled Chicken Breast', calories: 284, protein: 53, carbs: 0, fat: 6, serving: '6 oz' },
      { id: 'f5', name: 'Brown Rice', calories: 216, protein: 5, carbs: 45, fat: 2, serving: '1 cup cooked' },
      { id: 'f6', name: 'Steamed Broccoli', calories: 55, protein: 4, carbs: 11, fat: 1, serving: '1 cup' },
    ],
    dinner: [],
    snacks: [
      { id: 'f7', name: 'Greek Yogurt', calories: 130, protein: 17, carbs: 9, fat: 0, serving: '6 oz' },
      { id: 'f8', name: 'Almonds', calories: 171, protein: 6, carbs: 6, fat: 15, serving: '1 oz (23 nuts)' },
    ],
  },
};

const _REF = new Date('2026-06-14');
const _dAgo = (n: number) => new Date(_REF.getTime() - n * 86400000).toISOString().split('T')[0];
const _dAhead = (n: number) => new Date(_REF.getTime() + n * 86400000).toISOString().split('T')[0];

export const mockWorkouts = [
  {
    id: 'w1',
    type: 'Strength',
    name: 'Chest & Triceps',
    date: _dAgo(0),
    duration: 52,
    calories: 380,
    exercises: [
      { name: 'Bench Press', sets: [{ reps: 10, weight: 185 }, { reps: 8, weight: 205 }, { reps: 6, weight: 225 }] },
      { name: 'Incline Dumbbell Press', sets: [{ reps: 12, weight: 60 }, { reps: 10, weight: 65 }, { reps: 8, weight: 70 }] },
      { name: 'Tricep Pushdowns', sets: [{ reps: 15, weight: 50 }, { reps: 12, weight: 55 }, { reps: 10, weight: 60 }] },
    ],
  },
  {
    id: 'w2',
    type: 'Cardio',
    name: 'Morning Run',
    date: _dAgo(1),
    duration: 35,
    calories: 340,
    distance: 3.2,
    activity: 'Running',
  },
  {
    id: 'w3',
    type: 'Strength',
    name: 'Back & Biceps',
    date: _dAgo(2),
    duration: 55,
    calories: 410,
    exercises: [
      { name: 'Pull-ups', sets: [{ reps: 10, weight: 0 }, { reps: 8, weight: 0 }, { reps: 6, weight: 0 }] },
      { name: 'Barbell Row', sets: [{ reps: 10, weight: 155 }, { reps: 8, weight: 165 }, { reps: 6, weight: 175 }] },
    ],
  },
];

export const mockRecipes = [
  {
    id: 'r1',
    name: 'High-Protein Chicken Bowl',
    description: 'Lean grilled chicken over brown rice with roasted veggies and avocado',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&h=400&fit=crop',
    category: 'Lunch',
    tags: ['High Protein', 'Meal Prep'],
    prepTime: 15,
    cookTime: 25,
    servings: 4,
    difficulty: 3,
    rating: 4.8,
    reviews: 124,
    isSaved: true,
    nutrition: { calories: 485, protein: 52, carbs: 38, fat: 12, fiber: 6 },
    ingredients: [
      { name: 'Chicken Breast', amount: '24', unit: 'oz' },
      { name: 'Brown Rice', amount: '2', unit: 'cups dry' },
      { name: 'Broccoli', amount: '2', unit: 'cups' },
      { name: 'Bell Pepper', amount: '1', unit: 'large' },
      { name: 'Avocado', amount: '1', unit: 'medium' },
      { name: 'Olive Oil', amount: '2', unit: 'tbsp' },
      { name: 'Garlic', amount: '3', unit: 'cloves' },
      { name: 'Lemon Juice', amount: '2', unit: 'tbsp' },
    ],
    instructions: [
      'Cook brown rice according to package directions.',
      'Season chicken with garlic, salt, pepper, and lemon juice.',
      'Grill chicken on medium-high heat for 6-7 min per side until cooked through.',
      'Roast broccoli and bell pepper at 425°F for 20 minutes.',
      'Slice chicken and assemble bowls with rice, veggies, and avocado.',
    ],
  },
  {
    id: 'r2',
    name: 'Protein Overnight Oats',
    description: 'Creamy overnight oats loaded with protein powder, berries, and nut butter',
    image: 'https://images.unsplash.com/photo-1557844352-761f2565b576?w=600&h=400&fit=crop',
    category: 'Breakfast',
    tags: ['Quick', 'Meal Prep', 'Vegetarian'],
    prepTime: 5,
    cookTime: 0,
    servings: 1,
    difficulty: 1,
    rating: 4.9,
    reviews: 287,
    isSaved: true,
    nutrition: { calories: 412, protein: 35, carbs: 48, fat: 9, fiber: 8 },
    ingredients: [
      { name: 'Rolled Oats', amount: '1/2', unit: 'cup' },
      { name: 'Protein Powder', amount: '1', unit: 'scoop' },
      { name: 'Almond Milk', amount: '3/4', unit: 'cup' },
      { name: 'Mixed Berries', amount: '1/2', unit: 'cup' },
      { name: 'Almond Butter', amount: '1', unit: 'tbsp' },
      { name: 'Chia Seeds', amount: '1', unit: 'tbsp' },
      { name: 'Honey', amount: '1', unit: 'tsp' },
    ],
    instructions: [
      'Combine oats, protein powder, and chia seeds in a jar.',
      'Pour almond milk over and stir well.',
      'Refrigerate overnight or for at least 6 hours.',
      'Top with berries, almond butter, and honey before serving.',
    ],
  },
  {
    id: 'r3',
    name: 'Salmon & Quinoa Power Plate',
    description: 'Omega-3 rich salmon fillet with quinoa and a lemon herb dressing',
    image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&h=400&fit=crop',
    category: 'Dinner',
    tags: ['High Protein', 'Low Carb'],
    prepTime: 10,
    cookTime: 20,
    servings: 2,
    difficulty: 2,
    rating: 4.7,
    reviews: 98,
    isSaved: false,
    nutrition: { calories: 520, protein: 48, carbs: 32, fat: 21, fiber: 4 },
    ingredients: [
      { name: 'Salmon Fillet', amount: '12', unit: 'oz' },
      { name: 'Quinoa', amount: '1', unit: 'cup dry' },
      { name: 'Asparagus', amount: '1', unit: 'bunch' },
      { name: 'Lemon', amount: '1', unit: 'whole' },
      { name: 'Dill', amount: '2', unit: 'tbsp fresh' },
      { name: 'Olive Oil', amount: '1', unit: 'tbsp' },
    ],
    instructions: [
      'Cook quinoa according to package directions.',
      'Season salmon with salt, pepper, dill, and lemon.',
      'Sear salmon in olive oil for 4 min per side.',
      'Roast asparagus at 400°F for 12 minutes.',
      'Plate and top with fresh lemon juice.',
    ],
  },
  {
    id: 'r4',
    name: 'Turkey Taco Bowls',
    description: 'Lean ground turkey seasoned with taco spices over cauliflower rice',
    image: 'https://images.unsplash.com/photo-1613514785940-daed07799d9b?w=600&h=400&fit=crop',
    category: 'Dinner',
    tags: ['High Protein', 'Low Carb', 'Quick'],
    prepTime: 10,
    cookTime: 15,
    servings: 4,
    difficulty: 1,
    rating: 4.6,
    reviews: 156,
    isSaved: false,
    nutrition: { calories: 365, protein: 42, carbs: 18, fat: 11, fiber: 5 },
    ingredients: [
      { name: 'Ground Turkey 93% Lean', amount: '1.5', unit: 'lbs' },
      { name: 'Cauliflower Rice', amount: '4', unit: 'cups' },
      { name: 'Black Beans', amount: '1', unit: 'can' },
      { name: 'Salsa', amount: '1/2', unit: 'cup' },
      { name: 'Greek Yogurt', amount: '1/4', unit: 'cup' },
      { name: 'Taco Seasoning', amount: '2', unit: 'tbsp' },
    ],
    instructions: [
      'Brown ground turkey in a skillet over medium-high heat.',
      'Add taco seasoning and 1/4 cup water. Simmer 5 minutes.',
      'Sauté cauliflower rice separately until tender.',
      'Warm black beans in a small pot.',
      'Assemble bowls and top with salsa and Greek yogurt.',
    ],
  },
  {
    id: 'r5',
    name: 'Green Protein Smoothie Bowl',
    description: 'Thick and creamy smoothie bowl packed with spinach, banana, and protein',
    image: 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&h=400&fit=crop',
    category: 'Breakfast',
    tags: ['Vegetarian', 'Quick'],
    prepTime: 5,
    cookTime: 0,
    servings: 1,
    difficulty: 1,
    rating: 4.5,
    reviews: 201,
    isSaved: true,
    nutrition: { calories: 385, protein: 28, carbs: 52, fat: 8, fiber: 7 },
    ingredients: [
      { name: 'Frozen Banana', amount: '1', unit: 'large' },
      { name: 'Baby Spinach', amount: '2', unit: 'cups' },
      { name: 'Protein Powder', amount: '1', unit: 'scoop' },
      { name: 'Almond Milk', amount: '1/3', unit: 'cup' },
      { name: 'Granola', amount: '1/4', unit: 'cup' },
      { name: 'Sliced Strawberries', amount: '1/4', unit: 'cup' },
    ],
    instructions: [
      'Blend banana, spinach, protein powder, and almond milk until thick.',
      'Pour into a bowl.',
      'Top with granola, strawberries, and any other toppings.',
    ],
  },
  {
    id: 'r6',
    name: 'Egg White Omelette',
    description: 'Light and fluffy egg white omelette loaded with veggies and feta',
    image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&h=400&fit=crop',
    category: 'Breakfast',
    tags: ['High Protein', 'Low Carb', 'Quick'],
    prepTime: 5,
    cookTime: 8,
    servings: 1,
    difficulty: 2,
    rating: 4.4,
    reviews: 87,
    isSaved: false,
    nutrition: { calories: 218, protein: 29, carbs: 8, fat: 7, fiber: 2 },
    ingredients: [
      { name: 'Egg Whites', amount: '6', unit: 'large' },
      { name: 'Spinach', amount: '1', unit: 'cup' },
      { name: 'Cherry Tomatoes', amount: '1/4', unit: 'cup' },
      { name: 'Feta Cheese', amount: '2', unit: 'tbsp' },
      { name: 'Fresh Basil', amount: '4', unit: 'leaves' },
    ],
    instructions: [
      'Whisk egg whites with salt and pepper.',
      'Pour into a non-stick skillet over medium heat.',
      'Add spinach and tomatoes on one half as it sets.',
      'Fold over, top with feta and basil.',
    ],
  },
];

export const mockConversations = [
  {
    id: 'cv1',
    participant: mockMembers[1],
    lastMessage: 'Bro that run was insane! How do you keep up that pace?',
    time: '2 min ago',
    unread: 2,
    messages: [
      { id: 'm1', senderId: '2', text: 'Hey! Great workout yesterday. What was your chest routine?', time: '10:12 AM', isOwn: false },
      { id: 'm2', senderId: '1', text: 'Thanks! I did bench press, incline dumbbells, and cable flyes. 3 sets each.', time: '10:15 AM', isOwn: true },
      { id: 'm3', senderId: '2', text: 'That\'s solid. What weight on bench?', time: '10:16 AM', isOwn: false },
      { id: 'm4', senderId: '1', text: 'Worked up to 225 for 6. New PR!', time: '10:18 AM', isOwn: true },
      { id: 'm5', senderId: '2', text: 'Bro that run was insane! How do you keep up that pace?', time: '10:45 AM', isOwn: false },
    ],
  },
  {
    id: 'cv2',
    participant: mockMembers[2],
    lastMessage: 'Thanks for the recipe recommendation! Made it last night 😍',
    time: '1 hour ago',
    unread: 0,
    messages: [
      { id: 'm6', senderId: '3', text: 'Have you tried the salmon bowl recipe on the platform?', time: '9:00 AM', isOwn: false },
      { id: 'm7', senderId: '1', text: 'Not yet! Is it good?', time: '9:05 AM', isOwn: true },
      { id: 'm8', senderId: '3', text: 'Thanks for the recipe recommendation! Made it last night 😍', time: '9:30 AM', isOwn: false },
    ],
  },
  {
    id: 'cv3',
    participant: mockMembers[3],
    lastMessage: 'When\'s the next group workout session?',
    time: '3 hours ago',
    unread: 1,
    messages: [
      { id: 'm9', senderId: '4', text: 'When\'s the next group workout session?', time: '8:00 AM', isOwn: false },
    ],
  },
];

export const mockNotifications = [
  { id: 'n1', type: 'like', actor: mockMembers[1], content: 'liked your post', target: 'your PR achievement', time: '2 min ago', read: false, link: '/social' },
  { id: 'n2', type: 'comment', actor: mockMembers[2], content: 'commented on your post', target: '"Great progress! What was your training split?"', time: '15 min ago', read: false, link: '/social' },
  { id: 'n3', type: 'follow', actor: mockMembers[3], content: 'started following you', target: '', time: '1 hour ago', read: false, link: '/social/dereklifts' },
  { id: 'n4', type: 'message', actor: mockMembers[4], content: 'sent you a message', target: '"When\'s the next group workout?"', time: '2 hours ago', read: true, link: '/messages/cv3' },
  { id: 'n5', type: 'achievement', actor: null, content: 'You unlocked an achievement!', target: '7-Day Workout Streak 🔥', time: '3 hours ago', read: true, link: '/ai-trainer/achievements' },
  { id: 'n6', type: 'like', actor: mockMembers[5], content: 'liked your post', target: '', time: '5 hours ago', read: true, link: '/social' },
  { id: 'n7', type: 'comment', actor: mockMembers[0], content: 'replied to your comment', target: '"Keep it up!"', time: '6 hours ago', read: true, link: '/social' },
  { id: 'n8', type: 'system', actor: null, content: 'Your 30-day trial has 16 days remaining', target: 'Subscribe to keep full access', time: '1 day ago', read: true, link: '/membership' },
];

export const mockCalendarEvents = [
  { id: 'e1', title: 'Chest & Triceps Workout', date: _dAgo(0), time: '7:00 AM', color: 'red', type: 'workout' },
  { id: 'e2', title: 'Meal Prep Sunday', date: _dAgo(0), time: '3:00 PM', color: 'orange', type: 'meal' },
  { id: 'e3', title: 'Morning Run', date: _dAhead(1), time: '6:30 AM', color: 'red', type: 'workout' },
  { id: 'e4', title: 'Yoga Flow', date: _dAhead(1), time: '5:00 PM', color: 'blue', type: 'workout' },
  { id: 'e5', title: 'Nutrition Check-in', date: _dAhead(2), time: '12:00 PM', color: 'yellow', type: 'appointment' },
  { id: 'e6', title: 'Back & Biceps', date: _dAhead(3), time: '7:00 AM', color: 'red', type: 'workout' },
];

export const mockAchievements = [
  { id: 'a1', title: '7-Day Workout Streak', description: 'Logged workouts 7 days in a row!', date: '2025-04-10', icon: '🔥', earned: true, poster: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=500&fit=crop' },
  { id: 'a2', title: 'First 5 Pounds Lost', description: 'Lost your first 5 pounds!', date: '2025-04-01', icon: '⚖️', earned: true, poster: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=500&fit=crop' },
  { id: 'a3', title: '30-Day Member', description: 'Been a member for 30 days!', date: '2025-03-20', icon: '🏅', earned: true, poster: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=500&fit=crop' },
  { id: 'a4', title: '100 Meals Logged', description: 'Track your 100th meal', date: '', icon: '🥗', earned: false, poster: null },
  { id: 'a5', title: 'Calorie Goal 7 Days Straight', description: 'Hit your calorie goal every day for a week', date: '', icon: '🎯', earned: false, poster: null },
  { id: 'a6', title: 'Personal Record Broken', description: 'Set a new PR on any exercise', date: '', icon: '🏋️', earned: false, poster: null },
];

// Seeded pseudo-random — deterministic on server and client (avoids hydration mismatch)
const sr = (seed: number) => { const x = Math.sin(seed + 1) * 10000; return x - Math.floor(x); };
const REF = new Date('2026-06-14');
const daysAgo = (n: number) => new Date(REF.getTime() - n * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const weeksAgo = (n: number) => new Date(REF.getTime() - n * 7 * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const monthsAgo = (n: number) => new Date(REF.getTime() - n * 30 * 86400000).toLocaleDateString('en-US', { month: 'short' });

export const mockNutritionHistory = Array.from({ length: 30 }, (_, i) => ({
  date: daysAgo(29 - i),
  calories: Math.floor(sr(i) * 600) + 1500,
  protein: Math.floor(sr(i + 30) * 60) + 100,
  carbs: Math.floor(sr(i + 60) * 80) + 140,
  fat: Math.floor(sr(i + 90) * 30) + 45,
  water: Math.floor(sr(i + 120) * 4) + 5,
}));

export const mockWorkoutHistory = Array.from({ length: 30 }, (_, i) => ({
  date: daysAgo(29 - i),
  workouts: sr(i + 200) > 0.35 ? 1 : 0,
  duration: Math.floor(sr(i + 230) * 30) + 35,
  calories: Math.floor(sr(i + 260) * 200) + 280,
  volume: Math.floor(sr(i + 290) * 5000) + 8000,
  distance: sr(i + 320) > 0.5 ? parseFloat((sr(i + 350) * 5 + 1).toFixed(1)) : 0,
}));

export const mockBodyStats = Array.from({ length: 12 }, (_, i) => ({
  date: weeksAgo(11 - i),
  weight: +(188 - i * 0.25 + (sr(i + 400) - 0.5)).toFixed(1),
  bodyFat: +(22 - i * 0.15 + (sr(i + 420) - 0.5) * 0.3).toFixed(1),
  waist: +(34 - i * 0.1 + (sr(i + 440) - 0.5) * 0.2).toFixed(1),
}));

export const mockAdminStats = {
  totalMembers: 1284,
  activeSubscribers: 847,
  trialUsers: 312,
  expiredUsers: 125,
  monthlyRevenue: 8123,
  postsToday: 142,
  mealsLoggedTotal: 48920,
  workoutsLoggedTotal: 22145,
  memberGrowth: Array.from({ length: 12 }, (_, i) => ({
    month: monthsAgo(11 - i),
    members: Math.floor(800 + i * 45 + sr(i + 500) * 30),
    subscribers: Math.floor(500 + i * 30 + sr(i + 520) * 20),
  })),
  revenueHistory: Array.from({ length: 6 }, (_, i) => ({
    month: monthsAgo(5 - i),
    revenue: Math.floor(5000 + i * 550 + sr(i + 540) * 300),
  })),
};

export const mockAdminUsers = [
  { id: '1', name: 'Marcus Johnson', email: 'marcus@example.com', avatar: mockMembers[1].avatar, joined: '2025-03-01', trialEnd: '2025-03-31', status: 'active', lastActive: '2 hours ago' },
  { id: '2', name: 'Sarah Williams', email: 'sarah@example.com', avatar: mockMembers[2].avatar, joined: '2025-03-05', trialEnd: '2025-04-04', status: 'trial', lastActive: '5 min ago' },
  { id: '3', name: 'Derek Thompson', email: 'derek@example.com', avatar: mockMembers[3].avatar, joined: '2025-02-10', trialEnd: '2025-03-12', status: 'active', lastActive: '1 day ago' },
  { id: '4', name: 'Alicia Monroe', email: 'alicia@example.com', avatar: mockMembers[4].avatar, joined: '2025-01-15', trialEnd: '2025-02-14', status: 'expired', lastActive: '3 days ago' },
  { id: '5', name: 'Tyler Brooks', email: 'tyler@example.com', avatar: mockMembers[5].avatar, joined: '2025-03-20', trialEnd: '2025-04-19', status: 'trial', lastActive: '30 min ago' },
  { id: '6', name: 'Jordan Lee', email: 'jordan@example.com', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face', joined: '2025-02-01', trialEnd: '2025-03-02', status: 'deactivated', lastActive: '2 weeks ago' },
];

export const mockReportedContent = [
  { id: 'rp1', type: 'post', content: 'Inappropriate promotional content about supplements', reporter: mockMembers[1].name, reportedUser: 'unknown_user123', reason: 'Spam', date: '2025-04-16', status: 'pending' },
  { id: 'rp2', type: 'comment', content: 'Offensive comment on member\'s progress photo', reporter: mockMembers[2].name, reportedUser: 'anon_user', reason: 'Harassment', date: '2025-04-15', status: 'pending' },
  { id: 'rp3', type: 'post', content: 'Misinformation about extreme fasting', reporter: mockMembers[3].name, reportedUser: 'diet_guru99', reason: 'Misinformation', date: '2025-04-14', status: 'reviewed' },
];
