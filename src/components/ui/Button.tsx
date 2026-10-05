import type { ComponentProps } from "react";
import styles from "./controls.module.css";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "choice";
type ButtonSize = "sm" | "md" | "lg";
interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  fullWidth?: boolean;
  className?: string;
}

/** Use the same visual contract for native buttons and navigation links. */
export function buttonStyles({ variant = "secondary", size = "md", iconOnly = false, fullWidth = false, className = "" }: ButtonStyleOptions = {}) {
  return [styles.button, variant !== "secondary" && styles[variant], size !== "md" && styles[size], iconOnly && styles.icon, fullWidth && styles.block, className].filter(Boolean).join(" ");
}

export type ButtonProps = ComponentProps<"button"> & ButtonStyleOptions;

export function Button({ variant, size, iconOnly, fullWidth, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonStyles({ variant, size, iconOnly, fullWidth, className })} {...props} />;
}
