"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const headerLinks = [
  { label: "Roles", href: "#roles" },
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "About", href: "/about" },
  { label: "Explore", href: "/features" },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const sectionIds = ["roles", "features", "how-it-works"];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: "-80px 0px -70% 0px" }
    );
    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur transition-all duration-200 ${
        scrolled ? "shadow-sm" : "shadow-none"
      }`}
    >
      <nav aria-label="Main navigation" className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight sm:text-xl" aria-label="CampusHub home">
          <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-700 text-sm font-extrabold text-white">
            C
          </span>
          <span>
            Campus<span className="text-blue-700">Hub</span>
          </span>
        </Link>

        <div className="hidden items-center gap-3 lg:flex">
          {headerLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition ${link.href.startsWith("#") && activeSection === link.href.slice(1) ? "rounded-md px-2 py-1 text-blue-700 shadow-[0_2px_8px_-2px_rgba(30,64,175,0.2)]" : "text-slate-600 hover:text-blue-700"}`}
            >
              {link.label}
            </Link>
          ))}
          <div className="ml-3 flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800"
            >
              Log in
            </Link>
            <Link href="/forgot-password" className="text-sm font-semibold text-slate-600 transition hover:text-blue-700">
              Forgot password?
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <Link
            href="/login"
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800"
          >
            Log in
          </Link>
          <button
            type="button"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-blue-200 hover:text-blue-700"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d={menuOpen ? "M6 18 18 6M6 6l12 12" : "M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"} />
            </svg>
          </button>
        </div>
      </nav>

      {menuOpen ? (
        <div className="border-t border-slate-200 bg-white lg:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6">
            {headerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${link.href.startsWith("#") && activeSection === link.href.slice(1) ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-100 hover:text-blue-700"}`}
              >
                {link.label}
              </Link>
            ))}
            <Link href="/forgot-password" onClick={() => setMenuOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50">
              Forgot password?
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
