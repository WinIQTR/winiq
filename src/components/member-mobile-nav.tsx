"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";

import { useLanguage } from "@/components/language-provider";
import shell from "@/components/member-shell.module.css";

export type MemberNavItem = {
  href: string;
  label: string;
  active: boolean;
};

export function MemberMobileNav({ items }: { items: MemberNavItem[] }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className={shell.menuBtn}
        aria-expanded={open}
        aria-controls={titleId}
        aria-label={t("Open menu")}
        onClick={() => setOpen(true)}
      >
        <span aria-hidden>☰</span>
      </button>

      {open ? (
        <div className={shell.drawerRoot}>
          <button
            type="button"
            className={shell.drawerBackdrop}
            aria-label={t("Close menu")}
            onClick={() => setOpen(false)}
          />
          <nav className={shell.drawer} id={titleId} aria-label={t("Member menu")}>
            <div className={shell.drawerHead}>
              <strong data-no-translate>
                WIN<span>IQ</span>
              </strong>
              <button type="button" className={shell.drawerClose} onClick={() => setOpen(false)}>
                {t("Close")}
              </button>
            </div>
            <ul className={shell.drawerList}>
              {items.map((item) => (
                <li key={`${item.href}-${item.label}`}>
                  <Link
                    href={item.href}
                    data-active={item.active}
                    onClick={() => setOpen(false)}
                  >
                    {t(item.label)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      ) : null}
    </>
  );
}
