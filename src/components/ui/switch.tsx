"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { IconLockFilled } from "@tabler/icons-react";

export interface SwitchProps {
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  className?: string;
  variant?: "default" | "success" | "locked";
  size?: "default" | "lg";
}

export const Switch: React.FC<SwitchProps> = ({ defaultChecked = false, onChange, className, variant = "default", size = "default" }) => {
  const [checked, setChecked] = useState(defaultChecked);

  const toggle = () => {
    const newVal = !checked;
    setChecked(newVal);
    onChange?.(newVal);
  };

  const variants = {
    default: "data-[state=checked]:bg-neutral-900",
    success: "data-[state=checked]:bg-green-500",
    locked: "data-[state=checked]:bg-green-500",
  };

  const sizes = {
    default: "h-6 w-11",
    lg: "h-7 w-14",
  };

  const thumbSizes = {
    default: "h-5 w-5 data-[state=checked]:translate-x-5",
    lg: "h-6 w-6 data-[state=checked]:translate-x-7",
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
        checked ? variants[variant] : "bg-neutral-300",
        sizes[size],
        className
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
          checked ? thumbSizes[size] : "translate-x-1"
        )}
      >
        {variant === "locked" && checked && (
          <IconLockFilled className={cn(
            "text-neutral-900",
            size === "default" ? "h-3 w-3" : "h-4 w-4"
          )} />
        )}
      </span>
    </button>
  );
}; 