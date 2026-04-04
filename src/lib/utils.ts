import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Pad activity codes to exactly 4 characters with trailing zeros. */
export function normalizeActivityCode(code: string): string {
  if (!code) return '0000';
  return code.padEnd(4, '0');
}
