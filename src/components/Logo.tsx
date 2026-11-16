import Image from "next/image";
import Link from "next/link";

export function Logo({
  size = "header",
  showWordmark = true,
}: {
  size?: "header" | "footer";
  showWordmark?: boolean;
}) {
  const header = size === "header";
  const px = header ? 56 : 52;

  return (
    <Link
      href="/"
      className={
        header
          ? "flex min-w-0 shrink items-center gap-2 sm:gap-3"
          : "flex min-w-0 items-center gap-2.5 sm:gap-3"
      }
      aria-label="Forex Trading Consultants home"
    >
      <Image
        src="/logo.jpg"
        alt="Forex Trading Consultants"
        width={px}
        height={px}
        priority={header}
        sizes={header ? "56px" : "40px"}
        className={
          header
            ? "h-11 w-11 shrink-0 rounded-full object-cover ring-2 ring-[#e0b422] sm:h-14 sm:w-14"
            : "h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-[#e0b422] sm:h-10 sm:w-10"
        }
      />
      {showWordmark ? (
        <span
          className={
            header
              ? // Wordmark hidden on the narrowest phones so the circular mark always fits.
                "hidden min-w-0 truncate text-[15px] font-extrabold uppercase leading-none tracking-wide text-[#FFD700] min-[400px]:inline sm:text-xl"
              : "min-w-0 truncate text-[11px] font-bold uppercase leading-none tracking-wide text-[#FFD700] sm:text-sm"
          }
        >
          Forex Trading Consultants
        </span>
      ) : null}
    </Link>
  );
}
