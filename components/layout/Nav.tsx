"use client";

import { useState, useEffect } from "react";
import "./Nav.css";

export function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <>
      <nav className="nav">
        <a href="https://o1lab.xyz" className="nav-logo">
          o1 <span>lab</span>
        </a>
        <ul className="nav-links">
          <li><a href="https://o1lab.space">Space</a></li>
          <li><a href="/" className="nav-link--active">Store</a></li>
          <li><a href="https://o1lab.shop">Shop</a></li>
        </ul>
        <button
          className={`mobile-menu-btn${menuOpen ? " open" : ""}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Menu"
        >
          <span /><span /><span />
        </button>
      </nav>

      <div className={`mobile-menu${menuOpen ? " open" : ""}`}>
        <a href="https://o1lab.space" onClick={() => setMenuOpen(false)}>Space</a>
        <a href="/" onClick={() => setMenuOpen(false)}>Store</a>
        <a href="https://o1lab.shop" onClick={() => setMenuOpen(false)}>Shop</a>
      </div>
    </>
  );
}
