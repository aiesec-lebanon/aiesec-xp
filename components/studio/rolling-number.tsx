"use client";

import { m } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { useReduceMotion } from "@/components/motion/motion-provider";
import { formatPoints } from "@/lib/design/points";

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function RollingNumber({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  const reduceMotion = useReduceMotion();
  const previous = useRef(value);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    if (previous.current === value) return;
    setDirection(Math.sign(value - previous.current));
    previous.current = value;
  }, [value]);

  // Not rounded: a shared EP splits its points into fractions.
  const text = formatPoints(value);

  if (reduceMotion) return <span className={className}>{text}</span>;

  return (
    <span className={`inline-flex ${className}`} aria-label={text} role="text">
      {text.split("").map((character, index) => (
        <Digit
          key={`${text.length - index}`}
          character={character}
          delay={(text.length - index - 1) * 0.045}
          direction={direction}
        />
      ))}
    </span>
  );
}

function Digit({
  character,
  delay,
  direction,
}: {
  character: string;
  delay: number;
  direction: number;
}) {
  const index = DIGITS.indexOf(character);
  if (index < 0) return <span aria-hidden>{character}</span>;

  return (
    <span aria-hidden className="relative inline-block h-[1em] w-[0.62em] overflow-hidden align-baseline">
      <m.span
        className="absolute inset-x-0 top-0 flex flex-col items-center"
        // em, not %: a percentage is of the ten-digit column, not one digit.
        animate={{ y: `${-index}em` }}
        initial={{ y: `${-index}em` }}
        transition={{
          type: "spring",
          stiffness: direction === 0 ? 400 : 260,
          damping: 30,
          delay,
        }}
      >
        {DIGITS.map((digit) => (
          <span key={digit} className="block h-[1em] leading-[1em]">
            {digit}
          </span>
        ))}
      </m.span>
    </span>
  );
}
