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

// Label-or-decorative is required by the type so an unnamed, unhidden icon can't be written.
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
