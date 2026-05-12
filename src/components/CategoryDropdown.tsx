"use client";

import { useState, useEffect, useRef } from "react";
import { Category } from "@/types";

interface CategoryDropdownProps {
  value: number | null;
  onChange: (categoryId: number | null, categoryName?: string) => void;
  refreshKey?: number;
  categoryName?: string;
  suggestedCategory?: { id: number; name: string } | null;
}

export function CategoryDropdown({ value, onChange, refreshKey, categoryName, suggestedCategory }: CategoryDropdownProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCategories(data);
        }
      })
      .catch(console.error);
  }, [refreshKey]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasAutoSelected = useRef(false);

  useEffect(() => {
    if (!value && suggestedCategory && !hasAutoSelected.current) {
      onChange(suggestedCategory.id);
      hasAutoSelected.current = true;
    }
  }, [suggestedCategory, value, onChange]);

  const selectedCategory = value
    ? categories.find((c) => c.id === value) || null
    : null;

  const filteredCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(search.toLowerCase())
  );

  const showCreateOption =
    search.trim() !== "" &&
    !filteredCategories.some(
      (cat) => cat.name.toLowerCase() === search.trim().toLowerCase()
    );

  const handleSelect = (category: Category) => {
    setSearch("");
    setIsOpen(false);
    onChange(category.id);
  };

  const handleCreate = () => {
    const normalizedName = search.trim().toLowerCase();
    onChange(null, normalizedName);
    setSearch("");
    setIsOpen(false);
  };

  const handleClear = () => {
    setSearch("");
    onChange(null, undefined);
  };

  const displayCategory = selectedCategory || (categoryName ? { id: 0, name: categoryName } as Category : null);

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="flex items-center gap-2">
        {displayCategory ? (
          <div className="flex-1 flex items-center justify-between px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200">
            <div className="flex items-center gap-2">
              <span>{displayCategory.name}</span>
              {suggestedCategory && value === suggestedCategory.id && (
                <span className="text-xs text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                  Suggested
                </span>
              )}
            </div>
            <button
              onClick={handleClear}
              className="text-zinc-400 hover:text-zinc-200"
            >
              ×
            </button>
          </div>
        ) : (
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setIsOpen(true)}
              placeholder="Type to search or create category..."
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
            {isOpen && (
              <div className="absolute z-10 w-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredCategories.length > 0 && (
                  <ul>
                    {filteredCategories.map((category) => (
                      <li
                        key={category.id}
                        onClick={() => handleSelect(category)}
                        className="px-3 py-2 hover:bg-zinc-700 cursor-pointer text-zinc-200"
                      >
                        {category.name}
                      </li>
                    ))}
                  </ul>
                )}
                {showCreateOption && (
                  <div
                    onClick={handleCreate}
                    className="px-3 py-2 hover:bg-zinc-700 cursor-pointer text-blue-400 border-t border-zinc-700"
                  >
                    Create new category: &quot;{search.trim()}&quot;
                  </div>
                )}
                {filteredCategories.length === 0 && !showCreateOption && (
                  <div className="px-3 py-2 text-zinc-500">
                    No categories found. Type to create one.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {!selectedCategory && (
          <button
            onClick={() => {
              setIsOpen(!isOpen);
              if (!isOpen) {
                inputRef.current?.focus();
              }
            }}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-400 hover:text-zinc-200"
          >
            ▼
          </button>
        )}
      </div>
    </div>
  );
}
