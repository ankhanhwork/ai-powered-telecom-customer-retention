import {createClient} from '@supabase/supabase-js';
export const supabase=createClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
export async function rpc(name,args={}) {
  const {data,error}=await supabase.rpc(name,args);
  if(error) throw error;
  return data;
}
export async function read(table,columns='*') {
  const {data,error}=await supabase.from(table).select(columns);
  if(error) throw error;
  return data;
}
