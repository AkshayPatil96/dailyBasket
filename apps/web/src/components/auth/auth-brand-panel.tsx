import Image from "next/image";
import { Check, Leaf } from "lucide-react";

const FEATURES = [
  "Delivered to your door in under 30 minutes",
  "Handpicked fresh produce, every order",
  "Track your delivery live, right to the doorstep",
];

export function AuthBrandPanel() {
  return (
    <div className="relative hidden h-full flex-col justify-between overflow-hidden px-12 py-10 text-white [text-shadow:0_2px_10px_rgba(0,0,0,0.55)] lg:flex">
      <Image
        src="/images/auth/brand-panel.jpg"
        alt=""
        fill
        priority
        sizes="50vw"
        className="object-cover"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-b from-emerald-950/75 via-emerald-950/25 to-emerald-950/75"
        aria-hidden
      />

      <div className=""></div>

      <div className="relative flex flex-col gap-3">
        <h2 className="font-display text-3xl font-semibold leading-tight text-balance">
          Groceries, delivered fresh — fast.
        </h2>
        <p className="max-w-sm text-[15px] leading-relaxed text-white/80">
          Order from your neighborhood store and get it delivered before the ice
          cream melts.
        </p>
      </div>

      <ul className="relative flex flex-col gap-3">
        {FEATURES.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-3 text-[15px] text-white/90"
          >
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-white/15">
              <Check
                className="size-3"
                aria-hidden
              />
            </span>
            {feature}
          </li>
        ))}
      </ul>
    </div>
  );
}
