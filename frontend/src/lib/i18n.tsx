import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
type Language = 'bn' | 'en';
const Context = createContext<{language:Language;setLanguage:(l:Language)=>void;t:(bn:string,en:string)=>string}>({language:'bn',setLanguage:()=>{},t:bn=>bn});
export function LanguageProvider({children}:{children:ReactNode}) {
  const [language,setLanguage] = useState<Language>(() => localStorage.getItem('nextaka-language') === 'en' ? 'en' : 'bn');
  useEffect(()=>{localStorage.setItem('nextaka-language',language);document.documentElement.lang=language;},[language]);
  return <Context.Provider value={{language,setLanguage,t:(bn,en)=>language==='bn'?bn:en}}>{children}</Context.Provider>;
}
export const useLanguage=()=>useContext(Context);
