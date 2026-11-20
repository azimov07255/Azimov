// Public client-side Supabase settings (safe to commit: access is enforced by Row Level Security).
// To use your own project: create a project, run supabase/migrations/*.sql, then replace these two values.
export const SUPABASE_URL = 'https://dsfwagfsehpugjkervqc.supabase.co';
export const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRzZndhZ2ZzZWhwdWdqa2VydnFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3MjcwNTksImV4cCI6MjEwODMwMzA1OX0.-fUlJz-VU3Y3_PkpfHsbFkCFsRTCBeJJ5qXs-ZiAMq8';
export const SUPABASE_LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
export const AUTH_STORAGE_KEY = 'azimov.sb.auth';

// On-device OCR for receipts (Tesseract.js). Worker, WASM core and language data are fetched from the same CDN on first use.
export const TESS_LIB = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js';
export const TESS_LANGS = ['eng', 'rus'];
