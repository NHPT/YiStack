"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { createBrowserSupabaseClient } from "../lib/supabase/client";
import type { Database } from "../lib/supabase/database.types";

type Note = Database["public"]["Tables"]["notes"]["Row"];

const demoNotes: Note[] = [{
  id: "demo-note",
  user_id: "demo-user",
  title: "Private demo note",
  created_at: "2026-08-28T00:00:00Z",
  updated_at: "2026-08-28T00:00:00Z",
}];

export default function Page() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState<Note[]>(supabase ? [] : demoNotes);
  const [userID, setUserID] = useState<string | null>(null);
  const [message, setMessage] = useState(supabase ? "Sign in to load your notes." : "Local demo mode");

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      setUserID(data.user?.id ?? null);
    });
  }, [supabase]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (!supabase) {
      setMessage("Configure Supabase to sign in.");
      return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMessage(error.message);
      return;
    }
    setUserID(data.user.id);
    setMessage("Signed in");
    await loadNotes();
  }

  async function loadNotes() {
    if (!supabase) return;
    const { data, error } = await supabase.from("notes").select("*").order("created_at");
    if (error) {
      setMessage(error.message);
      return;
    }
    setNotes((data ?? []) as Note[]);
  }

  async function createNote(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !userID || !title.trim()) return;
    const { error } = await supabase.from("notes").insert({ user_id: userID, title: title.trim() });
    if (error) {
      setMessage(error.message);
      return;
    }
    setTitle("");
    await loadNotes();
  }

  async function renameNote(note: Note) {
    if (!supabase) return;
    await supabase.from("notes").update({ title: `${note.title} updated` }).eq("id", note.id);
    await loadNotes();
  }

  async function deleteNote(note: Note) {
    if (!supabase) return;
    await supabase.from("notes").delete().eq("id", note.id);
    await loadNotes();
  }

  return (
    <main>
      <h1>Private Notes</h1>
      <p>{message}</p>
      <form onSubmit={signIn}>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
        </label>
        <label>
          Password
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
        </label>
        <button type="submit">Sign in</button>
      </form>
      <form onSubmit={createNote}>
        <label>
          Note title
          <input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <button type="submit" disabled={!userID}>Create note</button>
      </form>
      <ul>
        {notes.map((note) => (
          <li key={note.id}>
            <span>{note.title}</span>
            <button type="button" onClick={() => void renameNote(note)}>Rename</button>
            <button type="button" onClick={() => void deleteNote(note)}>Delete</button>
          </li>
        ))}
      </ul>
    </main>
  );
}
