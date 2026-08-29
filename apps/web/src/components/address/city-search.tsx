'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { searchCity, type CityResult } from '@/lib/nominatim-api';

// Debounced above Nominatim's ~1req/sec fair-use limit.
const DEBOUNCE_MS = 700;

export function CitySearch({
  onSelect,
  disabled,
}: {
  onSelect: (city: CityResult) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CityResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!query.trim()) {
        setResults([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      searchCity(query)
        .then(setResults)
        .finally(() => setIsSearching(false));
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-(--color-foreground)">Search for your city</label>
      <Combobox<CityResult>
        items={results}
        filter={null}
        itemToStringLabel={(city) => city.city || city.displayName}
        onInputValueChange={(value) => setQuery(value)}
        onValueChange={(city) => {
          if (city) onSelect(city);
        }}
      >
        <ComboboxInput
          placeholder="e.g. Mumbai"
          showTrigger={false}
          disabled={disabled}
          className="h-12 rounded-(--radius-inner) [&_input]:h-12 [&_input]:px-4 [&_input]:text-[15px]"
        />
        <ComboboxContent>
          <ComboboxEmpty>{isSearching ? 'Searching…' : 'No matches — try a different search'}</ComboboxEmpty>
          <ComboboxList>
            {results.map((city, index) => (
              <ComboboxItem key={`${city.displayName}-${index}`} value={city}>
                <Search className="size-3.5 shrink-0 text-(--color-muted-foreground)" aria-hidden />
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate">{city.city || city.displayName}</span>
                  <span className="truncate text-xs text-(--color-muted-foreground)">
                    {[city.state, city.country].filter(Boolean).join(', ')}
                  </span>
                </div>
              </ComboboxItem>
            ))}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  );
}
