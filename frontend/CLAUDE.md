# CLAUDE.MD — MY EXTREME TRAINER PROJECT

## WHO YOU ARE WORKING FOR
You are building the complete frontend for a fitness and health SaaS platform called 
My EXtreme Trainer. The client is Kelvin Silas, a fitness coach who runs Team Extreme. 
He is not technical. He judges everything by how it looks and feels. His standard is 
"make me say WOW." Every page you build must be visually stunning, modern, and 
feel like a premium paid app. If it looks generic or plain, it is wrong.

## TECH STACK
- Next.js 14+ with TypeScript
- Tailwind CSS for styling
- No backend, no API calls, no database
- All data is mocked/static for now
- Spatie-style role management handled frontend-only via a single shared dashboard
  that renders different content based on user role (admin, member)
- All pages fully responsive and mobile-first

## BRAND COLORS — USE THESE EXACTLY
- Primary Blue: #0000FF
- Primary Orange: #F87404
- Darker Orange: #FF5C04
- Red: #FF0404
- Pure Red: #FF0000
- Yellow: #FFC000
- Light Blue: #004AAD
- Social section accent: bright orange dominant (#F87404)
- Fitness section accent: black and red dominant
- Food journal accent: clean with orange and blue
- Calendar section accent: colorful, Cozi-inspired

## FONT
- Primary font: "Posey Textured" — used for all headings, buttons, section titles
- Fallback: system-serif or a Google Font that closely resembles textured display fonts
- Body text: clean modern sans-serif (Inter or similar)

## DESIGN INSPIRATIONS THE CLIENT SHARED
- Social section: PeepSo (demo.peepso.com) — bright orange, white cards, clean 
  profile layout with cover image + circular avatar, Stream/About/Friends tabs
- Social profile cards: PeepSo member cards with Friend/Following/Message buttons
- Messaging: PeepSo real-time chat UI with orange bubbles on right, white on left
- Landing page: Lead Injection diet page — icon grid "What Does Program Include"
- Landing page: Dark backgrounds, bold fitness imagery, strong CTAs
- Dashboard: Large icon tiles for main sections (Exercise, Diet, Recipes, Calendar)
- Fitness section: Black and red color tones
- Calendar: Cozi app — colorful, agenda/weekly/monthly views

## USER ROLES IN SINGLE DASHBOARD
- Admin role: sees all management tools, statistics, user management, moderation
- Member role: sees personal dashboard, all fitness/social/recipe features
- Both roles share one dashboard page, content switches based on role
- Role stored in mock context/state

## DARK MODE AND LIGHT MODE
- Full dark/light theme toggle must work on every page
- User can also customize their brand theme (logo upload placeholder, accent color 
  picker) — build the UI for this even without backend

## KEY PRINCIPLE
Every single page must be 100% complete. No placeholder lorem ipsum left in final 
output except where mock user data is explicitly needed. Every button must look 
clickable. Every form must look fillable. Every chart must render with mock data. 
Navigation must work between all pages. Mobile bottom nav must be present on 
all authenticated pages. The platform must feel like it is already live.