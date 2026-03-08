import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface MentionUser {
  id: string;
  name: string;
}

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

/**
 * Mention format in stored text: @[Display Name](user-uuid)
 * While editing, user sees: @Display Name
 * Autocomplete triggers on typing "@"
 */
export function MentionTextarea({ value, onChange, placeholder, rows = 2, className }: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number>(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  const { data: users = [] } = useQuery({
    queryKey: ["mention-users"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, email")
        .eq("is_active", true);
      return (data ?? []).map((p: any) => ({
        id: p.user_id,
        name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Użytkownik",
      })) as MentionUser[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const filteredUsers = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return users.filter((u) => u.name.toLowerCase().includes(q)).slice(0, 8);
  }, [users, mentionQuery]);

  const updateDropdownPosition = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Position dropdown below the textarea
    const rect = textarea.getBoundingClientRect();
    setDropdownPosition({
      top: rect.height + 4,
      left: 0,
    });
  }, []);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    const cursorPos = e.target.selectionStart ?? 0;
    const textBeforeCursor = newValue.slice(0, cursorPos);

    // Find the last @ that isn't inside a completed mention
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    if (lastAtIndex === -1) {
      setMentionQuery(null);
      return;
    }

    // Check if the @ is at start or preceded by whitespace
    if (lastAtIndex > 0 && !/\s/.test(textBeforeCursor[lastAtIndex - 1])) {
      setMentionQuery(null);
      return;
    }

    // Check if there's a completed mention at this position (contains closing parenthesis)
    const textAfterAt = newValue.slice(lastAtIndex);
    const completedMentionMatch = textAfterAt.match(/^@\[.+?\]\(.+?\)/);
    if (completedMentionMatch) {
      setMentionQuery(null);
      return;
    }

    const query = textBeforeCursor.slice(lastAtIndex + 1);
    // If query contains newline, close dropdown
    if (query.includes("\n")) {
      setMentionQuery(null);
      return;
    }

    setMentionQuery(query);
    setMentionStart(lastAtIndex);
    setSelectedIndex(0);
    updateDropdownPosition();
  }, [onChange, updateDropdownPosition]);

  const insertMention = useCallback((user: MentionUser) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const before = value.slice(0, mentionStart);
    const cursorPos = textarea.selectionStart ?? value.length;
    const after = value.slice(cursorPos);

    const mention = `@[${user.name}](${user.id})`;
    const newValue = before + mention + " " + after;

    onChange(newValue);
    setMentionQuery(null);

    // Focus and set cursor after mention
    requestAnimationFrame(() => {
      if (textarea) {
        const newPos = before.length + mention.length + 1;
        textarea.focus();
        textarea.setSelectionRange(newPos, newPos);
      }
    });
  }, [value, mentionStart, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (mentionQuery === null || filteredUsers.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filteredUsers.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(filteredUsers[selectedIndex]);
    } else if (e.key === "Escape") {
      setMentionQuery(null);
    }
  }, [mentionQuery, filteredUsers, selectedIndex, insertMention]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          textareaRef.current && !textareaRef.current.contains(e.target as Node)) {
        setMentionQuery(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Convert mention format to display text for the textarea
  const displayValue = value;

  return (
    <div className="relative flex-1">
      <Textarea
        ref={textareaRef}
        value={displayValue}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={className}
      />
      {mentionQuery !== null && filteredUsers.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 bg-popover border border-border rounded-md shadow-lg py-1 max-h-48 overflow-y-auto w-64"
          style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
        >
          {filteredUsers.map((user, index) => (
            <button
              key={user.id}
              className={cn(
                "w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-accent transition-colors",
                index === selectedIndex && "bg-accent"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(user);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                {user.name[0]?.toUpperCase()}
              </div>
              <span className="truncate">{user.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Parse stored mention format @[Name](userId) and render with highlights.
 * Returns React nodes.
 */
export function renderCommentWithMentions(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      parts.push(<span key={`t-${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>);
    }
    // Add highlighted mention
    parts.push(
      <span
        key={`m-${match.index}`}
        className="text-primary font-medium bg-primary/10 px-1 rounded-sm"
      >
        @{match[1]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  // Remaining text - also handle legacy @name mentions
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    // Highlight legacy @mentions too
    const legacyParts = remaining.split(/(@\S+)/g);
    legacyParts.forEach((part, i) => {
      if (part.startsWith("@") && part.length > 1) {
        parts.push(
          <span key={`l-${lastIndex}-${i}`} className="text-primary font-medium bg-primary/10 px-0.5 rounded">
            {part}
          </span>
        );
      } else if (part) {
        parts.push(<span key={`r-${lastIndex}-${i}`}>{part}</span>);
      }
    });
  }

  return parts;
}

/**
 * Extract mentioned user IDs from the stored mention format @[Name](userId)
 */
export function extractMentionedUserIds(text: string): string[] {
  const ids: string[] = [];
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  let match;
  while ((match = mentionRegex.exec(text)) !== null) {
    ids.push(match[2]);
  }
  return ids;
}
