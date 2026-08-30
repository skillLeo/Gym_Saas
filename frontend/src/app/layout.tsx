import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import Providers from "@/components/Providers";

/**
 * Fonts are SELF-HOSTED from public/fonts, not fetched from Google.
 *
 * `next/font/google` downloads the files at build time, which made every
 * production build depend on reaching fonts.gstatic.com. That failed once
 * mid-session with "Error while requesting resource" and killed the build — an
 * unacceptable risk during a deployment. The woff2 files are now committed, so
 * the build is fully offline-capable and there is no third-party request at
 * runtime either.
 *
 * Files: Inter (variable 100–900, latin) and Archivo Black (400, latin).
 * To update, re-download from Google Fonts and replace the files — no code
 * change needed.
 */
const inter = localFont({
  src: "../../public/fonts/Inter-Variable-latin.woff2",
  variable: "--font-inter",
  display: "swap",
  weight: "100 900",
  style: "normal",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "sans-serif"],
});

/* Interim fallback for the licensed 'Posey Textured' brand face, which has not
   been delivered. Archivo Black is a heavy grotesque that reads far closer to a
   textured display face on a fitness brand than a didone serif does. The moment
   Posey-Textured-Regular.woff2 is dropped into public/fonts/ it takes over
   automatically — no code change. */
const displayFallback = localFont({
  src: "../../public/fonts/ArchivoBlack-400-latin.woff2",
  variable: "--font-display-fallback",
  display: "swap",
  weight: "400",
  style: "normal",
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "My EXtreme Trainer — Transform Your Body. Build Your Community.",
  description:
    "Track your food, workouts, and progress. Train with a community that shows up.",
  manifest: "/manifest.json",
  // iOS ignores most of the manifest, so the install behaviour it *does*
  // honour has to be declared here (§2.3).
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "EXtreme",
  },
  icons: {
    icon: [
      { url: "/images/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/images/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/images/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // required for env(safe-area-inset-*) to report real values
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF9" },
    { media: "(prefers-color-scheme: dark)", color: "#0C0A09" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${displayFallback.variable} min-h-screen antialiased bg-surface-base text-content-primary`}
        suppressHydrationWarning
      >
        {/* Resolves the theme before first paint to prevent a flash. Mirrors the
            logic in ThemeContext: an explicit choice wins, otherwise follow the
            OS. Stamps an explicit class either way, so :root.light can override
            the prefers-color-scheme media query. */}
        <Script id="theme-init" strategy="beforeInteractive">{`(function(){try{var p=localStorage.getItem('met-theme')||'system';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.add(d?'dark':'light');}catch(e){document.documentElement.classList.add('light');}})();`}</Script>
        {/* Records whether focus last moved by pointer or by keyboard.

            Browsers deliberately treat a focused text input as :focus-visible
            even when it was clicked, because someone typing in it needs to see
            where they are. That is right for keyboard users and wrong for the
            client, who sees a heavy accent ring every time he clicks a search
            box. Removing the focus style outright would leave keyboard users
            with nothing, so globals.css suppresses it only while this attribute
            says the last interaction was a pointer. */}
        <Script id="focus-modality" strategy="beforeInteractive">{`(function(){try{var d=document.documentElement;var set=function(v){d.setAttribute('data-focus-method',v);};set('keyboard');window.addEventListener('mousedown',function(){set('pointer');},true);window.addEventListener('touchstart',function(){set('pointer');},true);window.addEventListener('keydown',function(e){if(e.key==='Tab'||e.key==='ArrowUp'||e.key==='ArrowDown'||e.key==='ArrowLeft'||e.key==='ArrowRight')set('keyboard');},true);}catch(e){}})();`}</Script>
        <Script id="strip-ext-attrs" strategy="beforeInteractive">{`(function(){try{var o=new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(function(n){if(n.nodeType===1){n.querySelectorAll('[bis_skin_checked]').forEach(function(el){el.removeAttribute('bis_skin_checked');});if(n.hasAttribute&&n.hasAttribute('bis_skin_checked'))n.removeAttribute('bis_skin_checked');}});});});o.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['bis_skin_checked']});}catch(e){}})();`}</Script>
        <Providers>{children}</Providers>
        {/* top-center keeps toasts clear of the bottom tab bar and the FAB (§2.2) */}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 5000,
            style: {
              background: "var(--surface-raised)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "12px",
              fontSize: "15px",
              boxShadow: "var(--shadow-e2)",
              maxWidth: "min(92vw, 420px)",
            },
            success: {
              iconTheme: { primary: "var(--success)", secondary: "var(--surface-raised)" },
            },
            error: {
              duration: 7000,
              iconTheme: { primary: "var(--error)", secondary: "var(--surface-raised)" },
            },
          }}
        />
      </body>
    </html>
  );
}
