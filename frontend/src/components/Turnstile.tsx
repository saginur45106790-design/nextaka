import { useEffect, useRef } from 'react';
import { useConfig } from './UI';
import { useLanguage } from '../lib/i18n';
declare global { interface Window { turnstile?: {render:(element:HTMLElement,options:Record<string,unknown>)=>string;remove:(id:string)=>void}; } }
let scriptPromise:Promise<void>|undefined;
function load(){scriptPromise??=new Promise<void>((resolve,reject)=>{if(window.turnstile){resolve();return;}const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.async=true;s.onload=()=>resolve();s.onerror=()=>{scriptPromise=undefined;reject(new Error('CAPTCHA unavailable'));};document.head.append(s);});return scriptPromise;}
export function Turnstile({action,onToken,reset=0}:{action:string;onToken:(token:string)=>void;reset?:number}){
  const ref=useRef<HTMLDivElement>(null);const {data}=useConfig();const {t}=useLanguage();const callback=useRef(onToken);callback.current=onToken;
  const key=data?.turnstileSiteKey||import.meta.env.VITE_TURNSTILE_SITE_KEY as string|undefined;
  useEffect(()=>{if(!key)return;let id:string|undefined;let cancelled=false;callback.current('');void load().then(()=>{if(cancelled||!ref.current)return;id=window.turnstile?.render(ref.current,{'sitekey':key,'action':action,'theme':'dark','size':'flexible','callback':(token:string)=>callback.current(token),'expired-callback':()=>callback.current(''),'error-callback':()=>callback.current('')});}).catch(()=>{if(ref.current)ref.current.textContent='CAPTCHA unavailable. Please reload.';});return()=>{cancelled=true;if(id)window.turnstile?.remove(id);};},[key,action,reset]);
  return key?<div className="captcha" ref={ref}/>:<p className="form-note" role="status">{t('CAPTCHA কনফিগার করা হয়নি। নিরাপত্তার জন্য authentication বন্ধ আছে।','CAPTCHA is not configured. Authentication is unavailable until setup is complete.')}</p>;
}
