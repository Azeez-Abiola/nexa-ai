import React, { useEffect, useMemo, useState } from "react";
import { BiPlus, BiSearch } from "react-icons/bi";
import {
  EMOJI_CATEGORIES,
  QUICK_REACTIONS,
  loadRecentReactions,
  saveRecentReaction,
  type EmojiCategory,
} from "./reactionEmojis";

type Props = {
  anchorX: number;
  anchorY: number;
  activeReaction?: string | null;
  onSelect: (emoji: string) => void;
  onClose: () => void;
};

export function ReactionEmojiPicker({ anchorX, anchorY, activeReaction, onSelect, onClose }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState(EMOJI_CATEGORIES[0].id);
  const [recent, setRecent] = useState<string[]>(() => loadRecentReactions());

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, onClose]);

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return EMOJI_CATEGORIES;
    return EMOJI_CATEGORIES.map((cat) => ({
      ...cat,
      emojis: cat.emojis.filter((e) => e.includes(q) || cat.label.toLowerCase().includes(q)),
    })).filter((cat) => cat.emojis.length > 0);
  }, [search]);

  const visibleCategory: EmojiCategory | undefined =
    filteredCategories.find((c) => c.id === activeCategory) || filteredCategories[0];

  const pick = (emoji: string) => {
    if (emoji !== activeReaction) {
      const next = saveRecentReaction(emoji);
      setRecent(next);
    }
    onSelect(emoji);
    onClose();
  };

  const left = Math.min(anchorX, window.innerWidth - (expanded ? 320 : 300));
  const top = Math.min(anchorY + 8, window.innerHeight - (expanded ? 380 : 56));

  return (
    <>
      <div className="reaction-picker-backdrop" onClick={onClose} />
      <div
        className={`reaction-picker-root${expanded ? " reaction-picker-root--expanded" : ""}`}
        style={{ left, top }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="reaction-quick-bar">
          <div className="reaction-quick-scroll" role="listbox" aria-label="Quick reactions">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={`reaction-quick-btn${activeReaction === emoji ? " reaction-quick-btn--active" : ""}`}
                onClick={() => pick(emoji)}
                aria-label={activeReaction === emoji ? `Remove ${emoji} reaction` : `React with ${emoji}`}
                aria-pressed={activeReaction === emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="reaction-plus-btn"
            aria-label="More reactions"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            <BiPlus size={20} />
          </button>
        </div>

        {expanded && (
          <div className="reaction-expanded-panel">
            <div className="reaction-search-wrap">
              <BiSearch size={16} className="reaction-search-icon" />
              <input
                type="search"
                className="reaction-search-input"
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            {recent.length > 0 && !search.trim() && (
              <div className="reaction-section">
                <div className="reaction-section-label">Recent reactions</div>
                <div className="reaction-grid">
                  {recent.map((emoji) => (
                    <button
                      key={`recent-${emoji}`}
                      type="button"
                      className={`reaction-grid-btn${activeReaction === emoji ? " reaction-grid-btn--active" : ""}`}
                      onClick={() => pick(emoji)}
                      aria-pressed={activeReaction === emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {visibleCategory && (
              <div className="reaction-section reaction-section--scroll">
                <div className="reaction-section-label">{visibleCategory.label}</div>
                <div className="reaction-grid">
                  {visibleCategory.emojis.map((emoji) => (
                    <button
                      key={`${visibleCategory.id}-${emoji}`}
                      type="button"
                      className={`reaction-grid-btn${activeReaction === emoji ? " reaction-grid-btn--active" : ""}`}
                      onClick={() => pick(emoji)}
                      aria-pressed={activeReaction === emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="reaction-category-tabs" role="tablist">
              {EMOJI_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === cat.id}
                  className={`reaction-category-tab${activeCategory === cat.id ? " active" : ""}`}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setSearch("");
                  }}
                  title={cat.label}
                >
                  {cat.tab}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
