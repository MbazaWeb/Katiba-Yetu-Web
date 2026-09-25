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
  sura?:string;
  chapter?:string;
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
  language?:'sw'|'en';
  basePath:string;
  year:string;
  edition:string;
}

export const constitutionSources:ConstitutionSource[]=[
  {id:'doc-union-1977',title:'Katiba ya Jamhuri ya Muungano wa Tanzania',family:'official',jurisdiction:'tanzania',language:'sw',basePath:'/katiba/Katiba/Tanzania',year:'1977',edition:'Toleo la 2000'},
  {id:'doc-union-1977-en',title:'Constitution of the United Republic of Tanzania',family:'official',jurisdiction:'tanzania',language:'en',basePath:'/katiba/Katiba/Tanzania-English',year:'1977',edition:'English edition — conversion in progress'},
  {id:'doc-zanzibar-1984',title:'Katiba ya Zanzibar',family:'official',jurisdiction:'zanzibar',language:'sw',basePath:'/katiba/Katiba/Zanzibar',year:'1984',edition:'Toleo la 2020'},
  {id:'doc-rasimu-tanzania-2014',title:'Rasimu ya Katiba ya Tanzania',family:'draft',jurisdiction:'tanzania',language:'sw',basePath:'/katiba/Rasimu za Katiba/Tanzania',year:'2014',edition:'Rasimu / Toleo la 2014'}
];

const manifestCache:{promise?:Promise<string[]>}={};

async function loadManifestPaths(){
  if(!manifestCache.promise) manifestCache.promise=fetch('/katiba/snapshot.csv').then(async r=>{
    if(!r.ok) throw new Error('Katiba path manifest haijapatikana.');
    const text=(await r.text()).replace(/^\uFEFF/,'');
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
      const text=await r.text();
      return JSON.parse(text.charCodeAt(0)===0xFEFF?text.slice(1):text);
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
  return chapters.sort((a,b)=>(a.chapterNumber??Number.MAX_SAFE_INTEGER)-(b.chapterNumber??Number.MAX_SAFE_INTEGER)||String((a as any).sura||(a as any).chapter||'').localeCompare(String((b as any).sura||(b as any).chapter||''),'sw'));
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
    const file=chapter.ibara.find(name=>name.replace(/^(?:Ibara|Article)\s+/i,'').replace(/\.json$/i,'')===articleNumber);
    if(file){
      const chapterName=(chapter as any).sura||(chapter as any).chapter;
      const article=await loadArticle(documentId,chapterName,file);
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
  if(!q) return [];
  const tokens=q.split(/\s+/).filter(Boolean);
  const sources=documentId?constitutionSources.filter(s=>s.id===documentId):constitutionSources;
  const groups=await Promise.all(sources.map(async source=>{
    const articles=await loadAllArticles(source.id);
    return articles.map(article=>{
      const number=String(article.ibara).toLocaleLowerCase('sw'),title=(article.jina||'').toLocaleLowerCase('sw'),chapter=(article.sura||'').toLocaleLowerCase('sw'),part=(article.sehemu||'').toLocaleLowerCase('sw'),body=[article.maudhui,...(article.vifungu||[])].join(' ').toLocaleLowerCase('sw');
      const searchable=[number,title,chapter,part,body].join(' ');
      if(!tokens.every(token=>searchable.includes(token))) return null;
      let score=0;
      if(number===q||('ibara '+number)===q)score+=1000;
      if(title===q)score+=800;
      if(title.startsWith(q))score+=500;
      if(title.includes(q))score+=300;
      if(chapter.includes(q)||part.includes(q))score+=150;
      if(body.includes(q))score+=80;
      for(const token of tokens){if(number===token)score+=180;if(title.includes(token))score+=60;if(body.includes(token))score+=10}
      return {source,article,score};
    }).filter((x):x is {source:ConstitutionSource;article:ConstitutionArticle;score:number}=>Boolean(x));
  }));
  return groups.flat().sort((a,b)=>b.score-a.score||String(a.article.ibara).localeCompare(String(b.article.ibara),undefined,{numeric:true}));
}

export interface SourceIntegrityIssue {sourceId:string;chapter?:string;file?:string;kind:'missing_chapter_index'|'missing_article'|'unreferenced_article'|'invalid_json';message:string}
export interface SourceIntegrityReport {manifestFiles:number;jsonFiles:number;chapterIndexes:number;articleFiles:number;referencedArticles:number;issues:SourceIntegrityIssue[]}

export async function checkSourceIntegrity():Promise<SourceIntegrityReport>{
  const paths=await loadManifestPaths(),jsonPaths=paths.filter(p=>p.toLowerCase().endsWith('.json'));
  const issues:SourceIntegrityIssue[]=[];let chapterIndexes=0,articleFiles=0,referencedArticles=0;
  for(const source of constitutionSources){
    const prefix=sourceManifestPrefix(source),sourcePaths=jsonPaths.filter(p=>p.startsWith(prefix));
    const chapters=new Map<string,Set<string>>();
    for(const path of sourcePaths){const rest=path.slice(prefix.length),parts=rest.split('/');if(parts.length<2)continue;const [chapter,file]=parts;if(!chapters.has(chapter))chapters.set(chapter,new Set());chapters.get(chapter)!.add(file);if(/^(?:Ibara|Article) .+\.json$/i.test(file))articleFiles++}
    for(const [chapter,files] of chapters){
      const indexFile=chapter+'.json';
      if(!files.has(indexFile)){issues.push({sourceId:source.id,chapter,file:indexFile,kind:'missing_chapter_index',message:'Chapter index haipo kwenye manifest.'});continue}
      chapterIndexes++;
      let data:ConstitutionChapter;
      try{data=await fetchJson<ConstitutionChapter>(source.basePath+'/'+chapter+'/'+indexFile)}catch{issues.push({sourceId:source.id,chapter,file:indexFile,kind:'invalid_json',message:'Chapter index haiwezi kusomwa kama JSON.'});continue}
      const refs=new Set(data.ibara||[]);referencedArticles+=refs.size;
      for(const file of refs)if(!files.has(file))issues.push({sourceId:source.id,chapter,file,kind:'missing_article',message:'Ibara imetajwa na chapter index lakini file haipo kwenye manifest.'});
      for(const file of files)if(/^(?:Ibara|Article) .+\.json$/i.test(file)&&!refs.has(file))issues.push({sourceId:source.id,chapter,file,kind:'unreferenced_article',message:'Article file ipo kwenye manifest lakini haijatajwa na chapter index.'});
    }
  }
  return {manifestFiles:paths.length,jsonFiles:jsonPaths.length,chapterIndexes,articleFiles,referencedArticles,issues};
}

export function articleFileName(articleNumber:number|string){
  return `Ibara ${articleNumber}.json`;
}
