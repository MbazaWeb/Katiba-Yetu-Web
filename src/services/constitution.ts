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

const manifestCache:{promise?:Promise<string[]>}={};

async function loadManifestPaths(){
  if(!manifestCache.promise) manifestCache.promise=fetch('/katiba/snapshot.csv').then(async r=>{
    if(!r.ok) throw new Error('Katiba path manifest haijapatikana.');
    const text=await r.text();
    return text.split(/\r?\n/).slice(1).map(line=>{
      const match=line.match(/^"((?:[^"]|"")*)"/);
      return match?match[1].replace(/""/g,'"').replace(/\\/g,'/').replace(/^\//,''):'';
    }).filter(Boolean);
  });
  return manifestCache.promise;
}

function sourceManifestPrefix(source:ConstitutionSource){
  return source.basePath.replace(/^\/katiba\//,'').replace(/\/$/,'')+'/';
}

async function chapterManifest(source:ConstitutionSource){
  const paths=await loadManifestPaths();
  const prefix=sourceManifestPrefix(source);
  const names=new Set<string>();
  for(const path of paths){
    if(!path.startsWith(prefix)||!path.toLowerCase().endsWith('.json')) continue;
    const rest=path.slice(prefix.length),parts=rest.split('/');
    if(parts.length>=2&&parts[0]) names.add(parts[0]);
  }
  return [...names];
}

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
  let names:string[]=[];
  try{names=await chapterManifest(source)}catch{return chapters}
  for(const name of names){
    try{
      const chapter=await fetchJson<ConstitutionChapter>(`${source.basePath}/${name}/${name}.json`);
      if(chapter.documentId===documentId) chapters.push(chapter);
    }catch{}
  }
  return chapters.sort((a,b)=>(a.chapterNumber??Number.MAX_SAFE_INTEGER)-(b.chapterNumber??Number.MAX_SAFE_INTEGER)||a.sura.localeCompare(b.sura,'sw'));
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

export async function loadArticleByNumber(documentId:string,articleNumber:string){
  const chapters=await loadChapters(documentId);
  for(const chapter of chapters){
    const file=chapter.ibara.find(name=>name.replace(/^Ibara\s+/i,'').replace(/\.json$/i,'')===articleNumber);
    if(file){
      const article=await loadArticle(documentId,chapter.sura,file);
      if(article) return {article,chapter,fileName:file};
    }
  }
  return undefined;
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

export interface SourceIntegrityIssue {sourceId:string;chapter?:string;file?:string;kind:'missing_chapter_index'|'missing_article'|'unreferenced_article'|'invalid_json';message:string}
export interface SourceIntegrityReport {manifestFiles:number;jsonFiles:number;chapterIndexes:number;articleFiles:number;referencedArticles:number;issues:SourceIntegrityIssue[]}

export async function checkSourceIntegrity():Promise<SourceIntegrityReport>{
  const paths=await loadManifestPaths(),jsonPaths=paths.filter(p=>p.toLowerCase().endsWith('.json'));
  const issues:SourceIntegrityIssue[]=[];let chapterIndexes=0,articleFiles=0,referencedArticles=0;
  for(const source of constitutionSources){
    const prefix=sourceManifestPrefix(source),sourcePaths=jsonPaths.filter(p=>p.startsWith(prefix));
    const chapters=new Map<string,Set<string>>();
    for(const path of sourcePaths){const rest=path.slice(prefix.length),parts=rest.split('/');if(parts.length<2)continue;const [chapter,file]=parts;if(!chapters.has(chapter))chapters.set(chapter,new Set());chapters.get(chapter)!.add(file);if(/^Ibara .+\.json$/i.test(file))articleFiles++}
    for(const [chapter,files] of chapters){
      const indexFile=chapter+'.json';
      if(!files.has(indexFile)){issues.push({sourceId:source.id,chapter,file:indexFile,kind:'missing_chapter_index',message:'Chapter index haipo kwenye manifest.'});continue}
      chapterIndexes++;
      let data:ConstitutionChapter;
      try{data=await fetchJson<ConstitutionChapter>(source.basePath+'/'+chapter+'/'+indexFile)}catch{issues.push({sourceId:source.id,chapter,file:indexFile,kind:'invalid_json',message:'Chapter index haiwezi kusomwa kama JSON.'});continue}
      const refs=new Set(data.ibara||[]);referencedArticles+=refs.size;
      for(const file of refs)if(!files.has(file))issues.push({sourceId:source.id,chapter,file,kind:'missing_article',message:'Ibara imetajwa na chapter index lakini file haipo kwenye manifest.'});
      for(const file of files)if(/^Ibara .+\.json$/i.test(file)&&!refs.has(file))issues.push({sourceId:source.id,chapter,file,kind:'unreferenced_article',message:'Article file ipo kwenye manifest lakini haijatajwa na chapter index.'});
    }
  }
  return {manifestFiles:paths.length,jsonFiles:jsonPaths.length,chapterIndexes,articleFiles,referencedArticles,issues};
}

export function articleFileName(articleNumber:number|string){
  return `Ibara ${articleNumber}.json`;
}
