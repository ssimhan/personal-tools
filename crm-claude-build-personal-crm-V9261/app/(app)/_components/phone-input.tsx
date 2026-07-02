"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

export interface Country { key: string; flag: string; dial: string; name: string }

// Curated list of common country codes. `key` disambiguates US vs Canada
// (both +1). Order roughly tracks expected frequency.
export const COUNTRIES: Country[] = [
  { key: "US", flag: "🇺🇸", dial: "+1",   name: "United States" },
  { key: "CA", flag: "🇨🇦", dial: "+1",   name: "Canada" },
  { key: "GB", flag: "🇬🇧", dial: "+44",  name: "United Kingdom" },
  { key: "MX", flag: "🇲🇽", dial: "+52",  name: "Mexico" },
  { key: "IN", flag: "🇮🇳", dial: "+91",  name: "India" },
  { key: "AU", flag: "🇦🇺", dial: "+61",  name: "Australia" },
  { key: "DE", flag: "🇩🇪", dial: "+49",  name: "Germany" },
  { key: "FR", flag: "🇫🇷", dial: "+33",  name: "France" },
  { key: "ES", flag: "🇪🇸", dial: "+34",  name: "Spain" },
  { key: "IT", flag: "🇮🇹", dial: "+39",  name: "Italy" },
  { key: "NL", flag: "🇳🇱", dial: "+31",  name: "Netherlands" },
  { key: "IL", flag: "🇮🇱", dial: "+972", name: "Israel" },
  { key: "BR", flag: "🇧🇷", dial: "+55",  name: "Brazil" },
  { key: "AR", flag: "🇦🇷", dial: "+54",  name: "Argentina" },
  { key: "JP", flag: "🇯🇵", dial: "+81",  name: "Japan" },
  { key: "KR", flag: "🇰🇷", dial: "+82",  name: "South Korea" },
  { key: "CN", flag: "🇨🇳", dial: "+86",  name: "China" },
  { key: "SG", flag: "🇸🇬", dial: "+65",  name: "Singapore" },
  { key: "ZA", flag: "🇿🇦", dial: "+27",  name: "South Africa" },
  { key: "AE", flag: "🇦🇪", dial: "+971", name: "UAE" },
];

// Parse an existing phone_number into (country, local). Defaults to US when no
// recognized dial code prefix is found. Longest dial-code match first so e.g.
// "+972" is preferred over "+9" / "+97" / etc.
export function parsePhone(raw: string | null): { country: Country; local: string } {
  const trimmed = (raw ?? "").trim();
  if (trimmed.startsWith("+")) {
    const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
    for (const c of sorted) {
      if (trimmed.startsWith(c.dial)) {
        return { country: c, local: trimmed.slice(c.dial.length).trim() };
      }
    }
  }
  return { country: COUNTRIES[0], local: trimmed };
}

export function combinePhone(countryKey: string, local: string): string {
  const country = COUNTRIES.find((c) => c.key === countryKey) ?? COUNTRIES[0];
  const trimmed = local.trim();
  return trimmed ? `${country.dial} ${trimmed}` : "";
}

// Compact country picker (flag + dial code only; the country name lives in the
// option's title for tooltip but not in the visible label, so the closed
// select stays narrow) + local phone-number input. Reports the combined value
// back to the parent on every change.
export function PhoneInput({
  initialValue,
  onChange,
  inputClassName = "",
}: {
  initialValue: string;
  onChange: (combined: string) => void;
  inputClassName?: string;
}) {
  // Parse once at mount — parent owns the canonical combined string after that.
  const parsedRef = useRef(parsePhone(initialValue));
  const [countryKey, setCountryKey] = useState(parsedRef.current.country.key);
  const [local, setLocal] = useState(parsedRef.current.local);

  // Skip the very first notification so we don't clobber the parent's state
  // with a synthetic onChange before the user has touched anything.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    onChange(combinePhone(countryKey, local));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryKey, local]);

  return (
    <div className="flex gap-2">
      <select
        value={countryKey}
        onChange={(e) => setCountryKey(e.target.value)}
        className="h-9 rounded-md border bg-transparent px-2 text-sm shrink-0"
        aria-label="Country code"
        title="Country code"
      >
        {COUNTRIES.map((c) => (
          <option key={c.key} value={c.key} title={c.name}>
            {c.flag} {c.dial}
          </option>
        ))}
      </select>
      <Input
        type="tel"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder="555 555 5555"
        className={`flex-1 ${inputClassName}`}
      />
    </div>
  );
}
