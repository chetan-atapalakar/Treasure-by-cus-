import { supabase } from "./supabase";
import { DataError } from "./net";

export function db() {
  if (!supabase) throw new DataError("The database is not connected yet. Supabase needs to be configured.");
  return supabase;
}