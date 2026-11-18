const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const source=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../src/pages/DashboardPage.tsx'),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
}).outputText;
function render(route){
 const exported={};
 new Function('require','exports',source)(name=>{
  if(name==='react-router-dom')return {useLocation:()=>({pathname:route}),Link:props=>React.createElement('a',props)};
  if(name==='../lib/i18n')return {t:value=>value,useLanguage:()=> 'th',locale:()=> 'th-TH'};
  if(name==='../lib/api')return {statusLabel:{READY:'Ready',AT_STORE:'At Store',RETURNED:'Returned'}};
  if(name==='../components/ToteDonutChart')return {ToteDonutChart:()=>null};
  return require(name);
 },exported);
 return renderToStaticMarkup(React.createElement(exported.DashboardPage));
}
test('Administrator Dashboard and photo page both expose one PDF summary button with its icon',()=>{
 for(const route of ['/admin','/admin/photos']){
  const html=render(route);
  assert.equal((html.match(/class="export-button pdf-download"/g)||[]).length,1,route);
  assert.ok(html.includes('lucide-file-image'),route);
 }
 assert.ok(!render('/dashboard').includes('class="export-button pdf-download"'));
});
