import {createContext,useContext} from 'react';

export type AppLanguage='sw'|'en';
export const LanguageContext=createContext<{language:AppLanguage;setLanguage:(v:AppLanguage)=>void;t:(sw:string,en:string)=>string}>({language:'sw',setLanguage:()=>{},t:(sw)=>sw});
export function useLanguage(){return useContext(LanguageContext)}
