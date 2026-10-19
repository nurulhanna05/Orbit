"use client"

import NavLinks from './nav-links';

export default function Sidebar() {
  return (
    <div className="hidden md:flex fixed top-16 h-[calc(100vh-4rem)] w-64 flex-col border-r bg-card">
      <div className="flex h-full flex-col overflow-y-auto p-4 pt-6">
        <NavLinks />
      </div>
    </div>
  );
}
