import { Logo } from "@/components/Logo";
import { DESK_EMAIL } from "@/lib/site";

const SOCIAL = [
  {
    label: "WhatsApp",
    href: "https://chat.whatsapp.com/JKk0CCbrjayKEFbNAGoEor",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
        <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.04-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35Z" />
        <path d="M12.04 2C6.5 2 2.02 6.48 2.02 12.02c0 1.77.46 3.5 1.34 5.02L2 22l5.1-1.34A10 10 0 0 0 12.04 22C17.58 22 22.06 17.52 22.06 12S17.58 2 12.04 2Zm0 18.15c-1.64 0-3.25-.44-4.65-1.28l-.33-.2-3.03.8.81-2.95-.22-.34a8.13 8.13 0 0 1-1.25-4.36c0-4.5 3.66-8.16 8.17-8.16 4.5 0 8.16 3.66 8.16 8.16 0 4.5-3.66 8.16-8.16 8.16Z" />
      </svg>
    ),
  },
  {
    label: "Facebook",
    href: "https://www.facebook.com/profile.php?id=61557381370313",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
        <path d="M13.5 21v-7.2h2.42l.36-2.82H13.5V9.18c0-.82.23-1.37 1.4-1.37h1.5V5.28c-.26-.03-1.15-.11-2.18-.11-2.16 0-3.64 1.32-3.64 3.74v2.07H8.4v2.82h2.18V21H4.5A1.5 1.5 0 0 1 3 19.5v-15A1.5 1.5 0 0 1 4.5 3h15A1.5 1.5 0 0 1 21 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-6Z" />
      </svg>
    ),
  },
  {
    label: "Telegram",
    href: "https://t.me/TradeBossFx",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
        <path d="M21.5 4.3 2.9 11.4c-1.27.5-1.26 1.2-.23 1.5l4.77 1.49 11.05-6.97c.52-.32 1-.15.61.22l-8.95 8.08-.35 5.27c.5 0 .73-.23 1.01-.5l2.42-2.35 5.03 3.72c.93.51 1.6.25 1.83-.86l3.31-15.6c.34-1.36-.52-1.98-1.4-1.58Z" />
      </svg>
    ),
  },
  {
    label: "YouTube",
    href: "https://www.youtube.com/@ForexTradingConsultants",
    icon: (
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
        <path d="M23.5 6.2a3.02 3.02 0 0 0-2.13-2.14C19.5 3.7 12 3.7 12 3.7s-7.5 0-9.37.36A3.02 3.02 0 0 0 .5 6.2 31.6 31.6 0 0 0 .14 12a31.6 31.6 0 0 0 .36 5.8 3.02 3.02 0 0 0 2.13 2.14c1.87.36 9.37.36 9.37.36s7.5 0 9.37-.36a3.02 3.02 0 0 0 2.13-2.14A31.6 31.6 0 0 0 23.86 12a31.6 31.6 0 0 0-.36-5.8ZM9.75 15.57V8.43L15.84 12l-6.09 3.57Z" />
      </svg>
    ),
  },
] as const;

export function Footer() {
  return (
    <footer className="site-footer mt-auto border-t border-[#c9a227] bg-black/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex justify-center">
            <Logo size="footer" />
          </div>

          <ul className="flex flex-wrap items-center justify-center gap-3">
            {SOCIAL.map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={item.label}
                  title={item.label}
                  className="grid h-10 w-10 place-items-center rounded-full border border-[#c9a227]/60 text-[#f3d56a] hover:border-[#e0b422] hover:text-[#e0b422]"
                >
                  {item.icon}
                </a>
              </li>
            ))}
          </ul>

          <p className="text-xs text-white">
            <a href={`mailto:${DESK_EMAIL}`} className="hover:text-[#e0b422]">
              {DESK_EMAIL}
            </a>
          </p>
          <p className="text-xs text-white">
            © {new Date().getFullYear()} Forex Trading Consultants
          </p>
        </div>
      </div>
    </footer>
  );
}
