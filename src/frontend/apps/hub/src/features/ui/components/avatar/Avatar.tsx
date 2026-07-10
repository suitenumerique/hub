import clsx from "clsx";
import { ReactNode } from "react";

import { AvatarColor, hashAvatarColor } from "./palette";

const deriveInitials = (label: string): string => {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].charAt(0).toUpperCase();
  return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
};

export type AvatarSize = "sm" | "md" | "lg";

export type AvatarProps = {
  label: string;
  children?: ReactNode;
  variant?: "solid" | "soft";
  size?: AvatarSize;
  decorative?: boolean;
  /** Force a specific palette colour. Defaults to a hash of `label`. */
  color?: AvatarColor;
  className?: string;
};

export const Avatar = ({
  label,
  children,
  variant = "solid",
  size = "sm",
  decorative = false,
  color,
  className,
}: AvatarProps) => {
  const resolvedColor = color ?? hashAvatarColor(label);
  const a11yProps = decorative
    ? { "aria-hidden": true }
    : { role: "img", "aria-label": label };

  return (
    <span
      className={clsx(
        "hub__avatar",
        `hub__avatar--${size}`,
        `hub__avatar--${resolvedColor}`,
        variant === "soft" && "hub__avatar--soft",
        className,
      )}
      {...a11yProps}
    >
      {children ?? deriveInitials(label)}
    </span>
  );
};
