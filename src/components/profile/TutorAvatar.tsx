import Image from "next/image";
import { cn } from "@/lib/utils";

interface Props {
  name:      string | null;
  avatarUrl: string | null;
  size:      number;       // px
  className?: string;
}

/** Tutor photo, or their initials on a brand circle when there isn't one. */
export function TutorAvatar({ name, avatarUrl, size, className }: Props) {
  const initials = (name ?? "?").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div
      className={cn("relative flex-shrink-0 overflow-hidden rounded-full bg-brand-500", className)}
      style={{ width: size, height: size }}
    >
      {avatarUrl ? (
        <Image src={avatarUrl} alt={name ?? "Tutor"} fill sizes={`${size}px`} className="object-cover" />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center font-display font-bold text-white"
          style={{ fontSize: Math.round(size * 0.36) }}
          aria-hidden
        >
          {initials}
        </span>
      )}
    </div>
  );
}
