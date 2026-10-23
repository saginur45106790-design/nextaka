import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, post } from './api';
import type { User } from './types';
const Context = createContext<{user:User|null;loading:boolean;error:Error|null;refresh:()=>Promise<void>;logout:()=>Promise<void>}>({user:null,loading:true,error:null,refresh:async()=>{},logout:async()=>{}});
export function AuthProvider({children}:{children:ReactNode}) {
  const client=useQueryClient();
  const query=useQuery({queryKey:['auth'],queryFn:async()=>{try{return (await api<{user:User}>('/auth/me')).user;}catch(e){if(e instanceof ApiError&&e.status===401)return null;throw e;}},retry:false,staleTime:60000});
  const refresh=async()=>{await client.invalidateQueries({queryKey:['auth']});};
  const logout=async()=>{await post('/auth/logout',{});client.clear();await refresh();};
  return <Context.Provider value={{user:query.data??null,loading:query.isPending,error:query.error,refresh,logout}}>{children}</Context.Provider>;
}
export const useAuth=()=>useContext(Context);
