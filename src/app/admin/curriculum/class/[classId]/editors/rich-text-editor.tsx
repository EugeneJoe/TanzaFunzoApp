"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useCallback, useEffect, useRef, useState } from "react";
import { Toggle } from "@/components/ui/toggle";
import { Bold, Italic, List, ListOrdered, Heading2 } from "lucide-react";
import { updateRichTextAction } from "../actions";

const AUTOSAVE_DELAY_MS = 800;

export function RichTextEditor({
  blockId,
  classId,
  initialDoc,
}: {
  blockId: string;
  classId: string;
  initialDoc: unknown;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialDoc as object,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "richtext-content min-h-24 px-3 py-2 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      setStatus("saving");
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(async () => {
        try {
          await updateRichTextAction(blockId, classId, editor.getJSON());
          setStatus("idle");
        } catch {
          setStatus("error");
        }
      }, AUTOSAVE_DELAY_MS);
    },
  });

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const toggle = useCallback((fn: () => void) => () => fn(), []);

  if (!editor) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1 border-b pb-2">
        <Toggle
          size="sm"
          pressed={editor.isActive("bold")}
          onPressedChange={toggle(() => editor.chain().focus().toggleBold().run())}
        >
          <Bold className="size-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("italic")}
          onPressedChange={toggle(() => editor.chain().focus().toggleItalic().run())}
        >
          <Italic className="size-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("heading", { level: 2 })}
          onPressedChange={toggle(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}
        >
          <Heading2 className="size-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("bulletList")}
          onPressedChange={toggle(() => editor.chain().focus().toggleBulletList().run())}
        >
          <List className="size-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("orderedList")}
          onPressedChange={toggle(() => editor.chain().focus().toggleOrderedList().run())}
        >
          <ListOrdered className="size-4" />
        </Toggle>
        <span className="ml-auto text-xs text-muted-foreground">
          {status === "saving" ? "Saving…" : status === "error" ? "Couldn't save" : ""}
        </span>
      </div>
      <EditorContent editor={editor} className="rounded-md border" />
    </div>
  );
}
