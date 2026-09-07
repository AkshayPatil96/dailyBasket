"use client";

import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { settingsApi } from "@/lib/settings-api";
import { CUSTOMER_CHROME_HIDDEN_PREFIXES } from "@/lib/layout-constants";

export function SiteBanner() {
  const pathname = usePathname();
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: settingsApi.get,
    staleTime: 60_000,
  });

  if (
    CUSTOMER_CHROME_HIDDEN_PREFIXES.some((prefix) => pathname?.startsWith(prefix))
  ) {
    return null;
  }
  if (!settings?.bannerText) {
    return null;
  }

  return (
    <div className="flex items-center justify-center gap-2 bg-primary px-4 py-2 text-center text-sm font-medium text-primary-foreground">
      <Megaphone className="size-4 shrink-0" aria-hidden />
      <span>{settings.bannerText}</span>
    </div>
  );
}
