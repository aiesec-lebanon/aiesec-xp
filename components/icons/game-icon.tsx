import type { ComponentType, CSSProperties, SVGProps } from "react";

export type GameIconComponent = ComponentType<SVGProps<SVGSVGElement>>;

type Labelled = { label: string; decorative?: false };
type Decorative = { decorative: true; label?: never };

export type GameIconProps = {
  icon: GameIconComponent;
  className?: string;
  style?: CSSProperties;
  size?: number | string;
} & (Labelled | Decorative);

// An icon is either information or ornament, and the two need opposite treatment
// in the accessibility tree. Making it a required choice in the type means a
// nameless, unhidden icon -- the one that reads out as "graphic" to a screen
// reader -- cannot be written by accident.
export function GameIcon({ icon: Icon, label, decorative, className, style, size }: GameIconProps) {
  if (decorative) {
    return (
      <Icon
        aria-hidden
        focusable="false"
        className={className}
        style={style}
        width={size}
        height={size}
      />
    );
  }

  return (
    <Icon
      role="img"
      aria-label={label}
      focusable="false"
      className={className}
      style={style}
      width={size}
      height={size}
    />
  );
}
