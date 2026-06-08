"use client";

import { useEffect } from "react";

export function HydrationSafeZone() {
  useEffect(() => {
    const clean = () => {
      const el = document.getElementById("brk_yuan");
      if (el) {
        el.removeAttribute("id");
        el.removeAttribute("hidden");
      }
    };

    clean();

    const observer = new MutationObserver(() => clean());
    observer.observe(document.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: ["id", "hidden"],
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
