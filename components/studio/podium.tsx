import { Character, ContactShadow } from "./character";
import { Rise } from "./motion";

// The top three, standing rather than listed. Height is the ranking: the winner
// is simply the tallest thing on the page, which is legible before any numeral
// is read.

export type PodiumPlace = {
  rank: 1 | 2 | 3;
  name: string;
  office: string | null;
  points: number;
};

const FORM = {
  1: { body: 280, frame: 310, card: 200, shadow: 220, order: "order-1 sm:order-2" },
  2: { body: 230, frame: 250, card: 170, shadow: 190, order: "order-2 sm:order-1" },
  3: { body: 212, frame: 230, card: 170, shadow: 180, order: "order-3" },
} as const;

export function Crown() {
  return (
    <span
      aria-hidden
      className="absolute left-1/2 top-[-20px] h-[22px] w-[34px] -translate-x-1/2 bg-stage-re"
      style={{
        clipPath:
          "polygon(0% 100%, 0% 45%, 18% 68%, 32% 8%, 50% 55%, 68% 8%, 82% 68%, 100% 45%, 100% 100%)",
        boxShadow: "0 2px 4px rgba(23,22,20,.15)",
      }}
    />
  );
}

export function Podium({ places }: { places: PodiumPlace[] }) {
  return (
    <ol className="flex flex-wrap items-end justify-center gap-8 sm:gap-16">
      {places.map((place, index) => {
        const form = FORM[place.rank];
        const first = place.rank === 1;

        return (
          <Rise
            key={place.name}
            delay={0.1 + index * 0.08}
            style={{ width: `min(100%, ${form.card + 50}px)` }}
            className={`flex flex-col items-center ${form.order}`}
          >
            <div
              className="relative flex items-end justify-center"
              style={{ height: form.frame }}
            >
              {first ? <Crown /> : null}
              <Character name={place.name} height={form.body} idle={first ? "bob" : "small"} />
            </div>

            <ContactShadow
              width={form.shadow}
              height={first ? 38 : 32}
              opacity={first ? 0.17 : 0.14}
            />

            <div
              style={{ width: form.card }}
              className={`-mt-2 rounded-[18px] bg-surface-raised p-4 text-center ${
                first ? "shadow-e3" : "shadow-e2"
              }`}
            >
              <p
                className={`tabular text-2xl font-bold ${first ? "text-re-ink" : "text-ink-faint"}`}
              >
                {place.rank}
              </p>
              <p className="mt-0.5 text-[15px] font-semibold text-ink">{place.name}</p>
              <p className="text-xs text-ink-secondary">{place.office ?? "No office"}</p>
              <p className="tabular mt-2 text-3xl font-bold text-ink">{place.points}</p>
            </div>
          </Rise>
        );
      })}
    </ol>
  );
}
