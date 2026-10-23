import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { post } from '../lib/api';
export function useFinancialMutation<T>(path:string){
 const saved=useRef<{body:string;key:string}|null>(null);const client=useQueryClient();
 return useMutation({mutationFn:(body:unknown)=>{const serialized=JSON.stringify(body);if(saved.current?.body!==serialized)saved.current={body:serialized,key:crypto.randomUUID()};return post<T>(path,body,saved.current.key);},onSuccess:()=>{saved.current=null;void client.invalidateQueries();}});
}
