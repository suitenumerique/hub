export interface User {
  id: string;
  email: string;
  full_name?: string;
  short_name?: string;
  language: string | null;
  last_release_note_seen?: string | null;
}
