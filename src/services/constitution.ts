export type VerificationStatus='verified'|'pending'|'unavailable';

export interface SourceInfo {
  documentId:string;
  sourceLocator:string;
  verificationStatus:VerificationStatus;
}

export interface ConstitutionArticle {
  sura:string;
  ibara:number|string;
  jina:string;
  maudhui:string;
  vifungu:string[];
  sehemu?:string;
  chanzo:SourceInfo;
}

export interface ConstitutionChapter {
  sura:string;
  jina:string;
  documentId:string;
  chapterNumber:number;
  ibara:string[];
  sehemu:string[];
}

export interface ConstitutionSource {
  id:string;
  title:string;
  family:'official'|'draft';
  jurisdiction:'tanzania'|'zanzibar';
  basePath:string;
}

export const constitutionSources:ConstitutionSource[]=[
  {id:'doc-union-1977',title:'Katiba ya Jamhuri ya Muungano wa Tanzania',family:'official',jurisdiction:'tanzania',basePath:'/katiba/Katiba/Tanzania'},
  {id:'doc-zanzibar-1984',title:'Katiba ya Zanzibar',family:'official',jurisdiction:'zanzibar',basePath:'/katiba/Katiba/Zanzibar'},
  {id:'doc-rasimu-tanzania-2014',title:'Rasimu ya Katiba ya Tanzania',family:'draft',jurisdiction:'tanzania',basePath:'/katiba/Rasimu za Katiba/Tanzania'}
];

const chapterNames=[
  'Sura ya Kwanza','Sura ya Pili','Sura ya Tatu','Sura ya Nne','Sura ya Tano',
  'Sura ya Sita','Sura ya Saba','Sura ya Nane','Sura ya Tisa','Sura ya Kumi',
  'Sura ya Kumi na Moja','Sura ya Kumi na Mbili','Sura ya Kumi na Tatu',
  'Sura ya Kumi na Nne','Sura ya Kumi na Tano','Sura ya Kumi na Sita',
  'Sura ya Kumi na Saba','Sura ya Kumi na Nane','Sura ya Kumi na Tisa',
  'Sura ya Ishirini'
];

const jsonCache=new Map<string,Promise<unknown>>();

async function fetchJson<T>(url:string):Promise<T>{
  let request=jsonCache.get(url);
  if(!request){
    request=fetch(encodeURI(url)).then(async r=>{
      if(!r.ok) throw new Error('Faili ya Katiba haijapatikana: '+url);
      return r.json();
    });
    jsonCache.set(url,request);
  }
  return request as Promise<T>;
}

export function getSource(documentId:string){
  return constitutionSources.find(s=>s.id===documentId);
}

export async function loadChapters(documentId:string){
  const source=getSource(documentId);
  if(!source) return [];
  const chapters:ConstitutionChapter[]=[];
  for(const name of chapterNames){
    try{
      const chapter=await fetchJson<ConstitutionChapter>(`${source.basePath}/${name}/${name}.json`);
      if(chapter.documentId===documentId) chapters.push(chapter);
    }catch{}
  }
  return chapters.sort((a,b)=>a.chapterNumber-b.chapterNumber);
}

export async function loadArticle(documentId:string,chapterName:string,fileName:string){
  const source=getSource(documentId);
  if(!source) return undefined;
  try{
    return await fetchJson<ConstitutionArticle>(`${source.basePath}/${chapterName}/${fileName}`);
  }catch{
    return undefined;
  }
}

export async function loadAllArticles(documentId:string){
  const chapters=await loadChapters(documentId);
  const rows:ConstitutionArticle[]=[];
  for(const chapter of chapters){
    const loaded=await Promise.all(chapter.ibara.map(file=>loadArticle(documentId,chapter.sura,file)));
    rows.push(...loaded.filter((x):x is ConstitutionArticle=>Boolean(x)));
  }
  return rows;
}

export async function searchConstitution(query:string,documentId?:string){
  const q=query.trim().toLocaleLowerCase('sw');
  const sources=documentId?constitutionSources.filter(s=>s.id===documentId):constitutionSources;
  const groups=await Promise.all(sources.map(async source=>{
    const articles=await loadAllArticles(source.id);
    return articles.filter(a=>!q||[
      String(a.ibara),a.jina,a.sura,a.sehemu||'',a.maudhui,...(a.vifungu||[])
    ].join(' ').toLocaleLowerCase('sw').includes(q)).map(a=>({source,article:a}));
  }));
  return groups.flat();
}

export function articleFileName(articleNumber:number|string){
  return `Ibara ${articleNumber}.json`;
}
