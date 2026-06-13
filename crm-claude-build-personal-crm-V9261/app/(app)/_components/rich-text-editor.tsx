"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Bold, Italic, List, Link as LinkIcon, User, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

// Template variables substituted server-side per recipient at send time.
// Keep these strings in sync with substituteVariables() in
// app/api/broadcast/send/route.ts.
export const VAR_FIRST_NAME = "{{first_name}}";
export const VAR_UPDATE_URL = "{{update_url}}";

// Rich-text editor for the broadcast body. Outputs HTML. Variables show up as
// plain mustache placeholders inside the editor; we substitute them on send.
export function RichTextEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (html: string) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        autolink: true,
        // Allow our template-variable href ({{update_url}}) — it isn't a real
        // URL, but it survives serialization and gets replaced on send.
        validate: () => true,
      }),
    ],
    content: value || "<p></p>",
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: [
          "min-h-[200px] rounded-md border bg-background p-3 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-ring/20",
          // Lightweight content styling — no typography plugin needed.
          "[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2",
          "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2",
          "[&_li]:my-0.5",
          "[&_a]:text-blue-600 [&_a]:underline",
          "[&_strong]:font-semibold",
        ].join(" "),
      },
    },
    // Avoid SSR hydration warnings — render only on the client.
    immediatelyRender: false,
  });

  if (!editor) return null;

  return (
    <div className="space-y-2">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
      <p className="text-xs text-muted-foreground">
        Variables get replaced per recipient on send: <code>{VAR_FIRST_NAME}</code> → first name ·{" "}
        <code>{VAR_UPDATE_URL}</code> → their contact-update link.
      </p>
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const insert = (text: string) => editor.chain().focus().insertContent(text).run();
  const promptLink = () => {
    const existing = editor.getAttributes("link").href ?? "";
    const url = window.prompt(
      "Link URL — use {{update_url}} to make it the recipient's contact-edit link:",
      existing,
    );
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };
  const insertUpdateUrlLink = () => {
    const sel = editor.state.selection;
    const empty = sel.empty;
    if (empty) {
      // Drop the placeholder text "update your info" so there's something to click.
      editor
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: "update your info",
          marks: [{ type: "link", attrs: { href: VAR_UPDATE_URL } }],
        })
        .run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href: VAR_UPDATE_URL }).run();
    }
  };

  const btn = "h-8 px-2";
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 p-1">
      <Button
        type="button"
        size="sm"
        variant={editor.isActive("bold") ? "default" : "ghost"}
        className={btn}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (⌘B)"
      >
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant={editor.isActive("italic") ? "default" : "ghost"}
        className={btn}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (⌘I)"
      >
        <Italic className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant={editor.isActive("bulletList") ? "default" : "ghost"}
        className={btn}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet list"
      >
        <List className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        size="sm"
        variant={editor.isActive("link") ? "default" : "ghost"}
        className={btn}
        onClick={promptLink}
        title="Link…"
      >
        <LinkIcon className="h-3.5 w-3.5" />
      </Button>

      <span className="mx-1 h-5 w-px bg-border" aria-hidden />

      <Button
        type="button"
        size="sm"
        variant="ghost"
        className={`${btn} text-xs`}
        onClick={() => insert(VAR_FIRST_NAME)}
        title="Insert the recipient's first name"
      >
        <User className="h-3.5 w-3.5" /> First name
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className={`${btn} text-xs`}
        onClick={insertUpdateUrlLink}
        title="Insert a link to the recipient's contact-update page"
      >
        <ExternalLink className="h-3.5 w-3.5" /> Contact link
      </Button>
    </div>
  );
}
