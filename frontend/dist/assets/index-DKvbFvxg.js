import{r as i,R as Xt,G as se,j as e,m as E,A as Kt,a as Ta}from"./vendor-ui-CWv2IH3j.js";import{r as Zt}from"./vendor-react-BAiDUHmd.js";import{a as K}from"./vendor-axios-qFyJwsfU.js";import"./vendor-export-rj6OXz6O.js";(function(){const a=document.createElement("link").relList;if(a&&a.supports&&a.supports("modulepreload"))return;for(const s of document.querySelectorAll('link[rel="modulepreload"]'))o(s);new MutationObserver(s=>{for(const r of s)if(r.type==="childList")for(const l of r.addedNodes)l.tagName==="LINK"&&l.rel==="modulepreload"&&o(l)}).observe(document,{childList:!0,subtree:!0});function n(s){const r={};return s.integrity&&(r.integrity=s.integrity),s.referrerPolicy&&(r.referrerPolicy=s.referrerPolicy),s.crossOrigin==="use-credentials"?r.credentials="include":s.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function o(s){if(s.ep)return;s.ep=!0;const r=n(s);fetch(s.href,r)}})();var mt={},Lt=Zt;mt.createRoot=Lt.createRoot,mt.hydrateRoot=Lt.hydrateRoot;/**
 * @remix-run/router v1.23.2
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */function $e(){return $e=Object.assign?Object.assign.bind():function(t){for(var a=1;a<arguments.length;a++){var n=arguments[a];for(var o in n)Object.prototype.hasOwnProperty.call(n,o)&&(t[o]=n[o])}return t},$e.apply(this,arguments)}var Me;(function(t){t.Pop="POP",t.Push="PUSH",t.Replace="REPLACE"})(Me||(Me={}));const It="popstate";function Ma(t){t===void 0&&(t={});function a(o,s){let{pathname:r,search:l,hash:c}=o.location;return ut("",{pathname:r,search:l,hash:c},s.state&&s.state.usr||null,s.state&&s.state.key||"default")}function n(o,s){return typeof s=="string"?s:Qt(s)}return Ea(a,n,null,t)}function ve(t,a){if(t===!1||t===null||typeof t>"u")throw new Error(a)}function Pa(t,a){{typeof console<"u"&&console.warn(a);try{throw new Error(a)}catch{}}}function Ba(){return Math.random().toString(36).substr(2,8)}function At(t,a){return{usr:t.state,key:t.key,idx:a}}function ut(t,a,n,o){return n===void 0&&(n=null),$e({pathname:typeof t=="string"?t:t.pathname,search:"",hash:""},typeof a=="string"?et(a):a,{state:n,key:a&&a.key||o||Ba()})}function Qt(t){let{pathname:a="/",search:n="",hash:o=""}=t;return n&&n!=="?"&&(a+=n.charAt(0)==="?"?n:"?"+n),o&&o!=="#"&&(a+=o.charAt(0)==="#"?o:"#"+o),a}function et(t){let a={};if(t){let n=t.indexOf("#");n>=0&&(a.hash=t.substr(n),t=t.substr(0,n));let o=t.indexOf("?");o>=0&&(a.search=t.substr(o),t=t.substr(0,o)),t&&(a.pathname=t)}return a}function Ea(t,a,n,o){o===void 0&&(o={});let{window:s=document.defaultView,v5Compat:r=!1}=o,l=s.history,c=Me.Pop,u=null,p=d();p==null&&(p=0,l.replaceState($e({},l.state,{idx:p}),""));function d(){return(l.state||{idx:null}).idx}function y(){c=Me.Pop;let m=d(),g=m==null?null:m-p;p=m,u&&u({action:c,location:S.location,delta:g})}function b(m,g){c=Me.Push;let k=ut(S.location,m,g);p=d()+1;let M=At(k,p),x=S.createHref(k);try{l.pushState(M,"",x)}catch(F){if(F instanceof DOMException&&F.name==="DataCloneError")throw F;s.location.assign(x)}r&&u&&u({action:c,location:S.location,delta:1})}function _(m,g){c=Me.Replace;let k=ut(S.location,m,g);p=d();let M=At(k,p),x=S.createHref(k);l.replaceState(M,"",x),r&&u&&u({action:c,location:S.location,delta:0})}function z(m){let g=s.location.origin!=="null"?s.location.origin:s.location.href,k=typeof m=="string"?m:Qt(m);return k=k.replace(/ $/,"%20"),ve(g,"No window.location.(origin|href) available to create URL for href: "+k),new URL(k,g)}let S={get action(){return c},get location(){return t(s,l)},listen(m){if(u)throw new Error("A history only accepts one active listener");return s.addEventListener(It,y),u=m,()=>{s.removeEventListener(It,y),u=null}},createHref(m){return a(s,m)},createURL:z,encodeLocation(m){let g=z(m);return{pathname:g.pathname,search:g.search,hash:g.hash}},push:b,replace:_,go(m){return l.go(m)}};return S}var Tt;(function(t){t.data="data",t.deferred="deferred",t.redirect="redirect",t.error="error"})(Tt||(Tt={}));function Ua(t,a){if(a==="/")return t;if(!t.toLowerCase().startsWith(a.toLowerCase()))return null;let n=a.endsWith("/")?a.length-1:a.length,o=t.charAt(n);return o&&o!=="/"?null:t.slice(n)||"/"}const Da=/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i,Fa=t=>Da.test(t);function Ra(t,a){a===void 0&&(a="/");let{pathname:n,search:o="",hash:s=""}=typeof t=="string"?et(t):t,r;if(n)if(Fa(n))r=n;else{if(n.includes("//")){let l=n;n=n.replace(/\/\/+/g,"/"),Pa(!1,"Pathnames cannot have embedded double slashes - normalizing "+(l+" -> "+n))}n.startsWith("/")?r=Mt(n.substring(1),"/"):r=Mt(n,a)}else r=a;return{pathname:r,search:Ga(o),hash:$a(s)}}function Mt(t,a){let n=a.replace(/\/+$/,"").split("/");return t.split("/").forEach(s=>{s===".."?n.length>1&&n.pop():s!=="."&&n.push(s)}),n.length>1?n.join("/"):"/"}function rt(t,a,n,o){return"Cannot include a '"+t+"' character in a manually specified "+("`to."+a+"` field ["+JSON.stringify(o)+"].  Please separate it out to the ")+("`to."+n+"` field. Alternatively you may provide the full path as ")+'a string in <Link to="..."> and the router will parse it for you.'}function qa(t){return t.filter((a,n)=>n===0||a.route.path&&a.route.path.length>0)}function Oa(t,a){let n=qa(t);return a?n.map((o,s)=>s===n.length-1?o.pathname:o.pathnameBase):n.map(o=>o.pathnameBase)}function Wa(t,a,n,o){o===void 0&&(o=!1);let s;typeof t=="string"?s=et(t):(s=$e({},t),ve(!s.pathname||!s.pathname.includes("?"),rt("?","pathname","search",s)),ve(!s.pathname||!s.pathname.includes("#"),rt("#","pathname","hash",s)),ve(!s.search||!s.search.includes("#"),rt("#","search","hash",s)));let r=t===""||s.pathname==="",l=r?"/":s.pathname,c;if(l==null)c=n;else{let y=a.length-1;if(!o&&l.startsWith("..")){let b=l.split("/");for(;b[0]==="..";)b.shift(),y-=1;s.pathname=b.join("/")}c=y>=0?a[y]:"/"}let u=Ra(s,c),p=l&&l!=="/"&&l.endsWith("/"),d=(r||l===".")&&n.endsWith("/");return!u.pathname.endsWith("/")&&(p||d)&&(u.pathname+="/"),u}const Va=t=>t.join("/").replace(/\/\/+/g,"/"),Ga=t=>!t||t==="?"?"":t.startsWith("?")?t:"?"+t,$a=t=>!t||t==="#"?"":t.startsWith("#")?t:"#"+t,ea=["post","put","patch","delete"];new Set(ea);const Ha=["get",...ea];new Set(Ha);/**
 * React Router v6.30.3
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */function Ke(){return Ke=Object.assign?Object.assign.bind():function(t){for(var a=1;a<arguments.length;a++){var n=arguments[a];for(var o in n)Object.prototype.hasOwnProperty.call(n,o)&&(t[o]=n[o])}return t},Ke.apply(this,arguments)}const ta=i.createContext(null),gt=i.createContext(null),ft=i.createContext(null),xt=i.createContext({outlet:null,matches:[],isDataRoute:!1});function bt(){return i.useContext(ft)!=null}function aa(){return bt()||ve(!1),i.useContext(ft).location}function na(t){i.useContext(gt).static||i.useLayoutEffect(t)}function Ya(){let{isDataRoute:t}=i.useContext(xt);return t?Qa():Ja()}function Ja(){bt()||ve(!1);let t=i.useContext(ta),{basename:a,future:n,navigator:o}=i.useContext(gt),{matches:s}=i.useContext(xt),{pathname:r}=aa(),l=JSON.stringify(Oa(s,n.v7_relativeSplatPath)),c=i.useRef(!1);return na(()=>{c.current=!0}),i.useCallback(function(p,d){if(d===void 0&&(d={}),!c.current)return;if(typeof p=="number"){o.go(p);return}let y=Wa(p,JSON.parse(l),r,d.relative==="path");t==null&&a!=="/"&&(y.pathname=y.pathname==="/"?a:Va([a,y.pathname])),(d.replace?o.replace:o.push)(y,d.state,d)},[a,o,l,r,t])}var sa=function(t){return t.UseBlocker="useBlocker",t.UseRevalidator="useRevalidator",t.UseNavigateStable="useNavigate",t}(sa||{}),oa=function(t){return t.UseBlocker="useBlocker",t.UseLoaderData="useLoaderData",t.UseActionData="useActionData",t.UseRouteError="useRouteError",t.UseNavigation="useNavigation",t.UseRouteLoaderData="useRouteLoaderData",t.UseMatches="useMatches",t.UseRevalidator="useRevalidator",t.UseNavigateStable="useNavigate",t.UseRouteId="useRouteId",t}(oa||{});function Xa(t){let a=i.useContext(ta);return a||ve(!1),a}function Ka(t){let a=i.useContext(xt);return a||ve(!1),a}function Za(t){let a=Ka(),n=a.matches[a.matches.length-1];return n.route.id||ve(!1),n.route.id}function Qa(){let{router:t}=Xa(sa.UseNavigateStable),a=Za(oa.UseNavigateStable),n=i.useRef(!1);return na(()=>{n.current=!0}),i.useCallback(function(s,r){r===void 0&&(r={}),n.current&&(typeof s=="number"?t.navigate(s):t.navigate(s,Ke({fromRouteId:a},r)))},[t,a])}function en(t,a){t==null||t.v7_startTransition,t==null||t.v7_relativeSplatPath}function tn(t){let{basename:a="/",children:n=null,location:o,navigationType:s=Me.Pop,navigator:r,static:l=!1,future:c}=t;bt()&&ve(!1);let u=a.replace(/^\/*/,"/"),p=i.useMemo(()=>({basename:u,navigator:r,static:l,future:Ke({v7_relativeSplatPath:!1},c)}),[u,c,r,l]);typeof o=="string"&&(o=et(o));let{pathname:d="/",search:y="",hash:b="",state:_=null,key:z="default"}=o,S=i.useMemo(()=>{let m=Ua(d,u);return m==null?null:{location:{pathname:m,search:y,hash:b,state:_,key:z},navigationType:s}},[u,d,y,b,_,z,s]);return S==null?null:i.createElement(gt.Provider,{value:p},i.createElement(ft.Provider,{children:n,value:S}))}new Promise(()=>{});/**
 * React Router DOM v6.30.3
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */const an="6";try{window.__reactRouterVersion=an}catch{}const nn="startTransition",Pt=Xt[nn];function sn(t){let{basename:a,children:n,future:o,window:s}=t,r=i.useRef();r.current==null&&(r.current=Ma({window:s,v5Compat:!0}));let l=r.current,[c,u]=i.useState({action:l.action,location:l.location}),{v7_startTransition:p}=o||{},d=i.useCallback(y=>{p&&Pt?Pt(()=>u(y)):u(y)},[u,p]);return i.useLayoutEffect(()=>l.listen(d),[l,d]),i.useEffect(()=>en(o),[o]),i.createElement(tn,{basename:a,children:n,location:c.location,navigationType:c.action,navigator:l,future:o})}var Bt;(function(t){t.UseScrollRestoration="useScrollRestoration",t.UseSubmit="useSubmit",t.UseSubmitFetcher="useSubmitFetcher",t.UseFetcher="useFetcher",t.useViewTransitionState="useViewTransitionState"})(Bt||(Bt={}));var Et;(function(t){t.UseFetcher="useFetcher",t.UseFetchers="useFetchers",t.UseScrollRestoration="useScrollRestoration"})(Et||(Et={}));function on(t){return se({attr:{viewBox:"0 0 24 24"},child:[{tag:"path",attr:{d:"M4 21a1 1 0 0 0 .24 0l4-1a1 1 0 0 0 .47-.26L21 7.41a2 2 0 0 0 0-2.82L19.42 3a2 2 0 0 0-2.83 0L4.3 15.29a1.06 1.06 0 0 0-.27.47l-1 4A1 1 0 0 0 3.76 21 1 1 0 0 0 4 21zM18 4.41 19.59 6 18 7.59 16.42 6zM5.91 16.51 15 7.41 16.59 9l-9.1 9.1-2.11.52z"},child:[]}]})(t)}function yt(t){return se({attr:{viewBox:"0 0 24 24"},child:[{tag:"path",attr:{d:"M20.56,3.34a1,1,0,0,0-1-.08l-17,8a1,1,0,0,0-.57.92,1,1,0,0,0,.6.9L8,15.45v6.72L13.84,18l4.76,2.08a.93.93,0,0,0,.4.09,1,1,0,0,0,.52-.15,1,1,0,0,0,.48-.79l1-15A1,1,0,0,0,20.56,3.34ZM18.1,17.68l-5.27-2.31L16,9.17,8.35,13.42,5.42,12.13,18.89,5.79Z"},child:[]}]})(t)}function rn(t){return se({attr:{viewBox:"0 0 24 24"},child:[{tag:"path",attr:{d:"M10.707 17.707 16.414 12l-5.707-5.707-1.414 1.414L13.586 12l-4.293 4.293z"},child:[]}]})(t)}function ln(t){return se({attr:{viewBox:"0 0 24 24"},child:[{tag:"path",attr:{d:"M5 18v3.766l1.515-.909L11.277 18H16c1.103 0 2-.897 2-2V8c0-1.103-.897-2-2-2H4c-1.103 0-2 .897-2 2v8c0 1.103.897 2 2 2h1zM4 8h12v8h-5.277L7 18.234V16H4V8z"},child:[]},{tag:"path",attr:{d:"M20 2H8c-1.103 0-2 .897-2 2h12c1.103 0 2 .897 2 2v8c1.103 0 2-.897 2-2V4c0-1.103-.897-2-2-2z"},child:[]}]})(t)}function Ut(t){return se({attr:{viewBox:"0 0 24 24"},child:[{tag:"path",attr:{fill:"none",d:"M0 0h24v24H0z"},child:[]},{tag:"path",attr:{fillRule:"evenodd",d:"M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z"},child:[]}]})(t)}function pt(t){return se({attr:{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"},child:[{tag:"line",attr:{x1:"18",y1:"6",x2:"6",y2:"18"},child:[]},{tag:"line",attr:{x1:"6",y1:"6",x2:"18",y2:"18"},child:[]}]})(t)}function cn(t){return se({attr:{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"},child:[{tag:"polyline",attr:{points:"3 6 5 6 21 6"},child:[]},{tag:"path",attr:{d:"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"},child:[]},{tag:"line",attr:{x1:"10",y1:"11",x2:"10",y2:"17"},child:[]},{tag:"line",attr:{x1:"14",y1:"11",x2:"14",y2:"17"},child:[]}]})(t)}function dn(t){return se({attr:{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"},child:[{tag:"circle",attr:{cx:"12",cy:"12",r:"5"},child:[]},{tag:"line",attr:{x1:"12",y1:"1",x2:"12",y2:"3"},child:[]},{tag:"line",attr:{x1:"12",y1:"21",x2:"12",y2:"23"},child:[]},{tag:"line",attr:{x1:"4.22",y1:"4.22",x2:"5.64",y2:"5.64"},child:[]},{tag:"line",attr:{x1:"18.36",y1:"18.36",x2:"19.78",y2:"19.78"},child:[]},{tag:"line",attr:{x1:"1",y1:"12",x2:"3",y2:"12"},child:[]},{tag:"line",attr:{x1:"21",y1:"12",x2:"23",y2:"12"},child:[]},{tag:"line",attr:{x1:"4.22",y1:"19.78",x2:"5.64",y2:"18.36"},child:[]},{tag:"line",attr:{x1:"18.36",y1:"5.64",x2:"19.78",y2:"4.22"},child:[]}]})(t)}function mn(t){return se({attr:{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"},child:[{tag:"path",attr:{d:"M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"},child:[]}]})(t)}function un(t){return se({attr:{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"},child:[{tag:"path",attr:{d:"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"},child:[]},{tag:"polyline",attr:{points:"16 17 21 12 16 7"},child:[]},{tag:"line",attr:{x1:"21",y1:"12",x2:"9",y2:"12"},child:[]}]})(t)}function ra(t){return se({attr:{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"},child:[{tag:"path",attr:{d:"M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"},child:[]},{tag:"circle",attr:{cx:"12",cy:"12",r:"3"},child:[]}]})(t)}function ia(t){return se({attr:{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"},child:[{tag:"path",attr:{d:"M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"},child:[]},{tag:"line",attr:{x1:"1",y1:"1",x2:"23",y2:"23"},child:[]}]})(t)}function pn(t){return se({attr:{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"},child:[{tag:"polyline",attr:{points:"6 9 12 15 18 9"},child:[]}]})(t)}function Xe(t){return se({attr:{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"},child:[{tag:"path",attr:{d:"M22 11.08V12a10 10 0 1 1-5.93-9.14"},child:[]},{tag:"polyline",attr:{points:"22 4 12 14.01 9 11.01"},child:[]}]})(t)}function hn(t){return se({attr:{viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round"},child:[{tag:"path",attr:{d:"M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"},child:[]},{tag:"line",attr:{x1:"12",y1:"9",x2:"12",y2:"13"},child:[]},{tag:"line",attr:{x1:"12",y1:"17",x2:"12.01",y2:"17"},child:[]}]})(t)}const gn="_loginContainer_zmgsi_80",fn="_mainWrapper_zmgsi_94",xn="_avatarSection_zmgsi_102",bn="_avatarLargeImage_zmgsi_109",yn="_formWrapper_zmgsi_118",vn="_card_zmgsi_47",wn="_logoWrapper_zmgsi_161",jn="_logoTop_zmgsi_173",_n="_subheading_zmgsi_211",Nn="_form_zmgsi_118",Cn="_inputGroup_zmgsi_225",kn="_label_zmgsi_231",Sn="_input_zmgsi_225",zn="_passwordWrapper_zmgsi_292",Ln="_togglePasswordBtn_zmgsi_303",In="_button_zmgsi_327",An="_toggleWrapper_zmgsi_357",Tn="_toggleText_zmgsi_364",Mn="_toggleButton_zmgsi_370",Pn="_errorMessage_zmgsi_388",Bn="_successMessage_zmgsi_401",En="_forgotPasswordLink_zmgsi_435",Un="_verificationModalOverlay_zmgsi_455",Dn="_verificationModal_zmgsi_455",Fn="_verificationClose_zmgsi_491",Rn="_verificationTitle_zmgsi_520",qn="_verificationSubtitle_zmgsi_528",On="_verificationForm_zmgsi_536",Wn="_otpInput_zmgsi_542",Vn="_verificationErrorMsg_zmgsi_568",Gn="_verificationBtn_zmgsi_578",$n="_verificationFooter_zmgsi_602",Hn="_resendText_zmgsi_609",Yn="_resendBtn_zmgsi_616",Jn="_verificationSuccess_zmgsi_639",Xn="_successIcon_zmgsi_644",Kn="_confirmationModalOverlay_zmgsi_664",Zn="_confirmationModal_zmgsi_664",Qn="_confirmationTitle_zmgsi_691",es="_confirmationSubtitle_zmgsi_699",ts="_confirmationDetails_zmgsi_707",as="_confirmationField_zmgsi_718",ns="_confirmationLabel_zmgsi_724",ss="_confirmationValue_zmgsi_732",os="_confirmationError_zmgsi_740",rs="_confirmationActions_zmgsi_758",is="_confirmationEditBtn_zmgsi_764",ls="_confirmationProceedBtn_zmgsi_765",cs="_successTitle_zmgsi_855",v={loginContainer:gn,mainWrapper:fn,avatarSection:xn,avatarLargeImage:bn,formWrapper:yn,card:vn,logoWrapper:wn,logoTop:jn,subheading:_n,form:Nn,inputGroup:Cn,label:kn,input:Sn,passwordWrapper:zn,togglePasswordBtn:Ln,button:In,toggleWrapper:An,toggleText:Tn,toggleButton:Mn,errorMessage:Pn,successMessage:Bn,forgotPasswordLink:En,verificationModalOverlay:Un,verificationModal:Dn,verificationClose:Fn,verificationTitle:Rn,verificationSubtitle:qn,verificationForm:On,otpInput:Wn,verificationErrorMsg:Vn,verificationBtn:Gn,verificationFooter:$n,resendText:Hn,resendBtn:Yn,verificationSuccess:Jn,successIcon:Xn,confirmationModalOverlay:Kn,confirmationModal:Zn,confirmationTitle:Qn,confirmationSubtitle:es,confirmationDetails:ts,confirmationField:as,confirmationLabel:ns,confirmationValue:ss,confirmationError:os,confirmationActions:rs,confirmationEditBtn:is,confirmationProceedBtn:ls,successTitle:cs},ds="_container_4cfta_1",ms="_content_4cfta_15",us="_logoWrapper_4cfta_22",ps="_logo_4cfta_22",hs="_rotatingDot_4cfta_41",Oe={container:ds,content:ms,logoWrapper:us,logo:ps,rotatingDot:hs},tt="/logo.png",Ze=({userType:t="user"})=>{const a={initial:{opacity:0},animate:{opacity:1},exit:{opacity:0}},n={initial:{scale:.8,opacity:0},animate:{scale:1,opacity:1}},o={animate:{rotate:360}};return e.jsx(E.div,{className:Oe.container,variants:a,initial:"initial",animate:"animate",exit:"exit",children:e.jsx("div",{className:Oe.content,children:e.jsxs(E.div,{className:Oe.logoWrapper,variants:n,transition:{duration:.6,ease:"easeOut"},children:[e.jsx("img",{src:tt,alt:"UACN GPT Logo",className:Oe.logo}),e.jsx(E.div,{className:Oe.rotatingDot,variants:o,animate:"animate",transition:{duration:2,repeat:1/0,ease:"linear"}})]})})})},gs="_modalBackdrop_1fla0_1",fs="_modal_1fla0_1",xs="_modalHeader_1fla0_27",bs="_modalTitle_1fla0_35",ys="_closeBtn_1fla0_42",vs="_modalContent_1fla0_58",ws="_section_1fla0_64",js="_emphasis_1fla0_92",_s="_footer_1fla0_101",Ns="_modalFooter_1fla0_107",Cs="_closeActionBtn_1fla0_115",ks="_footer__1fla0_133",Ss="_footerContent_1fla0_144",zs="_copyright_1fla0_156",Ls="_privacyLink_1fla0_185",G={modalBackdrop:gs,modal:fs,modalHeader:xs,modalTitle:bs,closeBtn:ys,modalContent:vs,section:ws,emphasis:js,footer:_s,modalFooter:Ns,closeActionBtn:Cs,footer_:ks,footerContent:Ss,copyright:zs,privacyLink:Ls},Is=e.jsxs(e.Fragment,{children:[e.jsxs("section",{className:G.section,children:[e.jsx("h3",{children:"1. What We Collect"}),e.jsx("p",{children:"When you use UACN GPT, we collect:"}),e.jsxs("ul",{children:[e.jsx("li",{children:"Your account information (name, email, business unit)"}),e.jsx("li",{children:"Your conversations and queries with the chatbot"}),e.jsx("li",{children:"Usage patterns and interaction history"})]})]}),e.jsxs("section",{className:G.section,children:[e.jsx("h3",{children:"2. How We Use Your Data"}),e.jsx("p",{children:"Your data is used to:"}),e.jsxs("ul",{children:[e.jsx("li",{children:"Provide you with accurate information from company documents"}),e.jsx("li",{children:"Improve the AI assistant's responses"}),e.jsx("li",{children:"Maintain security and prevent misuse"}),e.jsx("li",{children:"Comply with legal and regulatory requirements"})]})]}),e.jsxs("section",{className:G.section,children:[e.jsx("h3",{children:"3. AI Disclaimer"}),e.jsx("p",{children:"UACN GPT uses artificial intelligence to answer your questions. Please note:"}),e.jsxs("ul",{children:[e.jsx("li",{children:"AI responses may not be 100% accurate - always verify important information"}),e.jsx("li",{children:"The system learns from company documents but has knowledge limitations"}),e.jsx("li",{children:"For critical decisions, contact HR, Management, or relevant departments"}),e.jsx("li",{children:"Do not rely solely on AI responses for policy interpretation"})]})]}),e.jsxs("section",{className:G.section,children:[e.jsx("h3",{children:"4. Your Data Rights"}),e.jsx("p",{children:"You have the right to:"}),e.jsxs("ul",{children:[e.jsx("li",{children:"Access your personal data"}),e.jsx("li",{children:"Request data deletion (subject to legal requirements)"}),e.jsx("li",{children:"Request a copy of your conversation history"}),e.jsx("li",{children:"Contact us with privacy concerns"})]})]}),e.jsxs("section",{className:G.section,children:[e.jsx("h3",{children:"5. Data Security"}),e.jsx("p",{children:"Your data is protected with:"}),e.jsxs("ul",{children:[e.jsx("li",{children:"Encryption in transit and at rest"}),e.jsx("li",{children:"Secure access controls"}),e.jsx("li",{children:"Regular security audits"}),e.jsx("li",{children:"Compliance with data protection regulations"})]})]}),e.jsxs("section",{className:G.section,children:[e.jsx("h3",{children:"6. Contact Us"}),e.jsx("p",{children:"For privacy questions or concerns, please contact the IT or HR department. We're committed to protecting your personal information."})]})]}),As=e.jsxs(e.Fragment,{children:[e.jsxs("section",{className:G.section,children:[e.jsx("h3",{children:"1. Data Handling & Security"}),e.jsx("p",{children:"All user data and uploaded documents are handled with the highest level of security and confidentiality. Your information is:"}),e.jsxs("ul",{children:[e.jsx("li",{children:"Encrypted in transit and at rest"}),e.jsx("li",{children:"Stored securely in our GDPR-compliant servers"}),e.jsx("li",{children:"Never shared with third parties without your explicit consent"}),e.jsx("li",{children:"Accessible only to authorized team members for operational purposes"})]})]}),e.jsxs("section",{className:G.section,children:[e.jsx("h3",{children:"2. Use of Uploaded Documents"}),e.jsx("p",{children:"When you upload documents to UACN GPT, they are processed for the following purposes:"}),e.jsxs("ul",{children:[e.jsx("li",{children:"Indexing and searching within your organization's knowledge base"}),e.jsx("li",{children:"Enabling AI-powered responses to employee queries"}),e.jsx("li",{children:"Improving system accuracy and relevance over time"}),e.jsx("li",{children:"Compliance and audit trail maintenance"})]}),e.jsx("p",{className:G.emphasis,children:"Documents are stored within your organization's instance and are not used to train public or third-party AI models."})]}),e.jsxs("section",{className:G.section,children:[e.jsx("h3",{children:"3. AI & Artificial Intelligence Disclaimer"}),e.jsx("p",{children:"UACN GPT utilizes advanced AI technology to provide intelligent responses to user queries. Please be aware:"}),e.jsxs("ul",{children:[e.jsx("li",{children:"AI responses are generated based on your uploaded documents and may not be 100% accurate"}),e.jsx("li",{children:"Always verify critical information with official company sources"}),e.jsx("li",{children:"AI models have knowledge cutoff dates and may not reflect recent policy updates"}),e.jsx("li",{children:"Users are responsible for ensuring their queries return contextually relevant information"}),e.jsx("li",{children:"The AI system is designed to assist but does not replace official HR, Legal, or Management decisions"})]})]}),e.jsxs("section",{className:G.section,children:[e.jsx("h3",{children:"4. User Rights"}),e.jsx("p",{children:"As a user of UACN GPT, you have the right to:"}),e.jsxs("ul",{children:[e.jsx("li",{children:"Access your personal data stored in the system"}),e.jsx("li",{children:"Request deletion of personal information (subject to legal requirements)"}),e.jsx("li",{children:"Opt-out of data collection for improvement purposes"}),e.jsx("li",{children:"Request a copy of all data associated with your account"})]})]}),e.jsxs("section",{className:G.section,children:[e.jsx("h3",{children:"5. Data Retention"}),e.jsx("p",{children:"Uploaded documents and conversation histories are retained for as long as your account is active. Upon account deletion, all associated data will be securely deleted within 30 days, unless retention is required by legal or compliance obligations."})]}),e.jsxs("section",{className:G.section,children:[e.jsx("h3",{children:"6. Questions or Concerns"}),e.jsx("p",{children:"If you have any questions about our data handling practices or privacy policy, please contact the IT or HR department. Your privacy and data security are our top priorities."})]})]}),vt=({isOpen:t=!1,onClose:a,type:n="user"})=>{const[o,s]=i.useState(t),r=()=>{s(!1),a==null||a()},l=()=>{s(!0)};return o?e.jsx("div",{className:G.modalBackdrop,onClick:r,children:e.jsxs("div",{className:G.modal,onClick:c=>c.stopPropagation(),children:[e.jsxs("div",{className:G.modalHeader,children:[e.jsx("h2",{className:G.modalTitle,children:n==="admin"?"Data Information Policy & Privacy Notice":"Privacy Policy"}),e.jsx("button",{className:G.closeBtn,onClick:r,"aria-label":"Close",children:e.jsx(pt,{size:24})})]}),e.jsxs("div",{className:G.modalContent,children:[n==="admin"?As:Is,e.jsxs("p",{className:G.footer,children:[e.jsx("strong",{children:"Last Updated:"})," ",new Date().toLocaleDateString()]})]}),e.jsx("div",{className:G.modalFooter,children:e.jsx("button",{className:G.closeActionBtn,onClick:r,children:"I Understand"})})]})}):e.jsx("button",{className:G.privacyLink,onClick:l,children:"Privacy Policy"})},wt=({type:t="user"})=>{const[a,n]=i.useState(!1);return e.jsxs(e.Fragment,{children:[e.jsx("footer",{className:G.footer_,children:e.jsx("div",{className:G.footerContent,children:e.jsxs("p",{className:G.copyright,children:["© ",new Date().getFullYear()," UACN. All rights reserved."]})})}),a&&e.jsx(vt,{isOpen:a,onClose:()=>n(!1),type:t})]})},We={email:"",password:"",fullName:"",businessUnit:void 0},it=[{label:"Grand Cereals Limited (GCL)",value:"GCL"},{label:"Livestocks Feeds PLC (LSF)",value:"LSF"},{label:"Chemical and Allied Products PLC (CAP)",value:"CAP"},{label:"UAC Foods Limited (UFL)",value:"UFL"},{label:"Chivita|Hollandia Limited (CHI)",value:"CHI"},{label:"UAC Restaurants",value:"UAC-Restaurants"},{label:"UPDC",value:"UPDC"},{label:"UACN Group (UACN)",value:"UACN"}],Ts=({onLoginSuccess:t})=>{var D;const[a,n]=i.useState(!1),[o,s]=i.useState(!1),[r,l]=i.useState(We),[c,u]=i.useState(""),[p,d]=i.useState(null),[y,b]=i.useState(null),[_,z]=i.useState(!1),[S,m]=i.useState(!1),[g,k]=i.useState(it),[M,x]=i.useState(!1),[F,le]=i.useState(""),[Z,Y]=i.useState(""),[B,ee]=i.useState(!1),[H,I]=i.useState(""),[me,ce]=i.useState(!1),[de,oe]=i.useState(!1),[te,ie]=i.useState(!1);i.useEffect(()=>{(async()=>{try{const R=await K.get("/api/public/business-units");if(R.data.businessUnits&&R.data.businessUnits.length>0){const q=R.data.businessUnits.map(W=>typeof W=="string"?it.find(Ie=>Ie.value===W)||{label:W,value:W}:{label:W.label||W.name,value:W.name||W.value});k(q)}}catch(R){console.error("Error fetching business units:",R),k(it)}})()},[]);const Q=N=>{const{name:R,value:q}=N.target;l(W=>({...W,[R]:q}))},ue=async N=>{var R,q;if(N.preventDefault(),d(null),b(null),a){oe(!0);return}z(!0),localStorage.setItem("authInProgress","true");try{const W="/api/admin/auth/login",Fe={email:r.email,password:r.password},{data:Ie}=await K.post(W,Fe);localStorage.removeItem("authInProgress"),t(Ie.token,Ie.admin)}catch(W){d(((q=(R=W.response)==null?void 0:R.data)==null?void 0:q.error)||"Authentication failed. Please try again."),localStorage.removeItem("authInProgress")}finally{z(!1)}},ae=async()=>{var N,R;ie(!0),d(null),localStorage.setItem("authInProgress","true");try{const q="/api/admin/auth/register",W=r;await K.post(q,W),oe(!1),Y(r.email||""),x(!0),l(We)}catch(q){d(((R=(N=q.response)==null?void 0:N.data)==null?void 0:R.error)||"Registration failed. Please try again."),localStorage.removeItem("authInProgress")}finally{ie(!1)}},pe=()=>{oe(!1),d(null)},fe=()=>{n(!a),s(!1),l(We),u(""),d(null),b(null)},Ne=()=>{s(!0),n(!1),l(We),d(null),b(null)},re=()=>{s(!1),u(""),d(null),b(null)},we=async N=>{var R,q;N.preventDefault(),z(!0),d(null),b(null);try{const W=await K.post("/api/admin/auth/forgot-password",{email:c});b(W.data.message||"If an account exists with this email, a reset link will be sent shortly"),u("")}catch(W){d(((q=(R=W.response)==null?void 0:R.data)==null?void 0:q.error)||"Failed to process forgot password request. Please try again.")}finally{z(!1)}},j=async N=>{var R,q;N.preventDefault(),I(""),ee(!0);try{await K.post("/api/admin/auth/verify-email",{email:Z,otp:F}),ce(!0),le(""),setTimeout(()=>{x(!1),ce(!1),n(!1),l(We),d(null),b(null)},3e3)}catch(W){I(((q=(R=W.response)==null?void 0:R.data)==null?void 0:q.error)||"Invalid or expired OTP")}finally{ee(!1)}},P=async()=>{var N,R;I(""),ee(!0);try{await K.post("/api/admin/auth/resend-verification",{email:Z}),I(""),alert("OTP resent to your email!")}catch(q){I(((R=(N=q.response)==null?void 0:N.data)==null?void 0:R.error)||"Failed to resend OTP")}finally{ee(!1)}};return e.jsxs(e.Fragment,{children:[_&&e.jsx(Ze,{userType:"admin"}),e.jsxs("div",{className:v.loginContainer,children:[e.jsxs("div",{className:v.mainWrapper,children:[e.jsx("div",{className:v.avatarSection,children:e.jsx("video",{src:"/UAC AI AVATAR.mp4",className:v.avatarLargeImage,autoPlay:!0,loop:!0,muted:!0,playsInline:!0,type:"video/mp4"})}),e.jsxs("div",{className:v.formWrapper,children:[e.jsx("div",{className:v.logoWrapper,children:e.jsx("img",{src:"/logo.png",alt:"UACN Logo",className:v.logoTop})}),e.jsxs("div",{className:v.card,children:[e.jsx("p",{className:v.subheading,children:o?"Enter your email address and we'll send you a link to reset your password":a?"":"Sign in to manage UACN documents and knowledge base"}),e.jsxs("form",{onSubmit:o?we:ue,className:v.form,children:[p&&e.jsx("div",{className:v.errorMessage,children:p}),y&&e.jsx("div",{className:v.successMessage,children:y}),o?e.jsxs("div",{className:v.inputGroup,children:[e.jsx("label",{className:v.label,children:"Email Address"}),e.jsx("input",{type:"email",className:v.input,placeholder:"admin@uacn.com",value:c,onChange:N=>u(N.target.value),required:!0})]}):e.jsxs(e.Fragment,{children:[a&&e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:v.inputGroup,children:[e.jsx("label",{className:v.label,children:"Full Name"}),e.jsx("input",{type:"text",name:"fullName",className:v.input,placeholder:"John Doe",value:r.fullName||"",onChange:Q,required:a})]}),e.jsxs("div",{className:v.inputGroup,children:[e.jsx("label",{className:v.label,children:"Business Unit"}),e.jsxs("select",{name:"businessUnit",className:v.input,value:r.businessUnit||"",onChange:Q,required:a,children:[e.jsx("option",{value:"",children:"Select a Business Unit"}),g.map(N=>e.jsx("option",{value:N.value,children:N.label},N.value))]})]})]}),e.jsxs("div",{className:v.inputGroup,children:[e.jsx("label",{className:v.label,children:"Email Address"}),e.jsx("input",{type:"email",name:"email",className:v.input,placeholder:"admin@uacn.com",value:r.email,onChange:Q,autoComplete:"email",required:!0})]}),e.jsxs("div",{className:v.inputGroup,children:[e.jsx("label",{className:v.label,children:"Password"}),e.jsxs("div",{className:v.passwordWrapper,children:[e.jsx("input",{type:S?"text":"password",name:"password",className:v.input,placeholder:"••••••••",value:r.password,onChange:Q,autoComplete:"current-password",required:!0}),e.jsx("button",{type:"button",className:v.togglePasswordBtn,onClick:()=>m(!S),title:S?"Hide password":"Show password",children:S?e.jsx(ia,{size:18}):e.jsx(ra,{size:18})})]})]})]}),e.jsx("button",{type:"submit",className:v.button,disabled:_,children:_?o?"Sending...":a?"Creating Account...":"Signing In...":o?"Send Reset Link":a?"Create Admin Account":"Sign In"})]}),e.jsx("div",{className:v.toggleWrapper,children:o?e.jsxs("span",{className:v.toggleText,children:["Remember your password?",e.jsx("button",{type:"button",className:v.toggleButton,onClick:re,children:"Back to Sign In"})]}):e.jsxs(e.Fragment,{children:[e.jsxs("span",{className:v.toggleText,children:[a?"Already have an account?":"Don't have an account?",e.jsx("button",{type:"button",className:v.toggleButton,onClick:fe,children:a?"Sign In":"Register"})]}),!a&&e.jsx("button",{type:"button",className:v.forgotPasswordLink,onClick:Ne,children:"Forgot Password?"})]})})]})]})]}),de&&e.jsx("div",{className:v.confirmationModalOverlay,onClick:()=>!te&&oe(!1),children:e.jsxs("div",{className:v.confirmationModal,onClick:N=>N.stopPropagation(),children:[e.jsx("h2",{className:v.confirmationTitle,children:"Confirm Your Information"}),e.jsx("p",{className:v.confirmationSubtitle,children:"Please verify that your information is correct before proceeding"}),e.jsxs("div",{className:v.confirmationDetails,children:[e.jsxs("div",{className:v.confirmationField,children:[e.jsx("label",{className:v.confirmationLabel,children:"Full Name"}),e.jsx("p",{className:v.confirmationValue,children:r.fullName})]}),e.jsxs("div",{className:v.confirmationField,children:[e.jsx("label",{className:v.confirmationLabel,children:"Business Unit"}),e.jsx("p",{className:v.confirmationValue,children:((D=g.find(N=>N.value===r.businessUnit))==null?void 0:D.label)||r.businessUnit})]}),e.jsxs("div",{className:v.confirmationField,children:[e.jsx("label",{className:v.confirmationLabel,children:"Email"}),e.jsx("p",{className:v.confirmationValue,children:r.email})]})]}),p&&e.jsx("div",{className:v.confirmationError,children:p}),e.jsxs("div",{className:v.confirmationActions,children:[e.jsx("button",{type:"button",className:v.confirmationEditBtn,onClick:pe,disabled:te,children:"Edit"}),e.jsx("button",{type:"button",className:v.confirmationProceedBtn,onClick:ae,disabled:te,children:te?"Processing...":"Proceed"})]})]})}),M&&e.jsx("div",{className:v.verificationModalOverlay,onClick:()=>!B&&x(!1),children:e.jsx("div",{className:v.verificationModal,onClick:N=>N.stopPropagation(),children:me?e.jsxs("div",{className:v.verificationSuccess,children:[e.jsx("div",{className:v.successIcon,children:e.jsx(Xe,{size:48})}),e.jsx("h2",{className:v.successTitle,children:"Email Verified!"}),e.jsx("p",{className:v.successMessage,children:"Your email has been verified successfully. Redirecting..."})]}):e.jsxs(e.Fragment,{children:[e.jsx("button",{className:v.verificationClose,onClick:()=>x(!1),disabled:B,children:"✕"}),e.jsx("h2",{className:v.verificationTitle,children:"Verify Your Email"}),e.jsxs("p",{className:v.verificationSubtitle,children:["Enter the 6-digit verification code sent to ",e.jsx("strong",{children:Z})]}),e.jsxs("form",{onSubmit:j,className:v.verificationForm,children:[e.jsx("input",{type:"text",placeholder:"000000",maxLength:6,value:F,onChange:N=>le(N.target.value.replace(/\D/g,"")),required:!0,disabled:B,autoComplete:"off",inputMode:"numeric",className:v.otpInput}),H&&e.jsx("div",{className:v.verificationErrorMsg,children:H}),e.jsx("button",{type:"submit",disabled:B,className:v.verificationBtn,children:B?"Verifying...":"Verify"})]}),e.jsxs("div",{className:v.verificationFooter,children:[e.jsx("p",{className:v.resendText,children:"Didn't receive a code?"}),e.jsx("button",{type:"button",className:v.resendBtn,onClick:P,disabled:B,children:"Resend OTP"})]})]})})})]}),e.jsx(wt,{type:"admin"})]})},Ms="_homeContainer_zkkmc_1",Ps="_logoContainer_zkkmc_15",Bs="_mainContent_zkkmc_23",Es="_avatarSection_zkkmc_34",Us="_centralAvatarImage_zkkmc_41",Ds="_textSection_zkkmc_47",Fs="_textContent_zkkmc_55",Rs="_title_zkkmc_61",qs="_description_zkkmc_72",Os="_cursor_zkkmc_81",Ws="_cta_zkkmc_102",Vs="_revealed_zkkmc_107",Gs="_ctaButton_zkkmc_122",O={homeContainer:Ms,logoContainer:Ps,mainContent:Bs,avatarSection:Es,centralAvatarImage:Us,textSection:Ds,textContent:Fs,title:Rs,description:qs,cursor:Os,cta:Ws,revealed:Vs,ctaButton:Gs},Dt=({onEnter:t,admin:a})=>{const n=a?`Welcome to ${a.businessUnit} Admin Portal`:"Welcome to UACN GPT Admin Portal",o=a?`Manage ${a.businessUnit} knowledge base, documents, and administrator settings from your dashboard.`:"Manage your knowledge base, documents, and administrator settings from your dashboard.",[s,r]=i.useState(""),[l,c]=i.useState(""),[u,p]=i.useState("title"),d=45,y=20,b=250;return i.useEffect(()=>{if(u==="title")if(s.length<n.length){const _=setTimeout(()=>{r(n.slice(0,s.length+1))},d);return()=>clearTimeout(_)}else{const _=setTimeout(()=>{p("body")},b);return()=>clearTimeout(_)}},[s,u,d,b,n]),i.useEffect(()=>{if(u==="body")if(l.length<o.length){const _=setTimeout(()=>{c(o.slice(0,l.length+1))},y);return()=>clearTimeout(_)}else{const _=setTimeout(()=>{p("done")},b);return()=>clearTimeout(_)}},[l,u,y,b,o]),e.jsxs("div",{className:O.homeContainer,children:[e.jsx("div",{className:O.logoContainer,children:e.jsx("img",{src:"/logo.png",alt:"UACN Logo",style:{width:"60px",height:"60px",objectFit:"contain"}})}),e.jsxs("div",{className:O.mainContent,children:[e.jsx("div",{className:O.avatarSection,children:e.jsx("img",{src:"/avatar-1.png",alt:"Avatar",className:O.centralAvatarImage})}),e.jsx("div",{className:O.textSection,children:e.jsxs("div",{className:O.textContent,children:[e.jsxs("h1",{className:O.title,children:[s,u!=="done"&&u==="title"&&e.jsx("span",{className:O.cursor})]}),u!=="title"&&e.jsxs("p",{className:O.description,children:[l,u==="body"&&e.jsx("span",{className:O.cursor})]}),u==="done"&&e.jsx("div",{className:`${O.cta} ${O.revealed}`,children:e.jsx("button",{className:O.ctaButton,onClick:t,children:"Access Admin Portal"})})]})})]})]})},$s="_faqContainer_1rrf0_1",Hs="_header_1rrf0_9",Ys="_title_1rrf0_13",Js="_subtitle_1rrf0_20",Xs="_faqList_1rrf0_26",Ks="_faqItem_1rrf0_32",Zs="_expanded_1rrf0_45",Qs="_faqQuestion_1rrf0_50",eo="_chevron_1rrf0_75",to="_faqAnswer_1rrf0_86",be={faqContainer:$s,header:Hs,title:Ys,subtitle:Js,faqList:Xs,faqItem:Ks,expanded:Zs,faqQuestion:Qs,chevron:eo,faqAnswer:to},ao=[{question:"What types of documents can I upload?",answer:"You can upload company documents including Policies, HSE (Health, Safety & Environment) guidelines, SOPs (Standard Operating Procedures), HR documents, Manuals, Training materials, and any other company knowledge base resources. Supported formats include .docx (Word), .pdf, and .txt files."},{question:"What is the file size limit?",answer:"Each file can be up to 10 MB in size. If your document is larger, you can split it into multiple files and upload them separately."},{question:"How does the AI use uploaded documents?",answer:"When you upload documents, the AI system reads and indexes the content to answer employee questions accurately. The AI learns from your documents to provide contextually relevant responses based on your organization's specific policies and guidelines. Documents are only used within your organization's instance and are never shared with third parties."},{question:"Can users search for documents?",answer:"Yes! When users ask questions in the chatbot, the system automatically searches through your uploaded documents and returns the most relevant information. The AI can understand questions in natural language and matches them against your knowledge base."},{question:"How do I know which documents have been uploaded?",answer:"All uploaded documents are listed in the 'Uploaded Documents' section with their title, category, and upload details. You can see who uploaded each document and when it was uploaded."},{question:"Can I edit or delete documents?",answer:"Yes, you can edit any document by clicking the 'Edit' button. You can also delete documents using the 'Delete' button. Changes are applied immediately."},{question:"What if the AI gives an incorrect answer?",answer:"The AI is designed to assist but may not always be 100% accurate. Always verify critical information with official company sources, HR, or Management. We recommend reviewing your documents for completeness and clarity to improve AI response quality."},{question:"Are my documents secure?",answer:"Yes! All uploaded documents are encrypted and stored securely. They are only accessible to authorized team members in your organization. Your data is never used to train public AI models. Please see our Privacy Policy for more details."}],no=({showTitle:t=!0})=>{const[a,n]=i.useState(null),o=s=>{n(a===s?null:s)};return e.jsxs("div",{className:be.faqContainer,children:[t&&e.jsxs("div",{className:be.header,children:[e.jsx("h2",{className:be.title,children:"Frequently Asked Questions"}),e.jsx("p",{className:be.subtitle,children:"Learn more about uploading documents and using the knowledge base"})]}),e.jsx("div",{className:be.faqList,children:ao.map((s,r)=>e.jsxs("div",{className:`${be.faqItem} ${a===r?be.expanded:""}`,children:[e.jsxs("button",{className:be.faqQuestion,onClick:()=>o(r),children:[e.jsx("span",{children:s.question}),e.jsx(pn,{className:be.chevron,size:20})]}),a===r&&e.jsx("div",{className:be.faqAnswer,children:e.jsx("p",{children:s.answer})})]},r))})]})},so="_adminDashboard_re68z_1",oo="_dashboardHeader_re68z_13",ro="_headerLeft_re68z_28",io="_headerLogo_re68z_34",lo="_headerInfo_re68z_49",co="_headerRight_re68z_65",mo="_userInfo_re68z_71",uo="_userName_re68z_85",po="_separator_re68z_93",ho="_userBU_re68z_99",go="_userEmail_re68z_110",fo="_logoutBtn_re68z_116",xo="_themeToggle_re68z_136",bo="_dashboardContent_re68z_159",yo="_contentHeader_re68z_170",vo="_contentTitle_re68z_174",wo="_contentSubtitle_re68z_183",jo="_dashboardLayout_re68z_191",_o="_formSection_re68z_198",No="_formCard_re68z_203",Co="_formTitle_re68z_218",ko="_form_re68z_198",So="_formGroup_re68z_232",zo="_label_re68z_238",Lo="_input_re68z_246",Io="_textarea_re68z_247",Ao="_contentInputWrapper_re68z_278",To="_fileUploadArea_re68z_284",Mo="_dragging_re68z_299",Po="_fileInput_re68z_305",Bo="_fileUploadLabel_re68z_309",Eo="_uploadIcon_re68z_317",Uo="_uploadText_re68z_322",Do="_uploadSubtext_re68z_328",Fo="_uploadHint_re68z_334",Ro="_fileSelected_re68z_341",qo="_selectedFileInfo_re68z_351",Oo="_fileIcon_re68z_358",Wo="_fileDetails_re68z_363",Vo="_fileName_re68z_367",Go="_fileSize_re68z_375",$o="_clearFileBtn_re68z_381",Ho="_divider_re68z_398",Yo="_formActions_re68z_416",Jo="_submitBtn_re68z_422",Xo="_cancelBtn_re68z_423",Ko="_listSection_re68z_464",Zo="_listHeader_re68z_471",Qo="_sourceFileBadge_re68z_548",er="_editBtn_re68z_594",tr="_deleteBtn_re68z_595",ar="_errorMessage_re68z_625",nr="_emptyState_re68z_645",sr="_emptyStateText_re68z_654",or="_emptyStateWithFAQ_re68z_660",rr="_darkTheme_re68z_738",ir="_documentCategory_re68z_921",lr="_auditLogSection_re68z_933",cr="_auditLogItem_re68z_938",dr="_auditLogLabel_re68z_942",mr="_auditLogValue_re68z_946",ur="_lightTheme_re68z_984",pr="_logoutConfirmBackdrop_re68z_1265",hr="_logoutConfirmCard_re68z_1280",gr="_logoutConfirmIcon_re68z_1291",fr="_logoutConfirmTitle_re68z_1299",xr="_logoutConfirmMessage_re68z_1307",br="_logoutConfirmActions_re68z_1314",yr="_logoutConfirmCancel_re68z_1319",vr="_footerCard_re68z_1345",wr="_footerText_re68z_1361",jr="_footerLink_re68z_1368",_r="_logoutConfirmConfirm_re68z_1450",Nr="_documentsList_re68z_1601",Cr="_documentCard_re68z_1611",kr="_documentInfo_re68z_1640",Sr="_documentTitle_re68z_1645",zr="_documentActions_re68z_1668",h={adminDashboard:so,dashboardHeader:oo,headerLeft:ro,headerLogo:io,headerInfo:lo,headerRight:co,userInfo:mo,userName:uo,separator:po,userBU:ho,userEmail:go,logoutBtn:fo,themeToggle:xo,dashboardContent:bo,contentHeader:yo,contentTitle:vo,contentSubtitle:wo,dashboardLayout:jo,formSection:_o,formCard:No,formTitle:Co,form:ko,formGroup:So,label:zo,input:Lo,textarea:Io,contentInputWrapper:Ao,fileUploadArea:To,dragging:Mo,fileInput:Po,fileUploadLabel:Bo,uploadIcon:Eo,uploadText:Uo,uploadSubtext:Do,uploadHint:Fo,fileSelected:Ro,selectedFileInfo:qo,fileIcon:Oo,fileDetails:Wo,fileName:Vo,fileSize:Go,clearFileBtn:$o,divider:Ho,formActions:Yo,submitBtn:Jo,cancelBtn:Xo,listSection:Ko,listHeader:Zo,sourceFileBadge:Qo,editBtn:er,deleteBtn:tr,errorMessage:ar,emptyState:nr,emptyStateText:sr,emptyStateWithFAQ:or,darkTheme:rr,documentCategory:ir,auditLogSection:lr,auditLogItem:cr,auditLogLabel:dr,auditLogValue:mr,lightTheme:ur,logoutConfirmBackdrop:pr,logoutConfirmCard:hr,logoutConfirmIcon:gr,logoutConfirmTitle:fr,logoutConfirmMessage:xr,logoutConfirmActions:br,logoutConfirmCancel:yr,footerCard:vr,footerText:wr,footerLink:jr,logoutConfirmConfirm:_r,documentsList:Nr,documentCard:Cr,documentInfo:kr,documentTitle:Sr,documentActions:zr},je=K.create(),Ft={title:"",category:"",content:"",tags:[]},Lr=(t,a=!0)=>{if(!t.trim())return{category:"",tags:[]};const n=t.toLowerCase(),o={"Time Off & Leave":["leave","vacation","holiday","time off","days off","absent","sick leave","annual leave","personal day","pto","unpaid leave","bereavement"],"Compensation & Salary":["salary","pay","wage","compensation","bonus","allowance","payroll","stipend","commission","incentive","raise","paycheck"],Benefits:["benefit","health","insurance","medical","dental","pension","retirement","401k","healthcare","coverage","wellness","esa"],"Work Schedule & Hours":["work hours","working hours","office hours","schedule","shift","timing","9 to 5","flexible hours","overtime","flextime","core hours"],Attendance:["attendance","present","check in","punctuality","lateness","absence","sign in","clock in","tardy"],"Remote Work":["remote","work from home","wfh","home office","telecommute","virtual","hybrid","distributed"],"Code of Conduct":["conduct","behavior","dress code","ethics","discipline","professionalism","respect","policy","professional"],"Training & Development":["training","development","course","certification","learning","upskilling","workshop","seminar","mentor","professional development"],"Harassment & Safety":["harassment","discrimination","bullying","toxic","respect","safe","safety","abuse","assault","hostile","eeoc"],Performance:["performance","review","evaluation","appraisal","rating","feedback","assessment","improvement plan","competency"]};let s=a?"General Document":"",r=0;for(const[m,g]of Object.entries(o)){const k=g.filter(M=>n.includes(M)).length;k>r&&(r=k,s=m)}const l=new Set(["the","a","an","and","or","but","in","on","at","to","for","of","with","by","is","are","be","been","being","have","has","do","does","did","will","would","should","could","may","might","must","can","shall","that","this","these","those","if","whether","as","while","after","before","during","about","above","below","from","up","down","out","off","over","under","again","further","then","once","here","there","where","what","which","who","whom","whose","when","why","how","employees","employee","staff","company","should","shall","must","required","requirement","such","other","more","most","also","than","been","not","just","all","any","our","your","their","its","it","or","so","each","every","both"]),c=t.toLowerCase().match(/\b[a-z]+(?:'[a-z]+)?\b/g)||[],u={};c.forEach(m=>{!l.has(m)&&m.length>2&&(u[m]=(u[m]||0)+1)});const p={};for(let m=0;m<c.length-1;m++){const g=c[m],k=c[m+1];if(!l.has(g)&&!l.has(k)&&g.length>2&&k.length>2){const M=`${g} ${k}`;p[M]=(p[M]||0)+1}}const d=Object.entries(u).filter(([m,g])=>g>=1).sort((m,g)=>g[1]-m[1]).map(([m])=>m).slice(0,12),y=Object.entries(p).filter(([m,g])=>g>=2).sort((m,g)=>g[1]-m[1]).map(([m])=>m).slice(0,8),b=o[s]||[],_=new Set;b.forEach(m=>{n.includes(m.toLowerCase())&&_.add(m)}),y.forEach(m=>_.add(m)),d.forEach(m=>_.add(m));let z=0;for(const m of b){if(z>=4)break;_.has(m)||(_.add(m),z++)}const S=Array.from(_).slice(0,25);return{category:s,tags:S}},Ir=()=>{const[t,a]=i.useState(localStorage.getItem("adminToken")),[n,o]=i.useState(null),[s,r]=i.useState([]),[l,c]=i.useState(!1),[u,p]=i.useState(!1),[d,y]=i.useState(Ft),[b,_]=i.useState({file:null,isDragging:!1}),[z,S]=i.useState(null),[m,g]=i.useState(null),[k,M]=i.useState(()=>!localStorage.getItem("adminToken")),[x,F]=i.useState(()=>localStorage.getItem("adminTheme")||"dark"),[le,Z]=i.useState(!1),[Y,B]=i.useState(!1),[ee,H]=i.useState(!!localStorage.getItem("adminToken")),I=i.useCallback(async()=>{if(t){c(!0),g(null);try{const{data:j}=await je.get("/api/admin/policies");r(j)}catch(j){console.error("Failed to load documents:",j.message),g("Failed to load documents.")}finally{c(!1),H(!1)}}},[t]);i.useEffect(()=>{if(t){je.defaults.headers.common.Authorization=`Bearer ${t}`;const j=localStorage.getItem("adminUser");j&&o(JSON.parse(j)),I()}},[t,I]),i.useEffect(()=>{localStorage.setItem("adminTheme",x)},[x]);const me=()=>{F(j=>j==="dark"?"light":"dark")},ce=()=>{Z(!0)},de=()=>{Z(!1),a(null),o(null),H(!1),localStorage.removeItem("adminToken"),localStorage.removeItem("adminUser"),delete je.defaults.headers.common.Authorization},oe=()=>{Z(!1)},te=j=>{const{name:P,value:D}=j.target;if(P==="title"){const{category:N}=Lr(D,!1);y(R=>({...R,[P]:D,category:N}))}else y(N=>({...N,[P]:D}))},ie=j=>{S(j._id),y({title:j.title,category:j.category,content:j.content,tags:j.tags})},Q=()=>{S(null),y(Ft),_({file:null,isDragging:!1})},ue=j=>{const P=j.target.files;if(P&&P.length>0){const D=P[0];D.type==="application/vnd.openxmlformats-officedocument.wordprocessingml.document"||D.type==="application/pdf"||D.type==="text/plain"?(_({file:D,isDragging:!1}),y(N=>({...N,content:""})),g(null)):g("Please upload a valid .docx, .pdf or .txt file")}},ae=j=>{j.preventDefault(),_(P=>({...P,isDragging:!0}))},pe=j=>{j.preventDefault(),_(P=>({...P,isDragging:!1}))},fe=j=>{j.preventDefault(),_(D=>({...D,isDragging:!1}));const P=j.dataTransfer.files;if(P&&P.length>0){const D=P[0];D.type==="application/vnd.openxmlformats-officedocument.wordprocessingml.document"||D.type==="application/pdf"||D.type==="text/plain"?(_({file:D,isDragging:!1}),y(N=>({...N,content:""})),g(null)):g("Please upload a valid .docx, .pdf or .txt file")}},Ne=()=>{_({file:null,isDragging:!1})},re=async j=>{var P,D;j.preventDefault(),p(!0),g(null);try{if(!d.title||!d.category){g("Title and category are required"),p(!1);return}if(!b.file&&!d.content){g("Please either upload a file or enter content"),p(!1);return}if(b.file){const N=new FormData;N.append("title",d.title),N.append("category",d.category),N.append("file",b.file),d.tags&&d.tags.length>0&&N.append("tags",d.tags.join(",")),z?await je.put(`/api/admin/policies/${z}`,N,{headers:{"Content-Type":"multipart/form-data"}}):await je.post("/api/admin/policies",N,{headers:{"Content-Type":"multipart/form-data"}})}else{const N={...d,tags:[]};z?await je.put(`/api/admin/policies/${z}`,N):await je.post("/api/admin/policies",N)}await I(),Q()}catch(N){console.error(N),g(((D=(P=N.response)==null?void 0:P.data)==null?void 0:D.error)||"Failed to save document.")}finally{p(!1)}},we=async j=>{if(window.confirm("Delete this document?"))try{await je.delete(`/api/admin/policies/${j}`),await I()}catch(P){console.error(P),g("Failed to delete document.")}};return ee&&t?e.jsx(Ze,{userType:"admin"}):!t&&k?e.jsx(Dt,{onEnter:()=>M(!1),admin:null}):t?k?e.jsx(Dt,{onEnter:()=>M(!1),admin:n}):e.jsxs("div",{className:`${h.adminDashboard} ${x==="light"?h.lightTheme:h.darkTheme}`,children:[e.jsxs("header",{className:h.dashboardHeader,children:[e.jsxs("div",{className:h.headerLeft,children:[e.jsx("img",{src:"/logo.png",alt:"UACN Logo",className:h.headerLogo}),e.jsxs("div",{className:h.headerInfo,children:[e.jsx("h1",{children:"UACN GPT Admin"}),e.jsx("p",{children:"Manage company knowledge base"})]})]}),e.jsxs("div",{className:h.headerRight,children:[e.jsx("button",{type:"button",className:h.themeToggle,onClick:me,title:`Switch to ${x==="dark"?"light":"dark"} mode`,children:x==="dark"?e.jsxs(e.Fragment,{children:[e.jsx(dn,{size:18}),e.jsx("span",{children:"Light Mode"})]}):e.jsxs(e.Fragment,{children:[e.jsx(mn,{size:18}),e.jsx("span",{children:"Dark Mode"})]})}),n&&e.jsxs("div",{className:h.userInfo,children:[e.jsx("span",{className:h.userName,children:n.fullName}),e.jsx("span",{className:h.separator,children:"|"}),e.jsx("span",{className:h.userBU,children:n.businessUnit}),e.jsx("span",{className:h.separator,children:"|"}),e.jsx("span",{className:h.userEmail,children:n.email})]}),e.jsx("button",{type:"button",className:h.logoutBtn,onClick:ce,children:"Sign Out"})]})]}),e.jsxs("div",{className:h.dashboardContent,children:[e.jsxs("div",{className:h.contentHeader,children:[e.jsx("h1",{className:h.contentTitle,children:"Knowledge Base"}),e.jsxs("p",{className:h.contentSubtitle,children:["Upload company documents (Policies, HSE, SOPs, HR documents, Manuals, etc.) for ",n==null?void 0:n.businessUnit]})]}),e.jsxs("div",{className:h.dashboardLayout,children:[e.jsx("section",{className:h.formSection,children:e.jsxs("div",{className:h.formCard,children:[e.jsx("h2",{className:h.formTitle,children:z?"Edit Document":"Upload File"}),e.jsxs("form",{onSubmit:re,className:h.form,children:[e.jsxs("div",{className:h.formGroup,children:[e.jsx("label",{className:h.label,children:"Document Title"}),e.jsx("input",{type:"text",name:"title",className:h.input,placeholder:"e.g., Salary Review Policy, HSE Guidelines, HR Manual",value:d.title,onChange:te,required:!0})]}),e.jsxs("div",{className:h.formGroup,children:[e.jsx("label",{className:h.label,children:"Document Content"}),e.jsxs("div",{className:h.contentInputWrapper,children:[b.file?e.jsxs("div",{className:h.fileSelected,children:[e.jsxs("div",{className:h.selectedFileInfo,children:[e.jsx("span",{className:h.fileIcon,children:"✓"}),e.jsxs("div",{className:h.fileDetails,children:[e.jsx("p",{className:h.fileName,children:b.file.name}),e.jsxs("p",{className:h.fileSize,children:[(b.file.size/1024).toFixed(2)," KB"]})]})]}),e.jsx("button",{type:"button",className:h.clearFileBtn,onClick:Ne,children:"✕ Change File"})]}):e.jsxs("div",{className:`${h.fileUploadArea} ${b.isDragging?h.dragging:""}`,onDragOver:ae,onDragLeave:pe,onDrop:fe,children:[e.jsx("input",{type:"file",id:"fileInput",className:h.fileInput,accept:".docx,.pdf,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf",onChange:ue,style:{display:"none"}}),e.jsxs("label",{htmlFor:"fileInput",className:h.fileUploadLabel,children:[e.jsx("div",{className:h.uploadIcon,children:"📄"}),e.jsx("p",{className:h.uploadText,children:e.jsx("strong",{children:"Upload Document or Text File"})}),e.jsx("p",{className:h.uploadSubtext,children:"Drag & drop a .docx, .pdf or .txt file here, or click to browse"}),e.jsx("p",{className:h.uploadHint,children:"(Max 10MB - Uploaded files are securely processed and stored)"})]})]}),!b.file&&e.jsxs(e.Fragment,{children:[e.jsx("div",{className:h.divider,children:e.jsx("span",{children:"OR"})}),e.jsx("textarea",{name:"content",className:h.textarea,placeholder:"Paste the full document content here instead...",value:d.content,onChange:te,rows:10})]})]})]}),e.jsxs("div",{className:h.formGroup,children:[e.jsx("label",{className:h.label,children:"Category"}),e.jsx("input",{type:"text",name:"category",className:h.input,placeholder:"Auto-generated from title",value:d.category,onChange:te,required:!0})]}),m&&e.jsx("div",{className:h.errorMessage,children:m}),e.jsxs("div",{className:h.formActions,children:[e.jsx("button",{type:"submit",className:h.submitBtn,disabled:u,children:u?z?"Saving...":"Uploading...":z?"Save Changes":"Upload Document"}),z&&e.jsx("button",{type:"button",className:h.cancelBtn,onClick:Q,children:"Cancel"})]})]})]})}),e.jsxs("section",{className:h.listSection,children:[e.jsx("h2",{className:h.listHeader,children:"Uploaded Documents"}),l?e.jsx("div",{className:h.emptyState,children:e.jsx("p",{className:h.emptyStateText,children:"Loading documents…"})}):s.length===0?e.jsxs("div",{className:h.emptyStateWithFAQ,children:[e.jsx("div",{className:h.emptyState,children:e.jsx("p",{className:h.emptyStateText,children:"No documents uploaded yet. Start by uploading your first document!"})}),e.jsx(no,{showTitle:!0})]}):e.jsx("div",{className:h.documentsList,children:s.map(j=>{var P,D;return e.jsxs("div",{className:h.documentCard,children:[e.jsxs("div",{className:h.documentInfo,children:[e.jsx("h3",{className:h.documentTitle,children:j.title}),e.jsxs("div",{children:[e.jsx("span",{className:h.documentCategory,children:j.category}),j.sourceFile&&e.jsxs("span",{className:h.sourceFileBadge,title:`Uploaded from: ${j.sourceFile.filename}`,children:["📄 ",j.sourceFile.fileType==="docx"?"Word Doc":j.sourceFile.fileType==="pdf"?"PDF":"Text File"]})]}),(((P=j.sourceFile)==null?void 0:P.uploadedAt)||j.uploadedBy)&&e.jsxs("div",{className:h.auditLogSection,children:[((D=j.sourceFile)==null?void 0:D.uploadedAt)&&e.jsxs("div",{className:h.auditLogItem,children:[e.jsx("span",{className:h.auditLogLabel,children:"📅 Uploaded:"}),e.jsx("span",{className:h.auditLogValue,children:new Date(j.sourceFile.uploadedAt).toLocaleString()})]}),j.uploadedBy&&e.jsxs("div",{className:h.auditLogItem,children:[e.jsx("span",{className:h.auditLogLabel,children:"👤 By:"}),e.jsx("span",{className:h.auditLogValue,children:j.uploadedBy.adminName||j.uploadedBy.adminEmail})]})]})]}),e.jsxs("div",{className:h.documentActions,children:[e.jsx("button",{type:"button",className:h.editBtn,onClick:()=>ie(j),children:"Edit"}),e.jsx("button",{type:"button",className:h.deleteBtn,onClick:()=>we(j._id),children:"Delete"})]})]},j._id)})})]}),e.jsxs("div",{className:h.footerCard,children:[e.jsx("p",{className:h.footerText,children:"© 2026 UACN. All rights reserved."}),e.jsx("button",{type:"button",className:h.footerLink,onClick:()=>B(!0),children:"Privacy Policy"})]})]})]}),le&&e.jsx("div",{className:h.logoutConfirmBackdrop,children:e.jsxs("div",{className:h.logoutConfirmCard,children:[e.jsx("div",{className:h.logoutConfirmIcon,children:e.jsx(hn,{size:32})}),e.jsx("h3",{className:h.logoutConfirmTitle,children:"Sign Out?"}),e.jsx("p",{className:h.logoutConfirmMessage,children:"Are you sure you want to sign out? You'll need to log in again to access the admin panel."}),e.jsxs("div",{className:h.logoutConfirmActions,children:[e.jsx("button",{type:"button",className:h.logoutConfirmCancel,onClick:oe,children:"Cancel"}),e.jsx("button",{type:"button",className:h.logoutConfirmConfirm,onClick:de,children:"Sign Out"})]})]})}),Y&&e.jsx(vt,{isOpen:Y,onClose:()=>B(!1),type:"admin"})]}):e.jsx(Ts,{onLoginSuccess:(j,P)=>{a(j),o(P),localStorage.setItem("adminToken",j),localStorage.setItem("adminUser",JSON.stringify(P)),je.defaults.headers.common.Authorization=`Bearer ${j}`}})},lt=[{label:"Grand Cereals Limited (GCL)",value:"GCL"},{label:"Livestocks Feeds PLC (LSF)",value:"LSF"},{label:"Chemical and Allied Products PLC (CAP)",value:"CAP"},{label:"UAC Foods Limited (UFL)",value:"UFL"},{label:"CHI Limited",value:"CHI"},{label:"UAC Restaurants",value:"UAC-Restaurants"},{label:"UPDC",value:"UPDC"},{label:"UACN Group (UACN)",value:"UACN"}],Rt=({onLoginSuccess:t})=>{var Te;const a=typeof window<"u"&&(window.location.pathname.includes("/admin")||window.location.pathname.includes("/UACN-GPT/admin")),[n,o]=i.useState(!0),[s,r]=i.useState(""),[l,c]=i.useState(""),[u,p]=i.useState(""),[d,y]=i.useState(),[b,_]=i.useState(lt),[z,S]=i.useState(!1),[m,g]=i.useState(""),[k,M]=i.useState(!1),[x,F]=i.useState(!1),[le,Z]=i.useState(!1),[Y,B]=i.useState(""),[ee,H]=i.useState(!1),[I,me]=i.useState(""),[ce,de]=i.useState(!1),[oe,te]=i.useState(!1),[ie,Q]=i.useState(""),[ue,ae]=i.useState(""),[pe,fe]=i.useState(!1),[Ne,re]=i.useState(""),[we,j]=i.useState(!1),[P,D]=i.useState(!1),[N,R]=i.useState(!1),[q,W]=i.useState(!1);i.useEffect(()=>{(async()=>{try{const J=await K.get("/api/public/business-units");if(J.data.businessUnits&&J.data.businessUnits.length>0){const ne=J.data.businessUnits.map(X=>typeof X=="string"?lt.find(Re=>Re.value===X)||{label:X,value:X}:{label:X.label||X.name,value:X.name||X.value});_(ne)}}catch(J){console.error("Error fetching business units:",J),_(lt)}})()},[]),i.useEffect(()=>{if(k){const T=setTimeout(()=>{M(!1),o(!0),r(""),c(""),p(""),y("")},3e3);return()=>clearTimeout(T)}},[k]);const Fe=async T=>{var J,ne;if(T.preventDefault(),g(""),!n){D(!0);return}S(!0),localStorage.setItem("authInProgress","true");try{const Ee=`${a?"/api/admin/auth":"/api/auth"}/login`,Re={email:s,password:l},{data:Ce}=await K.post(Ee,Re);localStorage.setItem("token",Ce.token),localStorage.setItem("user",JSON.stringify(Ce.user||Ce.admin)),localStorage.removeItem("authInProgress"),t(Ce.token,Ce.user||Ce.admin)}catch(X){g(((ne=(J=X.response)==null?void 0:J.data)==null?void 0:ne.error)||"An error occurred"),localStorage.removeItem("authInProgress")}finally{S(!1)}},Ie=async()=>{var T,J;R(!0),g(""),localStorage.setItem("authInProgress","true");try{const X=`${a?"/api/admin/auth":"/api/auth"}/register`,Ee={email:s,password:l,fullName:u,businessUnit:d};await K.post(X,Ee),D(!1),ae(s),te(!0)}catch(ne){g(((J=(T=ne.response)==null?void 0:T.data)==null?void 0:J.error)||"An error occurred"),localStorage.removeItem("authInProgress")}finally{R(!1)}},at=()=>{D(!1),g("")},Ae=async T=>{var J,ne;T.preventDefault(),me(""),H(!0);try{const X=a?"/api/admin/auth":"/api/auth";await K.post(`${X}/forgot-password`,{email:Y}),de(!0),B(""),setTimeout(()=>{de(!1),Z(!1)},5e3)}catch(X){me(((ne=(J=X.response)==null?void 0:J.data)==null?void 0:ne.error)||"An error occurred")}finally{H(!1)}},Be=async T=>{var J,ne;T.preventDefault(),re(""),fe(!0);try{const X=a?"/api/admin/auth":"/api/auth";await K.post(`${X}/verify-email`,{email:ue,otp:ie}),j(!0),Q(""),setTimeout(()=>{te(!1),j(!1),o(!0),r(""),c(""),p(""),y("")},3e3)}catch(X){re(((ne=(J=X.response)==null?void 0:J.data)==null?void 0:ne.error)||"Invalid or expired OTP")}finally{fe(!1)}},nt=async()=>{var T,J;re(""),fe(!0);try{const ne=a?"/api/admin/auth":"/api/auth";await K.post(`${ne}/resend-verification`,{email:ue}),re(""),alert("OTP resent to your email!")}catch(ne){re(((J=(T=ne.response)==null?void 0:T.data)==null?void 0:J.error)||"Failed to resend OTP")}finally{fe(!1)}};return e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"login-container",children:[k?e.jsxs("div",{className:"success-card",children:[e.jsx("div",{className:"success-icon",children:e.jsx(Xe,{size:48})}),e.jsx("h2",{className:"success-title",children:"Account Created Successfully!"}),e.jsx("p",{className:"success-message",children:"Your account has been created. Redirecting to login page in 3 seconds..."})]}):e.jsxs(e.Fragment,{children:[a&&e.jsx("div",{className:"logo-section",children:e.jsx("img",{src:"/logo.png",alt:"UACN Logo",className:"brand-logo-above"})}),e.jsxs("div",{className:"login-wrapper",children:[!a&&e.jsx("div",{className:"avatar-image-section",children:e.jsx("video",{src:"/UAC AI AVATAR.mp4",className:"avatar-large-image",autoPlay:!0,loop:!0,muted:!0,playsInline:!0,type:"video/mp4"})}),e.jsxs("div",{className:`login-card ${n&&!a?"login-card-with-avatar":""} ${!n&&!a?"login-card-with-avatar":""}`,children:[e.jsx("div",{className:"login-logo-wrapper",children:e.jsx("img",{src:"/logo.png",alt:"UACN Logo",className:"login-logo-top"})}),e.jsxs("div",{className:"login-card-header",children:[e.jsx("h2",{children:a?n?"Admin Sign In":"Create Admin Account":n?"Welcome Back":"Create Account"}),e.jsx("p",{className:"login-subtitle",children:n?"Sign in to your account":"Create a new UACN GPT account"})]}),e.jsxs("form",{onSubmit:Fe,className:"login-form",children:[!n&&e.jsxs(e.Fragment,{children:[e.jsx("input",{type:"text",placeholder:"Full Name",value:u,onChange:T=>p(T.target.value),required:!n}),e.jsxs("select",{value:d||"",onChange:T=>y(T.target.value),required:!n,children:[e.jsx("option",{value:"",children:"Select a Business Unit"}),b.map(T=>e.jsx("option",{value:T.value,children:T.label},T.value))]})]}),e.jsx("input",{type:"email",placeholder:"Email",value:s,onChange:T=>r(T.target.value),autoComplete:"email",required:!0}),e.jsxs("div",{className:"password-wrapper",children:[e.jsx("input",{type:x?"text":"password",placeholder:"Password",value:l,onChange:T=>c(T.target.value),autoComplete:"current-password",required:!0}),e.jsx("button",{type:"button",className:"password-toggle",onClick:()=>F(!x),tabIndex:-1,children:x?e.jsx(ia,{size:18}):e.jsx(ra,{size:18})})]}),n&&e.jsx("button",{type:"button",className:"forgot-password-link",onClick:()=>Z(!0),children:"Forgot Password?"}),m&&e.jsx("div",{className:"login-error",children:m}),e.jsx("button",{type:"submit",disabled:z,className:"login-btn",children:z?"Loading...":n?"Sign In":"Create Account"})]}),e.jsxs("div",{className:"login-toggle",children:[n?"Don't have an account? ":"Already have an account? ",e.jsx("button",{type:"button",onClick:()=>{o(!n),g("")},className:"toggle-link",children:n?"Sign up":"Sign in"})]}),e.jsx("div",{className:"privacy-policy-link-container",children:e.jsx("button",{type:"button",onClick:()=>W(!0),className:"privacy-policy-login-link",children:"Privacy Policy"})})]})]})]}),le&&e.jsx("div",{className:"forgot-password-modal-overlay",onClick:()=>!ce&&Z(!1),children:e.jsx("div",{className:"forgot-password-modal",onClick:T=>T.stopPropagation(),children:ce?e.jsxs("div",{className:"forgot-password-success",children:[e.jsx("div",{className:"success-icon",children:e.jsx(Xe,{size:48})}),e.jsx("h2",{className:"success-title",children:"Check Your Email"}),e.jsxs("p",{className:"success-message",children:["We've sent a password reset link to ",e.jsx("strong",{children:Y}),". The link will expire in 1 hour."]}),e.jsx("button",{className:"forgot-password-close-btn",onClick:()=>{Z(!1),de(!1)},children:"Got it"})]}):e.jsxs(e.Fragment,{children:[e.jsx("button",{className:"forgot-password-close",onClick:()=>Z(!1),children:e.jsx(pt,{size:24})}),e.jsx("h2",{children:"Reset Your Password"}),e.jsx("p",{className:"forgot-subtitle",children:"Enter the email address associated with your account"}),e.jsxs("form",{onSubmit:Ae,className:"forgot-form",children:[e.jsx("input",{type:"email",placeholder:"Email address",value:Y,onChange:T=>B(T.target.value),required:!0,disabled:ee}),I&&e.jsx("div",{className:"forgot-error",children:I}),e.jsx("button",{type:"submit",disabled:ee,className:"forgot-btn",children:ee?"Sending...":"Send Reset Link"})]})]})})}),P&&e.jsx("div",{className:"confirmation-modal-overlay",onClick:()=>!N&&D(!1),children:e.jsxs("div",{className:"confirmation-modal",onClick:T=>T.stopPropagation(),children:[e.jsx("h2",{children:"Confirm Your Information"}),e.jsx("p",{className:"confirmation-subtitle",children:"Please verify that your information is correct before proceeding"}),e.jsxs("div",{className:"confirmation-details",children:[e.jsxs("div",{className:"confirmation-field",children:[e.jsx("label",{children:"Full Name"}),e.jsx("p",{children:u})]}),e.jsxs("div",{className:"confirmation-field",children:[e.jsx("label",{children:"Business Unit"}),e.jsx("p",{children:((Te=b.find(T=>T.value===d))==null?void 0:Te.label)||d})]}),e.jsxs("div",{className:"confirmation-field",children:[e.jsx("label",{children:"Email"}),e.jsx("p",{children:s})]})]}),m&&e.jsx("div",{className:"confirmation-error",children:m}),e.jsxs("div",{className:"confirmation-actions",children:[e.jsx("button",{type:"button",className:"confirmation-edit-btn",onClick:at,disabled:N,children:"Edit"}),e.jsx("button",{type:"button",className:"confirmation-proceed-btn",onClick:Ie,disabled:N,children:N?"Processing...":"Proceed"})]})]})}),oe&&e.jsx("div",{className:"verification-modal-overlay",onClick:()=>!pe&&te(!1),children:e.jsx("div",{className:"verification-modal",onClick:T=>T.stopPropagation(),children:we?e.jsxs("div",{className:"verification-success",children:[e.jsx("div",{className:"success-icon",children:e.jsx(Xe,{size:48})}),e.jsx("h2",{className:"success-title",children:"Email Verified!"}),e.jsx("p",{className:"success-message",children:"Your email has been verified successfully. Redirecting to login..."})]}):e.jsxs(e.Fragment,{children:[e.jsx("button",{className:"verification-close",onClick:()=>te(!1),disabled:pe,children:e.jsx(pt,{size:24})}),e.jsx("h2",{children:"Verify Your Email"}),e.jsxs("p",{className:"verification-subtitle",children:["Enter the 6-digit verification code sent to ",e.jsx("strong",{children:ue})]}),e.jsxs("form",{onSubmit:Be,className:"verification-form",children:[e.jsx("input",{type:"text",placeholder:"000000",maxLength:6,value:ie,onChange:T=>Q(T.target.value.replace(/\D/g,"")),required:!0,disabled:pe,autoComplete:"off",inputMode:"numeric",style:{textAlign:"center",fontSize:"24px",letterSpacing:"8px",fontWeight:"bold"}}),Ne&&e.jsx("div",{className:"verification-error",children:Ne}),e.jsx("button",{type:"submit",disabled:pe,className:"verification-btn",children:pe?"Verifying...":"Verify"})]}),e.jsxs("div",{className:"verification-footer",children:[e.jsx("p",{className:"resend-text",children:"Didn't receive a code?"}),e.jsx("button",{type:"button",className:"resend-btn",onClick:nt,disabled:pe,children:"Resend OTP"})]})]})})}),q&&e.jsx(vt,{isOpen:q,onClose:()=>W(!1),type:"user"}),e.jsx("style",{children:`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&display=swap');

        .avatar-glow-wrapper {
          position: absolute;
          top: -70px;
          left: 50%;
          transform: translateX(-50%);
          width: 140px;
          height: 140px;
          z-index: 15;
          animation: avatarEnter 0.8s ease-out;
        }

        @keyframes avatarEnter {
          from {
            opacity: 0;
            top: -120px;
            transform: translateX(-50%) scale(0.8);
          }
          to {
            opacity: 1;
            top: -70px;
            transform: translateX(-50%) scale(1);
          }
        }

        .avatar-glow {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, rgba(237, 0, 0, 0.8) 0%, rgba(196, 30, 58, 0.4) 40%, transparent 70%);
          filter: blur(20px);
          animation: pulse 3s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% {
            box-shadow: 0 0 40px rgba(237, 0, 0, 0.6), 0 0 80px rgba(237, 0, 0, 0.3);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 60px rgba(237, 0, 0, 0.8), 0 0 100px rgba(237, 0, 0, 0.4);
            transform: scale(1.05);
          }
        }

        .user-avatar {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
          border: 4px solid rgba(255, 255, 255, 0.9);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3),
                      0 0 0 1px rgba(255, 255, 255, 0.2);
          z-index: 10;
        }

        .login-card-with-avatar {
          padding-top: 3rem;
        }

        .login-container {
          width: 100%;
          height: 100dvh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #000000 0%, #1a1a1a 50%, #ffffff 100%);
          font-family: Georgia, serif;
          padding: 1.5rem;
          position: relative;
          overflow: visible;
        }

        @media (max-width: 640px) {
          .login-container {
            padding: 1rem;
          }
        }

        @media (max-width: 480px) {
          .login-container {
            padding: 0.75rem;
          }
        }

        .login-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(circle at 20% 50%, rgba(237, 0, 0, 0.1) 0%, transparent 50%),
                      radial-gradient(circle at 80% 80%, rgba(196, 30, 58, 0.08) 0%, transparent 50%);
          pointer-events: none;
        }

        .logo-section {
          text-align: center;
          margin-bottom: 2rem;
          position: relative;
          z-index: 1;
          animation: slideDown 0.6s ease-out;
        }

        .brand-logo-above {
          width: 100px;
          height: 100px;
          object-fit: contain;
          object-position: center;
          filter: drop-shadow(0 4px 15px rgba(237, 0, 0, 0.2));
        }

        .brand-logo-above-signup {
          width: 90px;
          height: 90px;
          object-fit: contain;
          object-position: center;
          filter: drop-shadow(0 4px 15px rgba(237, 0, 0, 0.2));
          margin-bottom: 0.5rem;
        }

        @keyframes logoFloat {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }

        .login-wrapper {
          display: flex;
          align-items: center;
          gap: 2rem;
          max-width: 1200px;
          width: 100%;
        }

        @media (max-width: 1024px) {
          .login-wrapper {
            gap: 1.5rem;
          }
        }

        @media (max-width: 768px) {
          .login-wrapper {
            flex-direction: column;
            gap: 1rem;
          }
        }

        .avatar-image-section {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        @media (max-width: 640px) {
          .avatar-image-section {
            display: none;
          }
        }

        .avatar-large-image {
          width: 500px;
          height: 600px;
          object-fit: cover;
          object-position: top;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        }

        @media (max-width: 1024px) {
          .avatar-large-image {
            width: 380px;
            height: 450px;
          }
        }

        @media (max-width: 768px) {
          .avatar-large-image {
            width: 300px;
            height: 380px;
          }
        }

        .login-logo-on-card {
          text-align: center;
          margin-bottom: 1.5rem;
        }

        .card-logo {
          width: 70px;
          height: auto;
          object-fit: contain;
        }

        .login-logo-wrapper {
          position: absolute;
          top: -100px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 20;
          display: flex;
          justify-content: center;
          align-items: center;
          animation: loginLogoFadeIn 0.8s ease-out;
        }

        .login-logo-top {
          width: 90px;
          height: auto;
          object-fit: contain;
          display: block;
        }

        @keyframes loginLogoFadeIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .login-card {
          background: rgba(30, 40, 60, 0.85);
          border-radius: 20px;
          padding: 2.5rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4),
                      0 0 1px rgba(237, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(10px);
          width: 100%;
          max-width: 420px;
          position: relative;
          z-index: 2;
          animation: fadeInUp 0.8s ease-out 0.2s both;
          transition: all 0.3s ease;
          overflow: visible;
          margin-top: 3rem;
        }

        @media (max-width: 640px) {
          .login-card {
            padding: 2rem;
            max-width: 100%;
            border-radius: 16px;
            margin-top: 2.5rem;
          }
        }

        @media (max-width: 480px) {
          .login-card {
            padding: 1.5rem;
            margin-top: 2rem;
            border-radius: 12px;
          }
        }

        .login-card-with-avatar {
          background: rgba(25, 35, 55, 0.9);
          max-width: 480px;
          padding-top: 3rem;
        }

        @media (max-width: 768px) {
          .login-card-with-avatar {
            max-width: 100%;
            padding-top: 3rem;
            padding-bottom: 10rem;
          }
        }

        @media (max-width: 640px) {
          .login-card-with-avatar {
            padding: 2rem;
            padding-top: 3rem;
          }
        }

        @media (max-width: 480px) {
          .login-card-with-avatar {
            padding: 1.5rem;
            padding-top: 3rem;
          }
        }

        .login-card-signup {
          background: rgba(25, 35, 55, 0.92);
          max-width: 500px;
        }

        @media (max-width: 768px) {
          .login-card-signup {
            max-width: 100%;
            padding-bottom: 10rem;
          }
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .login-card-header {
          text-align: center;
          margin-bottom: 2rem;
        }

        .login-card-header h2 {
          color: #ffffff;
          margin: 0 0 0.5rem 0;
          font-size: 2rem;
          font-weight: 700;
          letter-spacing: -0.5px;
        }

        @media (max-width: 768px) {
          .login-card-header h2 {
            font-size: 1.5rem;
          }
        }

        @media (max-width: 640px) {
          .login-card-header h2 {
            font-size: 1.375rem;
          }
        }

        @media (max-width: 480px) {
          .login-card-header h2 {
            font-size: 1.25rem;
          }
        }

        .login-card-with-avatar .login-card-header h2 {
          font-size: 2.2rem;
          margin-bottom: 0.75rem;
        }

        @media (max-width: 768px) {
          .login-card-with-avatar .login-card-header h2 {
            font-size: 1.75rem;
          }
        }

        @media (max-width: 640px) {
          .login-card-with-avatar .login-card-header h2 {
            font-size: 1.5rem;
          }
        }

        @media (max-width: 480px) {
          .login-card-with-avatar .login-card-header h2 {
            font-size: 1.375rem;
          }
        }

        .login-card-signup .login-card-header h2 {
          font-size: 1.9rem;
          margin-bottom: 0.5rem;
        }

        @media (max-width: 768px) {
          .login-card-signup .login-card-header h2 {
            font-size: 1.6rem;
          }
        }

        @media (max-width: 640px) {
          .login-card-signup .login-card-header h2 {
            font-size: 1.4rem;
          }
        }

        @media (max-width: 480px) {
          .login-card-signup .login-card-header h2 {
            font-size: 1.25rem;
          }
        }

        .login-subtitle {
          color: #b0b8c8;
          font-size: 1rem;
          margin: 0;
          font-weight: 400;
        }

        @media (max-width: 640px) {
          .login-subtitle {
            font-size: 0.9rem;
          }
        }

        @media (max-width: 480px) {
          .login-subtitle {
            font-size: 0.85rem;
          }
        }

        .login-card-with-avatar .login-subtitle {
          color: #a8b0c0;
          font-size: 1.05rem;
        }

        @media (max-width: 640px) {
          .login-card-with-avatar .login-subtitle {
            font-size: 0.95rem;
          }
        }

        @media (max-width: 480px) {
          .login-card-with-avatar .login-subtitle {
            font-size: 0.85rem;
          }
        }

        .login-card-signup .login-subtitle {
          color: #a8b0c0;
          font-size: 0.95rem;
        }

        @media (max-width: 480px) {
          .login-card-signup .login-subtitle {
            font-size: 0.8rem;
          }
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          position: relative;
          z-index: 1;
        }

        @media (max-width: 640px) {
          .login-form {
            overflow: visible;
          }
        }

        .login-form input {
          padding: 0.875rem 1.2rem;
          border: 1px solid #d0d0d0;
          border-radius: 10px;
          font-size: 1rem;
          font-family: Georgia, inherit;
          color: #333333;
          background: rgba(255, 255, 255, 0.95);
          transition: all 0.3s ease;
        }

        @media (max-width: 640px) {
          .login-form input {
            padding: 0.875rem;
            font-size: 1rem;
            border-radius: 8px;
            min-height: 48px;
          }
        }

        @media (max-width: 480px) {
          .login-form input {
            padding: 0.875rem;
            font-size: 1rem;
            border-radius: 8px;
            min-height: 44px;
          }
        }

        .login-card-with-avatar .login-form input {
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.92);
        }

        .login-form input:focus {
          outline: none;
          border-color: #ed0000;
          background: rgba(255, 255, 255, 1);
          box-shadow: 0 0 0 3px rgba(237, 0, 0, 0.15);
          transform: translateY(-2px);
        }

        @media (max-width: 480px) {
          .login-form input:focus {
            transform: translateY(0);
          }
        }

        .login-form input::placeholder {
          color: #aaa;
        }

        .login-form select {
          padding: 0.875rem 1.2rem;
          border: 1px solid #d0d0d0;
          border-radius: 10px;
          font-size: 1rem;
          font-family: Georgia, inherit;
          color: #333333;
          background: rgba(255, 255, 255, 0.95);
          transition: all 0.3s ease;
          appearance: none;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
          background-repeat: no-repeat;
          background-position: right 0.75rem center;
          background-size: 20px;
          padding-right: 2.5rem;
          cursor: pointer;
          position: relative;
          z-index: 10;
        }

        @media (max-width: 640px) {
          .login-form select {
            padding: 0.875rem;
            padding-right: 2.5rem;
            font-size: 1rem;
            border-radius: 8px;
            min-height: 48px;
            /* Ensure dropdown appears within viewport on mobile */
            max-height: 200px;
          }
        }

        @media (max-width: 480px) {
          .login-form select {
            min-height: 44px;
            font-size: 0.95rem;
            max-height: 180px;
          }
        }

        .login-card-signup .login-form select {
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.92);
        }

        .login-form select:focus {
          outline: none;
          border-color: #ed0000;
          background-color: rgba(255, 255, 255, 1);
          box-shadow: 0 0 0 3px rgba(237, 0, 0, 0.15);
          transform: translateY(-2px);
        }

        @media (max-width: 480px) {
          .login-form select:focus {
            transform: translateY(0);
          }
        }

        .login-form select:hover {
          border-color: #d0d0d0;
          background-color: rgba(255, 255, 255, 0.98);
        }

        .login-form select option {
          color: #333333;
          background: rgba(255, 255, 255, 1);
          padding: 0.5rem 1rem;
        }

        .login-form select option:checked {
          background: linear-gradient(#ed0000, #ed0000);
          background-color: #ed0000;
          color: white;
        }

        .password-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .password-wrapper input {
          width: 100%;
          padding-right: 2.75rem;
        }

        .password-toggle {
          position: absolute;
          right: 0.75rem;
          background: none;
          border: none;
          font-size: 1.2rem;
          cursor: pointer;
          padding: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.2s;
          color: #666;
        }

        .password-toggle:active {
          opacity: 0.6;
        }

        .login-btn {
          padding: 0.875rem;
          background: linear-gradient(135deg, #ef5350 0%, #d32f2f 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 1rem;
          font-family: Georgia, inherit;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(237, 0, 0, 0.3);
          margin-top: 0.75rem;
          letter-spacing: 0.3px;
          min-height: 44px;
        }

        @media (max-width: 640px) {
          .login-btn {
            min-height: 48px;
            font-size: 1rem;
          }
        }

        @media (max-width: 480px) {
          .login-btn {
            min-height: 44px;
          }
        }

        .login-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(237, 0, 0, 0.4);
        }

        @media (max-width: 480px) {
          .login-btn:hover:not(:disabled) {
            transform: translateY(0);
          }
        }

        .login-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .login-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .login-error {
          background: rgba(255, 71, 87, 0.15);
          color: #ff6b7a;
          padding: 0.875rem;
          border-radius: 8px;
          font-size: 0.95rem;
          text-align: center;
          font-family: Georgia, inherit;
          border-left: 3px solid #ff6b7a;
          animation: shake 0.3s ease-in-out;
        }

        .login-toggle {
          text-align: center;
          margin-top: 1.75rem;
          font-size: 0.95rem;
          color: #a8b0c0;
          font-family: Georgia, inherit;
        }

        .toggle-link {
          background: none;
          border: none;
          color: #ff6b7a;
          cursor: pointer;
          font-weight: 600;
          text-decoration: none;
          transition: all 0.2s;
          padding: 0;
          font-size: 0.95rem;
        }

        .toggle-link:hover {
          color: #ff8a96;
          text-decoration: underline;
        }

        .login-card-with-avatar .login-toggle {
          color: #a8b0c0;
        }

        .login-card-with-avatar .toggle-link {
          color: #ff7a88;
        }

        .login-card-with-avatar .toggle-link:hover {
          color: #ff9aa5;
        }

        .toggle-separator {
          color: #cccccc;
          margin: 0 0.5rem;
          font-size: 0.9rem;
        }

        .forgot-password-link {
          align-self: flex-end;
          background: none;
          border: none;
          color: #ff7a88;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 500;
          padding: 0;
          text-decoration: none;
          transition: all 0.2s;
          margin-top: -0.25rem;
          margin-bottom: 0.5rem;
          font-family: Georgia, inherit;
        }

        .forgot-password-link:hover {
          color: #ff9aa5;
          text-decoration: underline;
        }

        .login-card-with-avatar .forgot-password-link {
          color: #ff8a96;
        }

        .login-card-with-avatar .forgot-password-link:hover {
          color: #ffaab9;
        }

        /* Forgot Password Modal */
        .forgot-password-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.3s ease-out;
        }

        .forgot-password-modal {
          background: rgba(30, 40, 60, 0.85);
          border-radius: 20px;
          padding: 2.5rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4),
                      0 0 1px rgba(237, 0, 0, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.15);
          width: 100%;
          max-width: 400px;
          position: relative;
          animation: slideUp 0.4s ease-out;
          backdrop-filter: blur(10px);
        }

        @media (max-width: 640px) {
          .forgot-password-modal {
            padding: 2rem;
            border-radius: 16px;
            max-width: 100%;
            margin: 0 1rem;
          }
        }

        @media (max-width: 480px) {
          .forgot-password-modal {
            padding: 1.5rem;
            border-radius: 12px;
            margin: 0 1rem;
          }
        }

        .forgot-password-modal h2 {
          color: #ffffff;
          margin: 0 0 0.5rem 0;
          font-size: 1.5rem;
          font-weight: 700;
          letter-spacing: -0.5px;
        }

        @media (max-width: 640px) {
          .forgot-password-modal h2 {
            font-size: 1.25rem;
          }
        }

        @media (max-width: 480px) {
          .forgot-password-modal h2 {
            font-size: 1.1rem;
          }
        }

        .forgot-subtitle {
          color: #b0b8c8;
          font-size: 1rem;
          margin: 0 0 1.5rem 0;
          line-height: 1.5;
        }

        @media (max-width: 640px) {
          .forgot-subtitle {
            font-size: 0.9rem;
          }
        }

        @media (max-width: 480px) {
          .forgot-subtitle {
            font-size: 0.85rem;
            margin: 0 0 1rem 0;
          }
        }

        .forgot-form input {
          padding: 0.875rem 1.2rem;
          border: 1px solid #d0d0d0;
          border-radius: 10px;
          font-size: 1rem;
          font-family: Georgia, inherit;
          color: #333333;
          background: rgba(255, 255, 255, 0.95);
          transition: all 0.3s ease;
          min-height: 44px;
        }

        @media (max-width: 640px) {
          .forgot-form input {
            font-size: 1rem;
            padding: 0.875rem;
            border-radius: 8px;
            min-height: 48px;
          }
        }

        @media (max-width: 480px) {
          .forgot-form input {
            min-height: 44px;
          }
        }

        .forgot-btn {
          padding: 0.875rem;
          background: linear-gradient(135deg, #ef5350 0%, #d32f2f 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 1rem;
          font-family: Georgia, inherit;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(237, 0, 0, 0.3);
          letter-spacing: 0.3px;
          margin-top: 0.75rem;
          min-height: 44px;
        }

        @media (max-width: 640px) {
          .forgot-btn {
            font-size: 0.95rem;
            min-height: 48px;
          }
        }

        @media (max-width: 480px) {
          .forgot-btn {
            min-height: 44px;
          }
        }

        .forgot-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(237, 0, 0, 0.4);
        }

        @media (max-width: 480px) {
          .forgot-btn:hover:not(:disabled) {
            transform: translateY(0);
          }
        }

        .forgot-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .forgot-password-success {
          text-align: center;
          padding: 1rem 0;
        }

        .forgot-password-close-btn {
          margin-top: 1.5rem;
          padding: 0.75rem 2rem;
          background: linear-gradient(135deg, #ed0000 0%, #c41e3a 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Noto Sans JP', inherit;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(237, 0, 0, 0.3);
        }

        .forgot-password-close-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(237, 0, 0, 0.4);
        }

        .success-card {
          background: rgba(255, 255, 255, 0.95);
          border-radius: 16px;
          padding: 3rem 2.5rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.3);
          text-align: center;
          width: 100%;
          max-width: 400px;
          animation: slideIn 0.3s ease-out;
          position: relative;
          z-index: 2;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .success-icon {
          font-size: 3rem;
          color: #22c55e;
          margin-bottom: 1rem;
          font-weight: bold;
          animation: scaleIn 0.4s ease-out;
        }

        @keyframes scaleIn {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        .success-title {
          font-size: 1.5rem;
          color: #1a1a1a;
          font-family: 'Noto Sans JP', inherit;
          margin: 0 0 0.75rem 0;
          font-weight: 700;
        }

        .success-message {
          font-size: 0.95rem;
          color: #666666;
          font-family: 'Noto Sans JP', inherit;
          margin: 0;
          line-height: 1.6;
        }

        /* Mobile Responsive Styling */
        @media (max-width: 768px) {
          .login-container {
            padding: 1rem;
          }

          .login-wrapper {
            flex-direction: column;
            gap: 1.5rem;
          }

          .avatar-large-image {
            width: 300px;
            height: 380px;
          }

          .avatar-glow-wrapper {
            width: 120px;
            height: 120px;
            top: -60px;
          }

          .brand-logo-above {
            width: 80px;
            height: 80px;
          }

          .brand-logo-above-signup {
            width: 75px;
            height: 75px;
          }

          .logo-section {
            margin-bottom: 1.5rem;
          }

          .login-card {
            padding: 2rem 1.5rem;
            max-width: 100%;
            border-radius: 12px;
            margin-top: 2.5rem;
          }

          .login-card-with-avatar {
            max-width: 100%;
            padding-top: 3.5rem;
          }

          .login-card-signup {
            max-width: 100%;
          }

          .login-card-header h2 {
            font-size: 1.5rem;
            margin-bottom: 0.5rem;
          }

          .login-card-with-avatar .login-card-header h2 {
            font-size: 1.75rem;
          }

          .login-card-signup .login-card-header h2 {
            font-size: 1.6rem;
          }

          .login-subtitle {
            font-size: 0.9rem;
          }

          .login-form {
            gap: 0.875rem;
          }

          .login-form input {
            padding: 0.75rem;
            font-size: 1rem;
            border-radius: 6px;
          }

          .login-form select {
            padding: 0.75rem 1rem;
            font-size: 0.95rem;
            border-radius: 6px;
          }

          .password-wrapper input {
            padding-right: 2.25rem;
          }

          .success-card {
            padding: 2rem 1.5rem;
            max-width: 100%;
          }

          .success-icon {
            font-size: 2.5rem;
            margin-bottom: 0.75rem;
          }

          .success-title {
            font-size: 1.25rem;
          }
        }

        @media (max-width: 480px) {
          .login-wrapper {
            flex-direction: column;
            gap: 1rem;
          }

          .avatar-large-image {
            width: 250px;
            height: 320px;
            border-radius: 15px;
          }

          .avatar-glow-wrapper {
            width: 100px;
            height: 100px;
            top: -50px;
          }

          .brand-logo-above {
            width: 70px;
            height: 70px;
          }

          .brand-logo-above-signup {
            width: 65px;
            height: 65px;
          }

          .login-card {
            padding: 1.5rem;
            margin-top: 2rem;
          }

          .login-card-with-avatar {
            padding-top: 3rem;
          }

          .login-card-signup {
            padding: 1.75rem 1.5rem;
          }

          .login-card-header h2 {
            font-size: 1.25rem;
          }

          .login-card-with-avatar .login-card-header h2 {
            font-size: 1.5rem;
          }

          .login-card-signup .login-card-header h2 {
            font-size: 1.35rem;
          }

          .login-form input {
            padding: 0.75rem;
            font-size: 1rem;
          }

          .login-form select {
            padding: 0.75rem;
            font-size: 0.95rem;
          }

          .forgot-password-modal {
            margin: 0 1rem;
            padding: 2rem 1.5rem;
          }

          .forgot-password-modal h2 {
            font-size: 1.25rem;
          }

          .forgot-subtitle {
            font-size: 0.85rem;
          }

          .forgot-form input {
            font-size: 1rem;
            padding: 0.75rem;
          }

          .forgot-btn {
            font-size: 0.95rem;
          }
        }

        /* Confirmation Modal Styles */
        .confirmation-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
          animation: fadeIn 0.3s ease-out;
        }

        .confirmation-modal {
          background: rgba(255, 255, 255, 0.98);
          border-radius: 16px;
          padding: 2.5rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.3);
          width: 90%;
          max-width: 450px;
          position: relative;
          animation: slideUp 0.4s ease-out;
        }

        @media (max-width: 640px) {
          .confirmation-modal {
            padding: 2rem;
            border-radius: 12px;
            max-width: 100%;
            width: 95%;
          }
        }

        @media (max-width: 480px) {
          .confirmation-modal {
            padding: 1.5rem;
            border-radius: 12px;
            width: 95%;
          }
        }

        .confirmation-modal h2 {
          color: #1a1a1a;
          margin: 0 0 0.5rem 0;
          font-size: 1.5rem;
          font-weight: 700;
          text-align: center;
        }

        @media (max-width: 640px) {
          .confirmation-modal h2 {
            font-size: 1.25rem;
          }
        }

        @media (max-width: 480px) {
          .confirmation-modal h2 {
            font-size: 1.1rem;
          }
        }

        .confirmation-subtitle {
          color: #666;
          font-size: 0.9rem;
          margin: 0 0 1.5rem 0;
          line-height: 1.5;
          text-align: center;
        }

        @media (max-width: 640px) {
          .confirmation-subtitle {
            font-size: 0.85rem;
            margin: 0 0 1rem 0;
          }
        }

        @media (max-width: 480px) {
          .confirmation-subtitle {
            font-size: 0.8rem;
          }
        }

        .confirmation-details {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          margin: 2rem 0;
          padding: 1.5rem;
          background: rgba(237, 0, 0, 0.05);
          border-radius: 10px;
          border-left: 4px solid #ed0000;
        }

        @media (max-width: 640px) {
          .confirmation-details {
            padding: 1rem;
            margin: 1.5rem 0;
            gap: 1rem;
          }
        }

        @media (max-width: 480px) {
          .confirmation-details {
            padding: 1rem;
            gap: 0.75rem;
          }
        }

        .confirmation-field label {
          color: #666;
          font-size: 0.85rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        @media (max-width: 640px) {
          .confirmation-field label {
            font-size: 0.75rem;
          }
        }

        .confirmation-field p {
          color: #1a1a1a;
          font-size: 1rem;
          margin: 0;
          font-weight: 500;
          word-break: break-all;
        }

        @media (max-width: 640px) {
          .confirmation-field p {
            font-size: 0.9rem;
          }
        }

        .confirmation-actions {
          display: flex;
          gap: 1rem;
          margin-top: 1.5rem;
        }

        @media (max-width: 640px) {
          .confirmation-actions {
            gap: 0.75rem;
            margin-top: 1rem;
          }
        }

        .confirmation-edit-btn, .confirmation-proceed-btn {
          flex: 1;
          padding: 0.6rem 0.75rem;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          font-size: 0.9rem;
          font-family: Georgia, inherit;
          transition: all 0.3s ease;
          letter-spacing: 0.3px;
          min-height: 44px;
        }

        @media (max-width: 640px) {
          .confirmation-edit-btn, .confirmation-proceed-btn {
            padding: 0.75rem;
            font-size: 0.85rem;
            min-height: 44px;
          }
        }

        @media (max-width: 480px) {
          .confirmation-edit-btn, .confirmation-proceed-btn {
            font-size: 0.8rem;
            min-height: 44px;
          }
        }

        .confirmation-edit-btn {
          background: rgba(237, 0, 0, 0.1);
          color: #ed0000;
          border: 2px solid #ed0000;
        }

        .confirmation-edit-btn:hover:not(:disabled) {
          background: rgba(237, 0, 0, 0.2);
          transform: translateY(-2px);
        }

        @media (max-width: 480px) {
          .confirmation-edit-btn:hover:not(:disabled) {
            transform: translateY(0);
          }
        }

        .confirmation-proceed-btn {
          background: linear-gradient(135deg, #ed0000 0%, #c41e3a 100%);
          color: white;
          box-shadow: 0 4px 15px rgba(237, 0, 0, 0.3);
        }

        .confirmation-proceed-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(237, 0, 0, 0.4);
        }

        @media (max-width: 480px) {
          .confirmation-proceed-btn:hover:not(:disabled) {
            transform: translateY(0);
          }
        }

        .confirmation-edit-btn:disabled,
        .confirmation-proceed-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .verification-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }

        .verification-modal {
          background: rgba(255, 255, 255, 0.98);
          border-radius: 16px;
          padding: 2.5rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.3);
          width: 90%;
          max-width: 450px;
          position: relative;
          animation: slideIn 0.3s ease-out;
        }

        @media (max-width: 640px) {
          .verification-modal {
            padding: 2rem;
            border-radius: 12px;
            max-width: 100%;
            width: 95%;
          }
        }

        @media (max-width: 480px) {
          .verification-modal {
            padding: 1.5rem;
            border-radius: 12px;
            width: 95%;
          }
        }

        .verification-modal h2 {
          color: #1a1a1a;
          margin: 0 0 0.5rem 0;
          font-size: 1.5rem;
          font-weight: 700;
        }

        @media (max-width: 640px) {
          .verification-modal h2 {
            font-size: 1.25rem;
          }
        }

        @media (max-width: 480px) {
          .verification-modal h2 {
            font-size: 1.1rem;
          }
        }

        .verification-subtitle {
          color: #666;
          font-size: 0.9rem;
          margin: 0.5rem 0 1.5rem 0;
          line-height: 1.5;
        }

        @media (max-width: 640px) {
          .verification-subtitle {
            font-size: 0.85rem;
            margin: 0.5rem 0 1rem 0;
          }
        }

        @media (max-width: 480px) {
          .verification-subtitle {
            font-size: 0.8rem;
          }
        }

        .verification-form input {
          padding: 1rem;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 1.5rem;
          font-family: 'Courier New', monospace;
          color: #333;
          background: rgba(255, 255, 255, 0.8);
          transition: all 0.3s ease;
          text-align: center;
          letter-spacing: 8px;
          font-weight: bold;
          min-height: 48px;
        }

        @media (max-width: 640px) {
          .verification-form input {
            font-size: 1.25rem;
            padding: 0.875rem;
            border-radius: 6px;
          }
        }

        @media (max-width: 480px) {
          .verification-form input {
            font-size: 1.1rem;
            min-height: 44px;
          }
        }

        .verification-form input:focus {
          outline: none;
          border-color: #ed0000;
          background: rgba(255, 255, 255, 1);
          box-shadow: 0 0 0 3px rgba(237, 0, 0, 0.1);
        }

        .verification-form input::placeholder {
          color: #bbb;
          letter-spacing: normal;
        }

        .verification-btn {
          padding: 0.875rem 1.5rem;
          background: linear-gradient(135deg, #ed0000 0%, #c41e3a 100%);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          font-family: 'Noto Sans JP', inherit;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(237, 0, 0, 0.3);
          min-height: 44px;
        }

        @media (max-width: 640px) {
          .verification-btn {
            font-size: 0.9rem;
            min-height: 48px;
          }
        }

        @media (max-width: 480px) {
          .verification-btn {
            min-height: 44px;
          }
        }

        .verification-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(237, 0, 0, 0.4);
        }

        @media (max-width: 480px) {
          .verification-btn:hover:not(:disabled) {
            transform: translateY(0);
          }
        }

        .verification-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .verification-footer {
          margin-top: 1.5rem;
          text-align: center;
          border-top: 1px solid #f0f0f0;
          padding-top: 1.5rem;
        }

        @media (max-width: 640px) {
          .verification-footer {
            margin-top: 1rem;
            padding-top: 1rem;
          }
        }

        .resend-text {
          color: #999;
          font-size: 0.85rem;
          margin: 0 0 0.5rem 0;
        }

        @media (max-width: 640px) {
          .resend-text {
            font-size: 0.8rem;
          }
        }

        .resend-btn {
          background: none;
          border: none;
          color: #ed0000;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          padding: 0.5rem 1rem;
          text-decoration: underline;
          font-family: 'Noto Sans JP', inherit;
          min-height: 44px;
        }

        @media (max-width: 640px) {
          .resend-btn {
            font-size: 0.85rem;
            padding: 0.5rem;
          }
        }

        .resend-btn:hover:not(:disabled) {
          color: #c41e3a;
          text-decoration: none;
        }

        @media (max-width: 480px) {
          .resend-btn:hover:not(:disabled) {
            color: #ed0000;
          }
        }

        .resend-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .verification-success {
          text-align: center;
          padding: 1rem 0;
        }

        /* Privacy Policy Link in Login Card */
        .privacy-policy-link-container {
          text-align: center;
          margin-top: 1rem;
        }

        .privacy-policy-login-link {
          background: none;
          border: none;
          color: #ff7a88;
          cursor: pointer;
          font-size: 0.85rem;
          font-weight: 600;
          text-decoration: underline;
          transition: all 0.2s;
          padding: 0;
          font-family: Georgia, inherit;
        }

        .privacy-policy-login-link:hover {
          color: #ff9aa5;
        }

        @media (max-width: 640px) {
          .privacy-policy-login-link {
            font-size: 0.8rem;
          }
        }

        @media (max-width: 480px) {
          .privacy-policy-link-container {
            margin-top: 0.75rem;
          }

          .privacy-policy-login-link {
            font-size: 0.75rem;
          }
        }
      `})]}),e.jsx(wt,{type:"user"})]})};function Ar(t){return se({attr:{fill:"currentColor",viewBox:"0 0 16 16"},child:[{tag:"path",attr:{d:"M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"},child:[]},{tag:"path",attr:{d:"m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0"},child:[]}]})(t)}function Tr(t){return se({attr:{fill:"currentColor",viewBox:"0 0 16 16"},child:[{tag:"path",attr:{d:"M8.707 1.5a1 1 0 0 0-1.414 0L.646 8.146a.5.5 0 0 0 .708.708L2 8.207V13.5A1.5 1.5 0 0 0 3.5 15h9a1.5 1.5 0 0 0 1.5-1.5V8.207l.646.647a.5.5 0 0 0 .708-.708L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293zM13 7.207V13.5a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5V7.207l5-5z"},child:[]}]})(t)}function Mr(t){return se({attr:{fill:"currentColor",viewBox:"0 0 16 16"},child:[{tag:"path",attr:{d:"M2.678 11.894a1 1 0 0 1 .287.801 11 11 0 0 1-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 0 1 .71-.074A8 8 0 0 0 8 14c3.996 0 7-2.807 7-6s-3.004-6-7-6-7 2.808-7 6c0 1.468.617 2.83 1.678 3.894m-.493 3.905a22 22 0 0 1-.713.129c-.2.032-.352-.176-.273-.362a10 10 0 0 0 .244-.637l.003-.01c.248-.72.45-1.548.524-2.319C.743 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7a9 9 0 0 1-2.347-.306c-.52.263-1.639.742-3.468 1.105"},child:[]}]})(t)}function Pr(t){return se({attr:{fill:"currentColor",viewBox:"0 0 16 16"},child:[{tag:"path",attr:{d:"M5 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0m4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0m3 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2"},child:[]},{tag:"path",attr:{d:"m2.165 15.803.02-.004c1.83-.363 2.948-.842 3.468-1.105A9 9 0 0 0 8 15c4.418 0 8-3.134 8-7s-3.582-7-8-7-8 3.134-8 7c0 1.76.743 3.37 1.97 4.6a10.4 10.4 0 0 1-.524 2.318l-.003.011a11 11 0 0 1-.244.637c-.079.186.074.394.273.362a22 22 0 0 0 .693-.125m.8-3.108a1 1 0 0 0-.287-.801C1.618 10.83 1 9.468 1 8c0-3.192 3.004-6 7-6s7 2.808 7 6-3.004 6-7 6a8 8 0 0 1-2.088-.272 1 1 0 0 0-.711.074c-.387.196-1.24.57-2.634.893a11 11 0 0 0 .398-2"},child:[]}]})(t)}const Pe=({isVisible:t,children:a})=>t?e.jsx(e.Fragment,{children:a}):null,Br="_chatbotContainer_3eeq_63",Er="_chatbotButton_3eeq_73",Ur="_chatbotButtonText_3eeq_88",Dr="_chatbotOverlay_3eeq_92",Fr="_chatbotContent_3eeq_99",Rr="_chatbotContentMain_3eeq_124",qr="_chatbotTabButtonsContainer_3eeq_254",Or="_chatbotTabButtonsItem_3eeq_264",Wr="_chatbotTabButtonsLabel_3eeq_278",Vr="_chatbotTabButtonsIcon_3eeq_285",Gr="_chatbotHome_3eeq_292",$r="_chatbotHomeTitle_3eeq_298",Hr="_chatbotRecentMessage_3eeq_306",Yr="_chatbotRecentMessageTitle_3eeq_315",Jr="_chatbotSendMessage_3eeq_325",Xr="_chatbotSendMessageText_3eeq_344",Kr="_chatbotSendMessageIcon_3eeq_351",Zr="_lastChatContainer_3eeq_598",Qr="_lastChatContent_3eeq_606",ei="_lastChatContentBordered_3eeq_628",ti="_lastChatContentDetails_3eeq_633",ai="_lastChatContentIcon_3eeq_638",ni="_lastChatContentIconText_3eeq_648",si="_lastChatContentTitle_3eeq_653",oi="_lastChatContentDescription_3eeq_665",ri="_lastChatContentChevron_3eeq_680",ii="_messageListContainer_3eeq_693",li="_messageListContainerHeader_3eeq_704",ci="_messageListContainerHeaderLabel_3eeq_721",di="_messageListContent_3eeq_728",mi="_messageListLogo_3eeq_741",ui="_messageListBanner_3eeq_747",pi="_messageListBannerTitle_3eeq_759",hi="_messageListBannerIcon_3eeq_764",gi="_messageListItem_3eeq_769",fi="_messageListItemIcon_3eeq_777",xi="_messageListItemWrapper_3eeq_781",bi="_messageListItemDetails_3eeq_798",yi="_messageListEnquiry_3eeq_809",vi="_messageListEnquiryContainer_3eeq_820",wi="_messageListEnquiryContainerWrapper_3eeq_827",ji="_messageSuperFlex_3eeq_835",_i="_messageListUserItem_3eeq_839",Ni="_messageListUserItemWrapper_3eeq_848",Ci="_messageListUserItemDetails_3eeq_859",ki="_messageListInputContainer_3eeq_866",Si="_messageListInput_3eeq_866",zi="_messageListInputButton_3eeq_896",Li="_messageListInputButtonDisabled_3eeq_909",Ii="_messageListInputForm_3eeq_915",C={chatbotContainer:Br,chatbotButton:Er,chatbotButtonText:Ur,chatbotOverlay:Dr,chatbotContent:Fr,chatbotContentMain:Rr,chatbotTabButtonsContainer:qr,chatbotTabButtonsItem:Or,chatbotTabButtonsLabel:Wr,chatbotTabButtonsIcon:Vr,chatbotHome:Gr,chatbotHomeTitle:$r,chatbotRecentMessage:Hr,chatbotRecentMessageTitle:Yr,chatbotSendMessage:Jr,chatbotSendMessageText:Xr,chatbotSendMessageIcon:Kr,lastChatContainer:Zr,lastChatContent:Qr,lastChatContentBordered:ei,lastChatContentDetails:ti,lastChatContentIcon:ai,lastChatContentIconText:ni,lastChatContentTitle:si,lastChatContentDescription:oi,lastChatContentChevron:ri,messageListContainer:ii,messageListContainerHeader:li,messageListContainerHeaderLabel:ci,messageListContent:di,messageListLogo:mi,messageListBanner:ui,messageListBannerTitle:pi,messageListBannerIcon:hi,messageListItem:gi,messageListItemIcon:fi,messageListItemWrapper:xi,messageListItemDetails:bi,messageListEnquiry:yi,messageListEnquiryContainer:vi,messageListEnquiryContainerWrapper:wi,messageSuperFlex:ji,messageListUserItem:_i,messageListUserItemWrapper:Ni,messageListUserItemDetails:Ci,messageListInputContainer:ki,messageListInput:Si,messageListInputButton:zi,messageListInputButtonDisabled:Li,messageListInputForm:Ii},Ai=({onClickLastChat:t,showBorder:a=!0})=>{const n=localStorage.getItem("ufl_last_chat_message");return e.jsx("div",{className:`${C.lastChatContainer} ${a?C.lastChatContentBordered:""}`,children:e.jsxs("div",{className:C.lastChatContent,children:[e.jsx("div",{className:C.lastChatContentIcon,children:e.jsx(ln,{size:24,className:C.lastChatContentIconText})}),e.jsxs("div",{className:C.lastChatContentDetails,children:[e.jsx("p",{className:C.lastChatContentTitle,children:n?"Continue chatting":"No recent messages"}),e.jsx("p",{className:C.lastChatContentDescription,children:n||"Tap here to start a new conversation"})]}),e.jsx("button",{onClick:t,style:{background:"transparent",border:"none",cursor:"pointer",padding:0,display:"flex",alignItems:"center"},children:e.jsx(rn,{className:C.lastChatContentChevron})})]})})},Ti=({onChangeTab:t})=>e.jsxs("div",{className:C.chatbotHome,children:[e.jsx("img",{src:tt,alt:"ufl logo",className:C.messageListLogo}),e.jsxs("h2",{className:C.chatbotHomeTitle,style:{fontWeight:600,color:"white",fontSize:"1.5rem"},children:["Hello"," ",e.jsx("span",{style:{color:"#ED0000"},children:"there"}),", ",e.jsx("br",{})," How can I help?"]}),e.jsxs("div",{className:C.chatbotRecentMessage,children:[e.jsx("h3",{className:C.chatbotRecentMessageTitle,children:"Recent message"}),e.jsx(Ai,{onClickLastChat:()=>t("messages"),showBorder:!1})]}),e.jsxs("button",{className:C.chatbotSendMessage,onClick:()=>t("messages"),children:[e.jsx("div",{className:C.chatbotSendMessageText,children:"Send a message"}),e.jsx(yt,{className:C.chatbotSendMessageIcon})]})]}),Mi=({onSendMessage:t,disabled:a=!1})=>{const[n,o]=i.useState(""),s=r=>{r.preventDefault(),n.trim()&&(t(n.trim()),o(""))};return e.jsxs("form",{onSubmit:s,className:C.messageListInputForm,children:[e.jsx("input",{type:"text",value:n,onChange:r=>o(r.target.value),placeholder:"Ask me anything",className:C.messageListInput,disabled:a}),e.jsx("button",{type:"submit",className:a?`${C.messageListInputButton} ${C.messageListInputButtonDisabled}`:C.messageListInputButton,disabled:a||!n.trim(),children:e.jsx(yt,{})})]})};function la(t){const a=new Date,n=new Date(t),o=a.getTime()-n.getTime(),s=Math.floor(o/6e4),r=Math.floor(o/36e5),l=Math.floor(o/864e5);return s<1?"just now":s<60?`${s} minute${s>1?"s":""} ago`:r<24?`${r} hour${r>1?"s":""} ago`:l<7?`${l} day${l>1?"s":""} ago`:n.toLocaleDateString()}const ca=t=>{let a=[];const n=t.split(`
`);return n.forEach((o,s)=>{let r=[],l=0;const c=o.match(/^(#{1,3})\s+(.+)$/);if(c){const m=c[1].length,g=c[2],M=["13px","14px","15px"][m-1];s>0&&a.push(e.jsx("br",{},`br-before-${s}`)),a.push(e.jsx("span",{style:{fontWeight:"bold",fontSize:M,display:"inline-block",marginBottom:"4px"},children:g},`header-${s}`)),s<n.length-1&&a.push(e.jsx("br",{},`br-after-${s}`));return}const u=/(\[([^\]]+)\]\(([^)]+)\)|https?:\/\/[^\s]+)/g,p=[];let d;for(;(d=u.exec(o))!==null;)d[3]?p.push({start:d.index,end:d.index+d[0].length,text:d[2],url:d[3]}):d[1]&&p.push({start:d.index,end:d.index+d[0].length,text:d[1],url:d[1]});const y=/\*\*(.+?)\*\*/g,b=[];for(;(d=y.exec(o))!==null;)b.push({start:d.index,end:d.index+d[0].length,text:d[1]});const _=new RegExp("(?<!\\*)\\*(.+?)(?<!\\*)\\*(?!\\*)","g"),z=[];for(;(d=_.exec(o))!==null;)b.some(m=>d.index>=m.start&&d.index<m.end)||z.push({start:d.index,end:d.index+d[0].length,text:d[1]});[...b,...z,...p].sort((m,g)=>m.start-g.start).forEach((m,g)=>{if(m.start>l&&r.push(o.substring(l,m.start)),p.includes(m)){const k=m;r.push(e.jsx("a",{href:k.url,target:"_blank",rel:"noopener noreferrer",children:k.text},`link-${s}-${g}`))}else b.some(k=>k===m)?r.push(e.jsx("strong",{children:m.text},`bold-${s}-${g}`)):r.push(e.jsx("em",{children:m.text},`italic-${s}-${g}`));l=m.end}),l<o.length&&r.push(o.substring(l)),r.length>0&&!(r.length===1&&r[0]==="")?(s>0&&a.push(e.jsx("br",{},`br-${s}`)),a.push(...r)):s>0&&s<n.length-1&&a.push(e.jsx("br",{},`br-empty-${s}`))}),a.length===0?t:a},qt=({message:t})=>e.jsxs(E.div,{initial:{transform:"translateX(-100%)"},animate:{transform:"translateX(0)"},className:C.messageListItem,children:[e.jsx("div",{className:C.messageListItemIcon,children:e.jsx("img",{src:tt,alt:"ufl logo",className:C.messageListLogo})}),e.jsxs("div",{className:C.messageSuperFlex,children:[e.jsx("div",{className:C.messageListItemWrapper,style:{whiteSpace:"pre-wrap",wordWrap:"break-word"},children:ca(t.message)}),e.jsxs("div",{className:C.messageListItemDetails,children:["Assistant - ",la(t.createdAt)]})]})]},t.id),Pi=({message:t})=>e.jsxs(E.div,{initial:{transform:"translateX(100%)"},animate:{transform:"translateX(0)"},className:C.messageListUserItem,children:[e.jsx("div",{className:C.messageListUserItemWrapper,style:{whiteSpace:"pre-wrap",wordWrap:"break-word"},children:t.message}),e.jsx("div",{className:C.messageListUserItemDetails,children:la(t.createdAt)})]},t.id),Bi=()=>{const t={start:{opacity:1},end:{opacity:1}},a={start:{y:0,opacity:.6},end:{y:-10,opacity:1}};return e.jsxs(E.div,{className:C.typingIndicator,variants:t,initial:"start",animate:"end",children:[e.jsx(E.span,{variants:a,transition:{duration:.6,repeat:1/0,repeatType:"reverse"}}),e.jsx(E.span,{variants:a,transition:{duration:.6,repeat:1/0,repeatType:"reverse",delay:.2}}),e.jsx(E.span,{variants:a,transition:{duration:.6,repeat:1/0,repeatType:"reverse",delay:.4}})]})},Ei=[{label:"General Enquiry",command:"General Enquiry"},{label:"Store Locations",command:"Store Locations"},{label:"Become a partner",command:"Become a partner"},{label:"Investor relations",command:"Investor relations"}],Ui={id:"initial",role:"assistant",message:"Welcome to the UACN GPT Assistant. Let me know how I can help you today!",createdAt:new Date},Di=()=>{const[t,a]=i.useState([]),[n,o]=i.useState(!1),[s]=i.useState(()=>{const c=sessionStorage.getItem("ufl_conversation_id");if(c)return c;const u=`conv_${Date.now()}`;return sessionStorage.setItem("ufl_conversation_id",u),u}),r=i.useRef(null);i.useEffect(()=>{const c=async()=>{try{const u=localStorage.getItem(`ufl_chat_${s}`);u&&a(JSON.parse(u))}catch(u){console.error("Failed to load chat history:",u)}};t.length===0&&c()},[s]),i.useEffect(()=>{t.length>0&&localStorage.setItem(`ufl_chat_${s}`,JSON.stringify(t))},[t,s]),i.useEffect(()=>{const c=setTimeout(()=>{r.current&&(r.current.scrollTop=r.current.scrollHeight)},0);return()=>clearTimeout(c)},[t,n]);const l=i.useCallback(async c=>{var u,p,d,y;try{const b={id:((u=crypto.randomUUID)==null?void 0:u.call(crypto))??String(Date.now()),createdAt:new Date,message:c,role:"user"};a(x=>[...x,b]),o(!0),localStorage.setItem("ufl_last_chat_message",c);const _=()=>typeof window<"u"&&window.location.hostname==="0.0.0.0"?"":"/UACN-GPT",z=((p=crypto.randomUUID)==null?void 0:p.call(crypto))??String(Date.now()),S={id:z,createdAt:new Date,role:"assistant",message:""};a(x=>[...x,S]);const m=await fetch(`${_()}/api/chat/public/stream`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:t.map(x=>({role:x.role,content:x.message})).concat({role:"user",content:c})})});if(!m.ok)throw new Error(`HTTP error! status: ${m.status}`);const g=(d=m.body)==null?void 0:d.getReader(),k=new TextDecoder;let M="";if(!g)throw new Error("Response body is not readable");for(;;){const{done:x,value:F}=await g.read();if(x)break;const Z=k.decode(F).split(`
`).filter(Y=>Y.startsWith("data: "));for(const Y of Z)try{const B=JSON.parse(Y.replace("data: ",""));B.type==="chunk"?(M+=B.content,a(ee=>ee.map(H=>H.id===z?{...H,message:M}:H))):B.type==="context"?console.log("[Chat] Context:",B.content):B.type==="error"?(M=B.content,a(ee=>ee.map(H=>H.id===z?{...H,message:B.content}:H))):B.type==="done"&&console.log("[Chat] Stream completed")}catch(B){console.error("[Chat] Error parsing SSE data:",B)}}}catch(b){console.error(b);const _={id:((y=crypto.randomUUID)==null?void 0:y.call(crypto))??String(Date.now()),createdAt:new Date,role:"assistant",message:"Something went wrong, please try again!"};a(z=>[...z,_])}finally{o(!1)}},[t]);return e.jsxs("div",{className:C.messageListContainer,children:[e.jsx("div",{className:C.messageListContainerHeader,children:e.jsx("div",{className:C.messageListContainerHeaderLabel,children:e.jsx("img",{src:tt,alt:"ufl logo",className:C.messageListLogo})})}),e.jsxs("div",{className:C.messageListContent,ref:r,children:[e.jsxs("div",{className:C.messageListBanner,children:[e.jsx("div",{className:C.messageListBannerTitle,children:"We are here to assist you. You can also send us an email - info@uacngpt.com"}),e.jsx(Ar,{className:C.messageListBannerIcon})]}),e.jsx(qt,{message:Ui}),e.jsx(Pe,{isVisible:t.length===0&&!n,children:e.jsx(E.div,{initial:{transform:"translateX(100%)"},animate:{transform:"translateX(0)"},className:C.messageListEnquiryContainerWrapper,children:e.jsx("div",{className:C.messageListEnquiryContainer,children:Ei.map(c=>e.jsx("button",{className:C.messageListEnquiry,onClick:()=>l(c.command),children:c.label},c.label))})})}),t.map(c=>e.jsxs("div",{children:[e.jsx(Pe,{isVisible:c.role==="assistant",children:e.jsx(qt,{message:c})}),e.jsx(Pe,{isVisible:c.role!=="assistant",children:e.jsx(Pi,{message:c})})]},c.id)),e.jsx(Pe,{isVisible:n,children:e.jsx(Bi,{})})]}),e.jsx("div",{className:C.messageListInputContainer,children:e.jsx(Mi,{onSendMessage:l,disabled:n})})]})},Ot={HOME:"home",MESSAGES:"messages"},Fi=({onChangeTab:t,activeTab:a})=>e.jsxs("div",{className:C.chatbotTabButtonsContainer,children:[e.jsxs("button",{className:C.chatbotTabButtonsItem,onClick:()=>t(Ot.HOME),children:[e.jsx(Tr,{className:C.chatbotTabButtonsIcon}),e.jsx("p",{className:C.chatbotTabButtonsLabel,children:"Home"})]}),e.jsxs("button",{className:C.chatbotTabButtonsItem,onClick:()=>t(Ot.MESSAGES),children:[e.jsx(Mr,{className:C.chatbotTabButtonsIcon}),e.jsx("p",{className:C.chatbotTabButtonsLabel,children:"Messages"})]})]}),Ri=({children:t})=>Zt.createPortal(t,document.body),ct={HOME:"home",MESSAGES:"messages"},qi=()=>{const[t,a]=i.useState(!1),[n,o]=i.useState(ct.HOME);return e.jsxs("div",{className:C.chatbotContainer,children:[e.jsx(Kt,{children:t&&e.jsxs(Ri,{children:[e.jsx(E.div,{initial:{opacity:0},animate:{opacity:1},exit:{opacity:0},className:C.chatbotOverlay,onClick:()=>a(!1)},"overlay"),e.jsxs(E.div,{initial:{y:80,opacity:0,scale:.95},animate:{y:0,opacity:1,scale:1},exit:{y:80,opacity:0,scale:.95},transition:{duration:.8,ease:[.22,1,.36,1]},className:C.chatbotContent,onClick:s=>s.stopPropagation(),children:[e.jsxs("div",{className:C.chatbotContentMain,children:[e.jsx(Pe,{isVisible:n===ct.HOME,children:e.jsx(Ti,{onChangeTab:o})}),e.jsx(Pe,{isVisible:n===ct.MESSAGES,children:e.jsx(Di,{})})]}),e.jsx(Fi,{onChangeTab:o,activeTab:n})]},"content")]})}),e.jsx(Pe,{isVisible:!t,children:e.jsx("div",{className:C.chatbotButtonContainer,style:{position:"fixed",bottom:"20px",right:"20px",zIndex:1e3},children:e.jsx(E.button,{className:C.chatbotButton,initial:{scale:0},whileTap:{scale:1.1},animate:{scale:1},onClick:()=>a(s=>!s),transition:{type:"spring",stiffness:260,damping:20},title:"Chat with us",children:e.jsx(Pr,{className:C.chatbotButtonText})})})})]})},Oi=({onEnter:t,user:a})=>{const n=a?`Welcome to ${a.businessUnit} GPT`:"Welcome to UACN GPT",o=a?`Your smart assistant for quick, accurate answers to everything you need to know about ${a.businessUnit} documents and guidelines.`:"Your smart assistant for quick, accurate answers to everything you need to know about UACN.",[s,r]=i.useState(""),[l,c]=i.useState(""),[u,p]=i.useState("title"),d=45,y=20,b=250;return i.useEffect(()=>{if(u==="title")if(s.length<n.length){const _=setTimeout(()=>{r(n.slice(0,s.length+1))},d);return()=>clearTimeout(_)}else{const _=setTimeout(()=>{p("body")},b);return()=>clearTimeout(_)}},[s,u,d,b,n]),i.useEffect(()=>{if(u==="body")if(l.length<o.length){const _=setTimeout(()=>{c(o.slice(0,l.length+1))},y);return()=>clearTimeout(_)}else{const _=setTimeout(()=>{p("done")},b);return()=>clearTimeout(_)}},[l,u,y,b,o]),e.jsxs("div",{className:O.homeContainer,children:[e.jsx("div",{className:O.logoContainer,children:e.jsx("img",{src:"/logo.png",alt:"UACN Logo",style:{width:"60px",height:"60px",objectFit:"contain"}})}),e.jsxs("div",{className:O.mainContent,children:[e.jsx("div",{className:O.avatarSection,children:e.jsx("img",{src:"/avatar-1.png",alt:"Avatar",className:O.centralAvatarImage})}),e.jsx("div",{className:O.textSection,children:e.jsxs("div",{className:O.textContent,children:[e.jsxs("h1",{className:O.title,children:[s,u!=="done"&&u==="title"&&e.jsx("span",{className:O.cursor})]}),u!=="title"&&e.jsxs("p",{className:O.description,children:[l,u==="body"&&e.jsx("span",{className:O.cursor})]}),u==="done"&&e.jsx("div",{className:`${O.cta} ${O.revealed}`,children:e.jsx("button",{className:O.ctaButton,onClick:t,children:"Start Chatting"})})]})})]}),e.jsx(qi,{}),e.jsx(wt,{type:"user"})]})};/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Wi=t=>t.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase(),da=(...t)=>t.filter((a,n,o)=>!!a&&o.indexOf(a)===n).join(" ");/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var Vi={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Gi=i.forwardRef(({color:t="currentColor",size:a=24,strokeWidth:n=2,absoluteStrokeWidth:o,className:s="",children:r,iconNode:l,...c},u)=>i.createElement("svg",{ref:u,...Vi,width:a,height:a,stroke:t,strokeWidth:o?Number(n)*24/Number(a):n,className:da("lucide",s),...c},[...l.map(([p,d])=>i.createElement(p,d)),...Array.isArray(r)?r:[r]]));/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const U=(t,a)=>{const n=i.forwardRef(({className:o,...s},r)=>i.createElement(Gi,{ref:r,iconNode:a,className:da(`lucide-${Wi(t)}`,o),...s}));return n.displayName=`${t}`,n};/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ma=U("ArrowRight",[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"m12 5 7 7-7 7",key:"xquz4c"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const $i=U("BarChart3",[["path",{d:"M3 3v18h18",key:"1s2lah"}],["path",{d:"M18 17V9",key:"2bz60n"}],["path",{d:"M13 17V5",key:"1frdt8"}],["path",{d:"M8 17v-3",key:"17ska0"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Hi=U("BookOpen",[["path",{d:"M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z",key:"vv98re"}],["path",{d:"M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z",key:"1cyq3y"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ua=U("Brain",[["path",{d:"M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z",key:"l5xja"}],["path",{d:"M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z",key:"ep3f8r"}],["path",{d:"M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4",key:"1p4c4q"}],["path",{d:"M17.599 6.5a3 3 0 0 0 .399-1.375",key:"tmeiqw"}],["path",{d:"M6.003 5.125A3 3 0 0 0 6.401 6.5",key:"105sqy"}],["path",{d:"M3.477 10.896a4 4 0 0 1 .585-.396",key:"ql3yin"}],["path",{d:"M19.938 10.5a4 4 0 0 1 .585.396",key:"1qfode"}],["path",{d:"M6 18a4 4 0 0 1-1.967-.516",key:"2e4loj"}],["path",{d:"M19.967 17.484A4 4 0 0 1 18 18",key:"159ez6"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Yi=U("CircleCheck",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ji=U("ClipboardCheck",[["rect",{width:"8",height:"4",x:"8",y:"2",rx:"1",ry:"1",key:"tgr4d6"}],["path",{d:"M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",key:"116196"}],["path",{d:"m9 14 2 2 4-4",key:"df797q"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Xi=U("Clock",[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["polyline",{points:"12 6 12 12 16 14",key:"68esgv"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Ki=U("Database",[["ellipse",{cx:"12",cy:"5",rx:"9",ry:"3",key:"msslwz"}],["path",{d:"M3 5V19A9 3 0 0 0 21 19V5",key:"1wlel7"}],["path",{d:"M3 12A9 3 0 0 0 21 12",key:"mv7ke4"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Zi=U("DollarSign",[["line",{x1:"12",x2:"12",y1:"2",y2:"22",key:"7eqyqh"}],["path",{d:"M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",key:"1b0p4s"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Qi=U("FileSearch",[["path",{d:"M14 2v4a2 2 0 0 0 2 2h4",key:"tnqrlb"}],["path",{d:"M4.268 21a2 2 0 0 0 1.727 1H18a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3",key:"ms7g94"}],["path",{d:"m9 18-1.5-1.5",key:"1j6qii"}],["circle",{cx:"5",cy:"14",r:"3",key:"ufru5t"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const el=U("HardHat",[["path",{d:"M2 18a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v2z",key:"1dej2m"}],["path",{d:"M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5",key:"1p9q5i"}],["path",{d:"M4 15v-3a6 6 0 0 1 6-6",key:"9ciidu"}],["path",{d:"M14 6a6 6 0 0 1 6 6v3",key:"1hnv84"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const tl=U("KeyRound",[["path",{d:"M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z",key:"167ctg"}],["circle",{cx:"16.5",cy:"7.5",r:".5",fill:"currentColor",key:"w0ekpg"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const al=U("Layers",[["path",{d:"m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z",key:"8b97xw"}],["path",{d:"m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65",key:"dd6zsq"}],["path",{d:"m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65",key:"ep9fru"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const nl=U("Lightbulb",[["path",{d:"M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5",key:"1gvzjb"}],["path",{d:"M9 18h6",key:"x1upvd"}],["path",{d:"M10 22h4",key:"ceow96"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const sl=U("LineChart",[["path",{d:"M3 3v18h18",key:"1s2lah"}],["path",{d:"m19 9-5 5-4-4-3 3",key:"2osh9i"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const pa=U("Lock",[["rect",{width:"18",height:"11",x:"3",y:"11",rx:"2",ry:"2",key:"1w4ew1"}],["path",{d:"M7 11V7a5 5 0 0 1 10 0v4",key:"fwvmzm"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ol=U("Menu",[["line",{x1:"4",x2:"20",y1:"12",y2:"12",key:"1e0a9i"}],["line",{x1:"4",x2:"20",y1:"6",y2:"6",key:"1owob3"}],["line",{x1:"4",x2:"20",y1:"18",y2:"18",key:"yk5zj1"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const rl=U("MessageCircle",[["path",{d:"M7.9 20A9 9 0 1 0 4 16.1L2 22Z",key:"vv11sd"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const il=U("MessageSquare",[["path",{d:"M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",key:"1lielz"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ll=U("Moon",[["path",{d:"M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z",key:"a7tn18"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const cl=U("Scale",[["path",{d:"m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z",key:"7g6ntu"}],["path",{d:"m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z",key:"ijws7r"}],["path",{d:"M7 21h10",key:"1b0cd5"}],["path",{d:"M12 3v18",key:"108xh3"}],["path",{d:"M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2",key:"3gwbw2"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const dl=U("Search",[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["path",{d:"m21 21-4.3-4.3",key:"1qie3q"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ml=U("Server",[["rect",{width:"20",height:"8",x:"2",y:"2",rx:"2",ry:"2",key:"ngkwjq"}],["rect",{width:"20",height:"8",x:"2",y:"14",rx:"2",ry:"2",key:"iecqi9"}],["line",{x1:"6",x2:"6.01",y1:"6",y2:"6",key:"16zg32"}],["line",{x1:"6",x2:"6.01",y1:"18",y2:"18",key:"nzw8ys"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ul=U("Settings",[["path",{d:"M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z",key:"1qme2f"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ha=U("ShieldCheck",[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}],["path",{d:"m9 12 2 2 4-4",key:"dzmm74"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ga=U("Shield",[["path",{d:"M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z",key:"oel41y"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const pl=U("Sparkles",[["path",{d:"M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z",key:"4pj2yx"}],["path",{d:"M20 3v4",key:"1olli1"}],["path",{d:"M22 5h-4",key:"1gvqau"}],["path",{d:"M4 17v2",key:"vumght"}],["path",{d:"M5 18H3",key:"zchphs"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const hl=U("Sun",[["circle",{cx:"12",cy:"12",r:"4",key:"4exip2"}],["path",{d:"M12 2v2",key:"tus03m"}],["path",{d:"M12 20v2",key:"1lh1kg"}],["path",{d:"m4.93 4.93 1.41 1.41",key:"149t6j"}],["path",{d:"m17.66 17.66 1.41 1.41",key:"ptbguv"}],["path",{d:"M2 12h2",key:"1t8f8n"}],["path",{d:"M20 12h2",key:"1q8mjw"}],["path",{d:"m6.34 17.66-1.41 1.41",key:"1m8zz5"}],["path",{d:"m19.07 4.93-1.41 1.41",key:"1shlcs"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const gl=U("TrendingUp",[["polyline",{points:"22 7 13.5 15.5 8.5 10.5 2 17",key:"126l90"}],["polyline",{points:"16 7 22 7 22 13",key:"kwv8wd"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const fl=U("TriangleAlert",[["path",{d:"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",key:"wmoenq"}],["path",{d:"M12 9v4",key:"juzpu7"}],["path",{d:"M12 17h.01",key:"p32p05"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const xl=U("Upload",[["path",{d:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",key:"ih7n3h"}],["polyline",{points:"17 8 12 3 7 8",key:"t8dd8p"}],["line",{x1:"12",x2:"12",y1:"3",y2:"15",key:"widbto"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const bl=U("Users",[["path",{d:"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",key:"1yyitq"}],["circle",{cx:"9",cy:"7",r:"4",key:"nufk8"}],["path",{d:"M22 21v-2a4 4 0 0 0-3-3.87",key:"kshegd"}],["path",{d:"M16 3.13a4 4 0 0 1 0 7.75",key:"1da9ce"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const yl=U("X",[["path",{d:"M18 6 6 18",key:"1bl5f8"}],["path",{d:"m6 6 12 12",key:"d8bk6v"}]]);/**
 * @license lucide-react v0.396.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const vl=U("Zap",[["path",{d:"M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z",key:"1xq2db"}]]);function Wt(t,a){if(typeof t=="function")return t(a);t!=null&&(t.current=a)}function wl(...t){return a=>{let n=!1;const o=t.map(s=>{const r=Wt(s,a);return!n&&typeof r=="function"&&(n=!0),r});if(n)return()=>{for(let s=0;s<o.length;s++){const r=o[s];typeof r=="function"?r():Wt(t[s],null)}}}}var jl=Symbol.for("react.lazy"),Qe=Xt[" use ".trim().toString()];function _l(t){return typeof t=="object"&&t!==null&&"then"in t}function fa(t){return t!=null&&typeof t=="object"&&"$$typeof"in t&&t.$$typeof===jl&&"_payload"in t&&_l(t._payload)}function Nl(t){const a=kl(t),n=i.forwardRef((o,s)=>{let{children:r,...l}=o;fa(r)&&typeof Qe=="function"&&(r=Qe(r._payload));const c=i.Children.toArray(r),u=c.find(zl);if(u){const p=u.props.children,d=c.map(y=>y===u?i.Children.count(p)>1?i.Children.only(null):i.isValidElement(p)?p.props.children:null:y);return e.jsx(a,{...l,ref:s,children:i.isValidElement(p)?i.cloneElement(p,void 0,d):null})}return e.jsx(a,{...l,ref:s,children:r})});return n.displayName=`${t}.Slot`,n}var Cl=Nl("Slot");function kl(t){const a=i.forwardRef((n,o)=>{let{children:s,...r}=n;if(fa(s)&&typeof Qe=="function"&&(s=Qe(s._payload)),i.isValidElement(s)){const l=Il(s),c=Ll(r,s.props);return s.type!==i.Fragment&&(c.ref=o?wl(o,l):l),i.cloneElement(s,c)}return i.Children.count(s)>1?i.Children.only(null):null});return a.displayName=`${t}.SlotClone`,a}var Sl=Symbol("radix.slottable");function zl(t){return i.isValidElement(t)&&typeof t.type=="function"&&"__radixId"in t.type&&t.type.__radixId===Sl}function Ll(t,a){const n={...a};for(const o in a){const s=t[o],r=a[o];/^on[A-Z]/.test(o)?s&&r?n[o]=(...c)=>{const u=r(...c);return s(...c),u}:s&&(n[o]=s):o==="style"?n[o]={...s,...r}:o==="className"&&(n[o]=[s,r].filter(Boolean).join(" "))}return{...t,...n}}function Il(t){var o,s;let a=(o=Object.getOwnPropertyDescriptor(t.props,"ref"))==null?void 0:o.get,n=a&&"isReactWarning"in a&&a.isReactWarning;return n?t.ref:(a=(s=Object.getOwnPropertyDescriptor(t,"ref"))==null?void 0:s.get,n=a&&"isReactWarning"in a&&a.isReactWarning,n?t.props.ref:t.props.ref||t.ref)}function xa(t){var a,n,o="";if(typeof t=="string"||typeof t=="number")o+=t;else if(typeof t=="object")if(Array.isArray(t)){var s=t.length;for(a=0;a<s;a++)t[a]&&(n=xa(t[a]))&&(o&&(o+=" "),o+=n)}else for(n in t)t[n]&&(o&&(o+=" "),o+=n);return o}function ba(){for(var t,a,n=0,o="",s=arguments.length;n<s;n++)(t=arguments[n])&&(a=xa(t))&&(o&&(o+=" "),o+=a);return o}const Vt=t=>typeof t=="boolean"?`${t}`:t===0?"0":t,Gt=ba,Al=(t,a)=>n=>{var o;if((a==null?void 0:a.variants)==null)return Gt(t,n==null?void 0:n.class,n==null?void 0:n.className);const{variants:s,defaultVariants:r}=a,l=Object.keys(s).map(p=>{const d=n==null?void 0:n[p],y=r==null?void 0:r[p];if(d===null)return null;const b=Vt(d)||Vt(y);return s[p][b]}),c=n&&Object.entries(n).reduce((p,d)=>{let[y,b]=d;return b===void 0||(p[y]=b),p},{}),u=a==null||(o=a.compoundVariants)===null||o===void 0?void 0:o.reduce((p,d)=>{let{class:y,className:b,..._}=d;return Object.entries(_).every(z=>{let[S,m]=z;return Array.isArray(m)?m.includes({...r,...c}[S]):{...r,...c}[S]===m})?[...p,y,b]:p},[]);return Gt(t,l,u,n==null?void 0:n.class,n==null?void 0:n.className)},jt="-",Tl=t=>{const a=Pl(t),{conflictingClassGroups:n,conflictingClassGroupModifiers:o}=t;return{getClassGroupId:l=>{const c=l.split(jt);return c[0]===""&&c.length!==1&&c.shift(),ya(c,a)||Ml(l)},getConflictingClassGroupIds:(l,c)=>{const u=n[l]||[];return c&&o[l]?[...u,...o[l]]:u}}},ya=(t,a)=>{var l;if(t.length===0)return a.classGroupId;const n=t[0],o=a.nextPart.get(n),s=o?ya(t.slice(1),o):void 0;if(s)return s;if(a.validators.length===0)return;const r=t.join(jt);return(l=a.validators.find(({validator:c})=>c(r)))==null?void 0:l.classGroupId},$t=/^\[(.+)\]$/,Ml=t=>{if($t.test(t)){const a=$t.exec(t)[1],n=a==null?void 0:a.substring(0,a.indexOf(":"));if(n)return"arbitrary.."+n}},Pl=t=>{const{theme:a,prefix:n}=t,o={nextPart:new Map,validators:[]};return El(Object.entries(t.classGroups),n).forEach(([r,l])=>{ht(l,o,r,a)}),o},ht=(t,a,n,o)=>{t.forEach(s=>{if(typeof s=="string"){const r=s===""?a:Ht(a,s);r.classGroupId=n;return}if(typeof s=="function"){if(Bl(s)){ht(s(o),a,n,o);return}a.validators.push({validator:s,classGroupId:n});return}Object.entries(s).forEach(([r,l])=>{ht(l,Ht(a,r),n,o)})})},Ht=(t,a)=>{let n=t;return a.split(jt).forEach(o=>{n.nextPart.has(o)||n.nextPart.set(o,{nextPart:new Map,validators:[]}),n=n.nextPart.get(o)}),n},Bl=t=>t.isThemeGetter,El=(t,a)=>a?t.map(([n,o])=>{const s=o.map(r=>typeof r=="string"?a+r:typeof r=="object"?Object.fromEntries(Object.entries(r).map(([l,c])=>[a+l,c])):r);return[n,s]}):t,Ul=t=>{if(t<1)return{get:()=>{},set:()=>{}};let a=0,n=new Map,o=new Map;const s=(r,l)=>{n.set(r,l),a++,a>t&&(a=0,o=n,n=new Map)};return{get(r){let l=n.get(r);if(l!==void 0)return l;if((l=o.get(r))!==void 0)return s(r,l),l},set(r,l){n.has(r)?n.set(r,l):s(r,l)}}},va="!",Dl=t=>{const{separator:a,experimentalParseClassName:n}=t,o=a.length===1,s=a[0],r=a.length,l=c=>{const u=[];let p=0,d=0,y;for(let m=0;m<c.length;m++){let g=c[m];if(p===0){if(g===s&&(o||c.slice(m,m+r)===a)){u.push(c.slice(d,m)),d=m+r;continue}if(g==="/"){y=m;continue}}g==="["?p++:g==="]"&&p--}const b=u.length===0?c:c.substring(d),_=b.startsWith(va),z=_?b.substring(1):b,S=y&&y>d?y-d:void 0;return{modifiers:u,hasImportantModifier:_,baseClassName:z,maybePostfixModifierPosition:S}};return n?c=>n({className:c,parseClassName:l}):l},Fl=t=>{if(t.length<=1)return t;const a=[];let n=[];return t.forEach(o=>{o[0]==="["?(a.push(...n.sort(),o),n=[]):n.push(o)}),a.push(...n.sort()),a},Rl=t=>({cache:Ul(t.cacheSize),parseClassName:Dl(t),...Tl(t)}),ql=/\s+/,Ol=(t,a)=>{const{parseClassName:n,getClassGroupId:o,getConflictingClassGroupIds:s}=a,r=[],l=t.trim().split(ql);let c="";for(let u=l.length-1;u>=0;u-=1){const p=l[u],{modifiers:d,hasImportantModifier:y,baseClassName:b,maybePostfixModifierPosition:_}=n(p);let z=!!_,S=o(z?b.substring(0,_):b);if(!S){if(!z){c=p+(c.length>0?" "+c:c);continue}if(S=o(b),!S){c=p+(c.length>0?" "+c:c);continue}z=!1}const m=Fl(d).join(":"),g=y?m+va:m,k=g+S;if(r.includes(k))continue;r.push(k);const M=s(S,z);for(let x=0;x<M.length;++x){const F=M[x];r.push(g+F)}c=p+(c.length>0?" "+c:c)}return c};function Wl(){let t=0,a,n,o="";for(;t<arguments.length;)(a=arguments[t++])&&(n=wa(a))&&(o&&(o+=" "),o+=n);return o}const wa=t=>{if(typeof t=="string")return t;let a,n="";for(let o=0;o<t.length;o++)t[o]&&(a=wa(t[o]))&&(n&&(n+=" "),n+=a);return n};function Vl(t,...a){let n,o,s,r=l;function l(u){const p=a.reduce((d,y)=>y(d),t());return n=Rl(p),o=n.cache.get,s=n.cache.set,r=c,c(u)}function c(u){const p=o(u);if(p)return p;const d=Ol(u,n);return s(u,d),d}return function(){return r(Wl.apply(null,arguments))}}const $=t=>{const a=n=>n[t]||[];return a.isThemeGetter=!0,a},ja=/^\[(?:([a-z-]+):)?(.+)\]$/i,Gl=/^\d+\/\d+$/,$l=new Set(["px","full","screen"]),Hl=/^(\d+(\.\d+)?)?(xs|sm|md|lg|xl)$/,Yl=/\d+(%|px|r?em|[sdl]?v([hwib]|min|max)|pt|pc|in|cm|mm|cap|ch|ex|r?lh|cq(w|h|i|b|min|max))|\b(calc|min|max|clamp)\(.+\)|^0$/,Jl=/^(rgba?|hsla?|hwb|(ok)?(lab|lch)|color-mix)\(.+\)$/,Xl=/^(inset_)?-?((\d+)?\.?(\d+)[a-z]+|0)_-?((\d+)?\.?(\d+)[a-z]+|0)/,Kl=/^(url|image|image-set|cross-fade|element|(repeating-)?(linear|radial|conic)-gradient)\(.+\)$/,_e=t=>Ue(t)||$l.has(t)||Gl.test(t),ze=t=>De(t,"length",oc),Ue=t=>!!t&&!Number.isNaN(Number(t)),dt=t=>De(t,"number",Ue),Ve=t=>!!t&&Number.isInteger(Number(t)),Zl=t=>t.endsWith("%")&&Ue(t.slice(0,-1)),A=t=>ja.test(t),Le=t=>Hl.test(t),Ql=new Set(["length","size","percentage"]),ec=t=>De(t,Ql,_a),tc=t=>De(t,"position",_a),ac=new Set(["image","url"]),nc=t=>De(t,ac,ic),sc=t=>De(t,"",rc),Ge=()=>!0,De=(t,a,n)=>{const o=ja.exec(t);return o?o[1]?typeof a=="string"?o[1]===a:a.has(o[1]):n(o[2]):!1},oc=t=>Yl.test(t)&&!Jl.test(t),_a=()=>!1,rc=t=>Xl.test(t),ic=t=>Kl.test(t),lc=()=>{const t=$("colors"),a=$("spacing"),n=$("blur"),o=$("brightness"),s=$("borderColor"),r=$("borderRadius"),l=$("borderSpacing"),c=$("borderWidth"),u=$("contrast"),p=$("grayscale"),d=$("hueRotate"),y=$("invert"),b=$("gap"),_=$("gradientColorStops"),z=$("gradientColorStopPositions"),S=$("inset"),m=$("margin"),g=$("opacity"),k=$("padding"),M=$("saturate"),x=$("scale"),F=$("sepia"),le=$("skew"),Z=$("space"),Y=$("translate"),B=()=>["auto","contain","none"],ee=()=>["auto","hidden","clip","visible","scroll"],H=()=>["auto",A,a],I=()=>[A,a],me=()=>["",_e,ze],ce=()=>["auto",Ue,A],de=()=>["bottom","center","left","left-bottom","left-top","right","right-bottom","right-top","top"],oe=()=>["solid","dashed","dotted","double","none"],te=()=>["normal","multiply","screen","overlay","darken","lighten","color-dodge","color-burn","hard-light","soft-light","difference","exclusion","hue","saturation","color","luminosity"],ie=()=>["start","end","center","between","around","evenly","stretch"],Q=()=>["","0",A],ue=()=>["auto","avoid","all","avoid-page","page","left","right","column"],ae=()=>[Ue,A];return{cacheSize:500,separator:":",theme:{colors:[Ge],spacing:[_e,ze],blur:["none","",Le,A],brightness:ae(),borderColor:[t],borderRadius:["none","","full",Le,A],borderSpacing:I(),borderWidth:me(),contrast:ae(),grayscale:Q(),hueRotate:ae(),invert:Q(),gap:I(),gradientColorStops:[t],gradientColorStopPositions:[Zl,ze],inset:H(),margin:H(),opacity:ae(),padding:I(),saturate:ae(),scale:ae(),sepia:Q(),skew:ae(),space:I(),translate:I()},classGroups:{aspect:[{aspect:["auto","square","video",A]}],container:["container"],columns:[{columns:[Le]}],"break-after":[{"break-after":ue()}],"break-before":[{"break-before":ue()}],"break-inside":[{"break-inside":["auto","avoid","avoid-page","avoid-column"]}],"box-decoration":[{"box-decoration":["slice","clone"]}],box:[{box:["border","content"]}],display:["block","inline-block","inline","flex","inline-flex","table","inline-table","table-caption","table-cell","table-column","table-column-group","table-footer-group","table-header-group","table-row-group","table-row","flow-root","grid","inline-grid","contents","list-item","hidden"],float:[{float:["right","left","none","start","end"]}],clear:[{clear:["left","right","both","none","start","end"]}],isolation:["isolate","isolation-auto"],"object-fit":[{object:["contain","cover","fill","none","scale-down"]}],"object-position":[{object:[...de(),A]}],overflow:[{overflow:ee()}],"overflow-x":[{"overflow-x":ee()}],"overflow-y":[{"overflow-y":ee()}],overscroll:[{overscroll:B()}],"overscroll-x":[{"overscroll-x":B()}],"overscroll-y":[{"overscroll-y":B()}],position:["static","fixed","absolute","relative","sticky"],inset:[{inset:[S]}],"inset-x":[{"inset-x":[S]}],"inset-y":[{"inset-y":[S]}],start:[{start:[S]}],end:[{end:[S]}],top:[{top:[S]}],right:[{right:[S]}],bottom:[{bottom:[S]}],left:[{left:[S]}],visibility:["visible","invisible","collapse"],z:[{z:["auto",Ve,A]}],basis:[{basis:H()}],"flex-direction":[{flex:["row","row-reverse","col","col-reverse"]}],"flex-wrap":[{flex:["wrap","wrap-reverse","nowrap"]}],flex:[{flex:["1","auto","initial","none",A]}],grow:[{grow:Q()}],shrink:[{shrink:Q()}],order:[{order:["first","last","none",Ve,A]}],"grid-cols":[{"grid-cols":[Ge]}],"col-start-end":[{col:["auto",{span:["full",Ve,A]},A]}],"col-start":[{"col-start":ce()}],"col-end":[{"col-end":ce()}],"grid-rows":[{"grid-rows":[Ge]}],"row-start-end":[{row:["auto",{span:[Ve,A]},A]}],"row-start":[{"row-start":ce()}],"row-end":[{"row-end":ce()}],"grid-flow":[{"grid-flow":["row","col","dense","row-dense","col-dense"]}],"auto-cols":[{"auto-cols":["auto","min","max","fr",A]}],"auto-rows":[{"auto-rows":["auto","min","max","fr",A]}],gap:[{gap:[b]}],"gap-x":[{"gap-x":[b]}],"gap-y":[{"gap-y":[b]}],"justify-content":[{justify:["normal",...ie()]}],"justify-items":[{"justify-items":["start","end","center","stretch"]}],"justify-self":[{"justify-self":["auto","start","end","center","stretch"]}],"align-content":[{content:["normal",...ie(),"baseline"]}],"align-items":[{items:["start","end","center","baseline","stretch"]}],"align-self":[{self:["auto","start","end","center","stretch","baseline"]}],"place-content":[{"place-content":[...ie(),"baseline"]}],"place-items":[{"place-items":["start","end","center","baseline","stretch"]}],"place-self":[{"place-self":["auto","start","end","center","stretch"]}],p:[{p:[k]}],px:[{px:[k]}],py:[{py:[k]}],ps:[{ps:[k]}],pe:[{pe:[k]}],pt:[{pt:[k]}],pr:[{pr:[k]}],pb:[{pb:[k]}],pl:[{pl:[k]}],m:[{m:[m]}],mx:[{mx:[m]}],my:[{my:[m]}],ms:[{ms:[m]}],me:[{me:[m]}],mt:[{mt:[m]}],mr:[{mr:[m]}],mb:[{mb:[m]}],ml:[{ml:[m]}],"space-x":[{"space-x":[Z]}],"space-x-reverse":["space-x-reverse"],"space-y":[{"space-y":[Z]}],"space-y-reverse":["space-y-reverse"],w:[{w:["auto","min","max","fit","svw","lvw","dvw",A,a]}],"min-w":[{"min-w":[A,a,"min","max","fit"]}],"max-w":[{"max-w":[A,a,"none","full","min","max","fit","prose",{screen:[Le]},Le]}],h:[{h:[A,a,"auto","min","max","fit","svh","lvh","dvh"]}],"min-h":[{"min-h":[A,a,"min","max","fit","svh","lvh","dvh"]}],"max-h":[{"max-h":[A,a,"min","max","fit","svh","lvh","dvh"]}],size:[{size:[A,a,"auto","min","max","fit"]}],"font-size":[{text:["base",Le,ze]}],"font-smoothing":["antialiased","subpixel-antialiased"],"font-style":["italic","not-italic"],"font-weight":[{font:["thin","extralight","light","normal","medium","semibold","bold","extrabold","black",dt]}],"font-family":[{font:[Ge]}],"fvn-normal":["normal-nums"],"fvn-ordinal":["ordinal"],"fvn-slashed-zero":["slashed-zero"],"fvn-figure":["lining-nums","oldstyle-nums"],"fvn-spacing":["proportional-nums","tabular-nums"],"fvn-fraction":["diagonal-fractions","stacked-fractions"],tracking:[{tracking:["tighter","tight","normal","wide","wider","widest",A]}],"line-clamp":[{"line-clamp":["none",Ue,dt]}],leading:[{leading:["none","tight","snug","normal","relaxed","loose",_e,A]}],"list-image":[{"list-image":["none",A]}],"list-style-type":[{list:["none","disc","decimal",A]}],"list-style-position":[{list:["inside","outside"]}],"placeholder-color":[{placeholder:[t]}],"placeholder-opacity":[{"placeholder-opacity":[g]}],"text-alignment":[{text:["left","center","right","justify","start","end"]}],"text-color":[{text:[t]}],"text-opacity":[{"text-opacity":[g]}],"text-decoration":["underline","overline","line-through","no-underline"],"text-decoration-style":[{decoration:[...oe(),"wavy"]}],"text-decoration-thickness":[{decoration:["auto","from-font",_e,ze]}],"underline-offset":[{"underline-offset":["auto",_e,A]}],"text-decoration-color":[{decoration:[t]}],"text-transform":["uppercase","lowercase","capitalize","normal-case"],"text-overflow":["truncate","text-ellipsis","text-clip"],"text-wrap":[{text:["wrap","nowrap","balance","pretty"]}],indent:[{indent:I()}],"vertical-align":[{align:["baseline","top","middle","bottom","text-top","text-bottom","sub","super",A]}],whitespace:[{whitespace:["normal","nowrap","pre","pre-line","pre-wrap","break-spaces"]}],break:[{break:["normal","words","all","keep"]}],hyphens:[{hyphens:["none","manual","auto"]}],content:[{content:["none",A]}],"bg-attachment":[{bg:["fixed","local","scroll"]}],"bg-clip":[{"bg-clip":["border","padding","content","text"]}],"bg-opacity":[{"bg-opacity":[g]}],"bg-origin":[{"bg-origin":["border","padding","content"]}],"bg-position":[{bg:[...de(),tc]}],"bg-repeat":[{bg:["no-repeat",{repeat:["","x","y","round","space"]}]}],"bg-size":[{bg:["auto","cover","contain",ec]}],"bg-image":[{bg:["none",{"gradient-to":["t","tr","r","br","b","bl","l","tl"]},nc]}],"bg-color":[{bg:[t]}],"gradient-from-pos":[{from:[z]}],"gradient-via-pos":[{via:[z]}],"gradient-to-pos":[{to:[z]}],"gradient-from":[{from:[_]}],"gradient-via":[{via:[_]}],"gradient-to":[{to:[_]}],rounded:[{rounded:[r]}],"rounded-s":[{"rounded-s":[r]}],"rounded-e":[{"rounded-e":[r]}],"rounded-t":[{"rounded-t":[r]}],"rounded-r":[{"rounded-r":[r]}],"rounded-b":[{"rounded-b":[r]}],"rounded-l":[{"rounded-l":[r]}],"rounded-ss":[{"rounded-ss":[r]}],"rounded-se":[{"rounded-se":[r]}],"rounded-ee":[{"rounded-ee":[r]}],"rounded-es":[{"rounded-es":[r]}],"rounded-tl":[{"rounded-tl":[r]}],"rounded-tr":[{"rounded-tr":[r]}],"rounded-br":[{"rounded-br":[r]}],"rounded-bl":[{"rounded-bl":[r]}],"border-w":[{border:[c]}],"border-w-x":[{"border-x":[c]}],"border-w-y":[{"border-y":[c]}],"border-w-s":[{"border-s":[c]}],"border-w-e":[{"border-e":[c]}],"border-w-t":[{"border-t":[c]}],"border-w-r":[{"border-r":[c]}],"border-w-b":[{"border-b":[c]}],"border-w-l":[{"border-l":[c]}],"border-opacity":[{"border-opacity":[g]}],"border-style":[{border:[...oe(),"hidden"]}],"divide-x":[{"divide-x":[c]}],"divide-x-reverse":["divide-x-reverse"],"divide-y":[{"divide-y":[c]}],"divide-y-reverse":["divide-y-reverse"],"divide-opacity":[{"divide-opacity":[g]}],"divide-style":[{divide:oe()}],"border-color":[{border:[s]}],"border-color-x":[{"border-x":[s]}],"border-color-y":[{"border-y":[s]}],"border-color-s":[{"border-s":[s]}],"border-color-e":[{"border-e":[s]}],"border-color-t":[{"border-t":[s]}],"border-color-r":[{"border-r":[s]}],"border-color-b":[{"border-b":[s]}],"border-color-l":[{"border-l":[s]}],"divide-color":[{divide:[s]}],"outline-style":[{outline:["",...oe()]}],"outline-offset":[{"outline-offset":[_e,A]}],"outline-w":[{outline:[_e,ze]}],"outline-color":[{outline:[t]}],"ring-w":[{ring:me()}],"ring-w-inset":["ring-inset"],"ring-color":[{ring:[t]}],"ring-opacity":[{"ring-opacity":[g]}],"ring-offset-w":[{"ring-offset":[_e,ze]}],"ring-offset-color":[{"ring-offset":[t]}],shadow:[{shadow:["","inner","none",Le,sc]}],"shadow-color":[{shadow:[Ge]}],opacity:[{opacity:[g]}],"mix-blend":[{"mix-blend":[...te(),"plus-lighter","plus-darker"]}],"bg-blend":[{"bg-blend":te()}],filter:[{filter:["","none"]}],blur:[{blur:[n]}],brightness:[{brightness:[o]}],contrast:[{contrast:[u]}],"drop-shadow":[{"drop-shadow":["","none",Le,A]}],grayscale:[{grayscale:[p]}],"hue-rotate":[{"hue-rotate":[d]}],invert:[{invert:[y]}],saturate:[{saturate:[M]}],sepia:[{sepia:[F]}],"backdrop-filter":[{"backdrop-filter":["","none"]}],"backdrop-blur":[{"backdrop-blur":[n]}],"backdrop-brightness":[{"backdrop-brightness":[o]}],"backdrop-contrast":[{"backdrop-contrast":[u]}],"backdrop-grayscale":[{"backdrop-grayscale":[p]}],"backdrop-hue-rotate":[{"backdrop-hue-rotate":[d]}],"backdrop-invert":[{"backdrop-invert":[y]}],"backdrop-opacity":[{"backdrop-opacity":[g]}],"backdrop-saturate":[{"backdrop-saturate":[M]}],"backdrop-sepia":[{"backdrop-sepia":[F]}],"border-collapse":[{border:["collapse","separate"]}],"border-spacing":[{"border-spacing":[l]}],"border-spacing-x":[{"border-spacing-x":[l]}],"border-spacing-y":[{"border-spacing-y":[l]}],"table-layout":[{table:["auto","fixed"]}],caption:[{caption:["top","bottom"]}],transition:[{transition:["none","all","","colors","opacity","shadow","transform",A]}],duration:[{duration:ae()}],ease:[{ease:["linear","in","out","in-out",A]}],delay:[{delay:ae()}],animate:[{animate:["none","spin","ping","pulse","bounce",A]}],transform:[{transform:["","gpu","none"]}],scale:[{scale:[x]}],"scale-x":[{"scale-x":[x]}],"scale-y":[{"scale-y":[x]}],rotate:[{rotate:[Ve,A]}],"translate-x":[{"translate-x":[Y]}],"translate-y":[{"translate-y":[Y]}],"skew-x":[{"skew-x":[le]}],"skew-y":[{"skew-y":[le]}],"transform-origin":[{origin:["center","top","top-right","right","bottom-right","bottom","bottom-left","left","top-left",A]}],accent:[{accent:["auto",t]}],appearance:[{appearance:["none","auto"]}],cursor:[{cursor:["auto","default","pointer","wait","text","move","help","not-allowed","none","context-menu","progress","cell","crosshair","vertical-text","alias","copy","no-drop","grab","grabbing","all-scroll","col-resize","row-resize","n-resize","e-resize","s-resize","w-resize","ne-resize","nw-resize","se-resize","sw-resize","ew-resize","ns-resize","nesw-resize","nwse-resize","zoom-in","zoom-out",A]}],"caret-color":[{caret:[t]}],"pointer-events":[{"pointer-events":["none","auto"]}],resize:[{resize:["none","y","x",""]}],"scroll-behavior":[{scroll:["auto","smooth"]}],"scroll-m":[{"scroll-m":I()}],"scroll-mx":[{"scroll-mx":I()}],"scroll-my":[{"scroll-my":I()}],"scroll-ms":[{"scroll-ms":I()}],"scroll-me":[{"scroll-me":I()}],"scroll-mt":[{"scroll-mt":I()}],"scroll-mr":[{"scroll-mr":I()}],"scroll-mb":[{"scroll-mb":I()}],"scroll-ml":[{"scroll-ml":I()}],"scroll-p":[{"scroll-p":I()}],"scroll-px":[{"scroll-px":I()}],"scroll-py":[{"scroll-py":I()}],"scroll-ps":[{"scroll-ps":I()}],"scroll-pe":[{"scroll-pe":I()}],"scroll-pt":[{"scroll-pt":I()}],"scroll-pr":[{"scroll-pr":I()}],"scroll-pb":[{"scroll-pb":I()}],"scroll-pl":[{"scroll-pl":I()}],"snap-align":[{snap:["start","end","center","align-none"]}],"snap-stop":[{snap:["normal","always"]}],"snap-type":[{snap:["none","x","y","both"]}],"snap-strictness":[{snap:["mandatory","proximity"]}],touch:[{touch:["auto","none","manipulation"]}],"touch-x":[{"touch-pan":["x","left","right"]}],"touch-y":[{"touch-pan":["y","up","down"]}],"touch-pz":["touch-pinch-zoom"],select:[{select:["none","text","all","auto"]}],"will-change":[{"will-change":["auto","scroll","contents","transform",A]}],fill:[{fill:[t,"none"]}],"stroke-w":[{stroke:[_e,ze,dt]}],stroke:[{stroke:[t,"none"]}],sr:["sr-only","not-sr-only"],"forced-color-adjust":[{"forced-color-adjust":["auto","none"]}]},conflictingClassGroups:{overflow:["overflow-x","overflow-y"],overscroll:["overscroll-x","overscroll-y"],inset:["inset-x","inset-y","start","end","top","right","bottom","left"],"inset-x":["right","left"],"inset-y":["top","bottom"],flex:["basis","grow","shrink"],gap:["gap-x","gap-y"],p:["px","py","ps","pe","pt","pr","pb","pl"],px:["pr","pl"],py:["pt","pb"],m:["mx","my","ms","me","mt","mr","mb","ml"],mx:["mr","ml"],my:["mt","mb"],size:["w","h"],"font-size":["leading"],"fvn-normal":["fvn-ordinal","fvn-slashed-zero","fvn-figure","fvn-spacing","fvn-fraction"],"fvn-ordinal":["fvn-normal"],"fvn-slashed-zero":["fvn-normal"],"fvn-figure":["fvn-normal"],"fvn-spacing":["fvn-normal"],"fvn-fraction":["fvn-normal"],"line-clamp":["display","overflow"],rounded:["rounded-s","rounded-e","rounded-t","rounded-r","rounded-b","rounded-l","rounded-ss","rounded-se","rounded-ee","rounded-es","rounded-tl","rounded-tr","rounded-br","rounded-bl"],"rounded-s":["rounded-ss","rounded-es"],"rounded-e":["rounded-se","rounded-ee"],"rounded-t":["rounded-tl","rounded-tr"],"rounded-r":["rounded-tr","rounded-br"],"rounded-b":["rounded-br","rounded-bl"],"rounded-l":["rounded-tl","rounded-bl"],"border-spacing":["border-spacing-x","border-spacing-y"],"border-w":["border-w-s","border-w-e","border-w-t","border-w-r","border-w-b","border-w-l"],"border-w-x":["border-w-r","border-w-l"],"border-w-y":["border-w-t","border-w-b"],"border-color":["border-color-s","border-color-e","border-color-t","border-color-r","border-color-b","border-color-l"],"border-color-x":["border-color-r","border-color-l"],"border-color-y":["border-color-t","border-color-b"],"scroll-m":["scroll-mx","scroll-my","scroll-ms","scroll-me","scroll-mt","scroll-mr","scroll-mb","scroll-ml"],"scroll-mx":["scroll-mr","scroll-ml"],"scroll-my":["scroll-mt","scroll-mb"],"scroll-p":["scroll-px","scroll-py","scroll-ps","scroll-pe","scroll-pt","scroll-pr","scroll-pb","scroll-pl"],"scroll-px":["scroll-pr","scroll-pl"],"scroll-py":["scroll-pt","scroll-pb"],touch:["touch-x","touch-y","touch-pz"],"touch-x":["touch"],"touch-y":["touch"],"touch-pz":["touch"]},conflictingClassGroupModifiers:{"font-size":["leading"]}}},cc=Vl(lc);function dc(...t){return cc(ba(t))}const mc=Al("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",{variants:{variant:{default:"bg-primary text-primary-foreground hover:bg-primary/90",destructive:"bg-destructive text-destructive-foreground hover:bg-destructive/90",outline:"border border-input bg-background hover:bg-accent hover:text-accent-foreground",secondary:"bg-secondary text-secondary-foreground hover:bg-secondary/80",ghost:"hover:bg-accent hover:text-accent-foreground",link:"text-primary underline-offset-4 hover:underline"},size:{default:"h-10 px-4 py-2",sm:"h-9 rounded-md px-3",lg:"h-11 rounded-md px-8",icon:"h-10 w-10"}},defaultVariants:{variant:"default",size:"default"}}),ye=i.forwardRef(({className:t,variant:a,size:n,asChild:o=!1,...s},r)=>{const l=o?Cl:"button";return e.jsx(l,{className:dc(mc({variant:a,size:n,className:t})),ref:r,...s})});ye.displayName="Button";const Yt=()=>{const[t,a]=i.useState(()=>typeof window<"u"?document.documentElement.classList.contains("dark"):!0);return i.useEffect(()=>{t?document.documentElement.classList.add("dark"):document.documentElement.classList.remove("dark")},[t]),e.jsx(ye,{variant:"ghost",size:"icon",onClick:()=>a(!t),className:"text-muted-foreground hover:text-foreground h-8 w-8","aria-label":"Toggle theme",children:t?e.jsx(hl,{size:16}):e.jsx(ll,{size:16})})},Jt=[{label:"Features",href:"#features"},{label:"How It Works",href:"#how-it-works"},{label:"Use Cases",href:"#use-cases"},{label:"Security",href:"#security"}],uc=()=>{const[t,a]=i.useState(!1),n=Ya();return e.jsxs(E.nav,{initial:{y:-20,opacity:0},animate:{y:0,opacity:1},transition:{duration:.6},className:"fixed top-0 left-0 right-0 z-50 glass-card border-t-0 rounded-none border-x-0",children:[e.jsxs("div",{className:"container mx-auto flex items-center justify-between h-16 px-6",children:[e.jsxs("a",{href:"#",className:"flex items-center gap-2",children:[e.jsx("div",{className:"w-8 h-8 md:w-14 md:h-14 rounded-lg flex items-center justify-center",children:e.jsx("img",{src:"/logo.png",alt:"UACN Logo",className:"w-6 h-6 md:w-12 md:h-12 object-contain"})}),e.jsx("span",{className:"font-bold text-lg text-foreground tracking-tight",children:"UACN"})]}),e.jsx("div",{className:"hidden md:flex items-center gap-8",children:Jt.map(o=>e.jsx("a",{href:o.href,className:"text-sm text-muted-foreground hover:text-foreground transition-colors",children:o.label},o.href))}),e.jsxs("div",{className:"hidden md:flex items-center gap-3",children:[e.jsx(Yt,{}),e.jsx(ye,{variant:"ghost",size:"sm",className:"text-muted-foreground hover:text-foreground",onClick:()=>n("/login"),children:"Sign In"}),e.jsx(ye,{size:"sm",children:"Request Demo"})]}),e.jsx("button",{onClick:()=>a(!t),className:"md:hidden text-foreground",children:t?e.jsx(yl,{size:20}):e.jsx(ol,{size:20})})]}),e.jsx(Kt,{children:t&&e.jsx(E.div,{initial:{height:0,opacity:0},animate:{height:"auto",opacity:1},exit:{height:0,opacity:0},className:"md:hidden glass-card border-t border-border overflow-hidden",children:e.jsxs("div",{className:"px-6 py-4 flex flex-col gap-3",children:[Jt.map(o=>e.jsx("a",{href:o.href,className:"text-sm text-muted-foreground hover:text-foreground py-2",onClick:()=>a(!1),children:o.label},o.href)),e.jsxs("div",{className:"flex items-center gap-2 pt-2 border-t border-border",children:[e.jsx(Yt,{}),e.jsx(ye,{variant:"ghost",size:"sm",className:"flex-1 text-muted-foreground hover:text-foreground",onClick:()=>{n("/login"),a(!1)},children:"Sign In"})]}),e.jsx(ye,{size:"sm",className:"w-full",children:"Request Demo"})]})})})]})},pc=[{icon:ua,text:"AI-powered answers from your internal knowledge base"},{icon:ga,text:"Enterprise-grade security with role-based access"},{icon:vl,text:"Instant insights from policies, reports & documents"}],hc=()=>e.jsxs("section",{className:"relative min-h-screen flex items-center justify-center overflow-hidden pt-16",children:[e.jsxs("div",{className:"absolute inset-0",children:[e.jsx("img",{src:"/src/assets/hero-bg.jpg",alt:"",className:"w-full h-full object-cover opacity-40",width:1920,height:1080}),e.jsx("div",{className:"absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background"})]}),e.jsxs(E.div,{initial:{opacity:0,scale:.85},animate:{opacity:1,scale:1},transition:{duration:1.2,delay:.3},className:"absolute inset-0 flex items-center justify-center pointer-events-none",children:[e.jsx("img",{src:"/src/assets/avatar-1.png",alt:"",className:"max-w-[300px] h-auto opacity-15 dark:opacity-10 animate-float select-none",width:1024,height:1024}),e.jsx("div",{className:"absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background"})]}),e.jsx("div",{className:"container relative z-10 mx-auto px-6 py-20 md:py-32",children:e.jsxs(E.div,{initial:{opacity:0,y:30},animate:{opacity:1,y:0},transition:{duration:.8},className:"max-w-4xl mx-auto text-center",children:[e.jsxs(E.div,{initial:{opacity:0,scale:.9},animate:{opacity:1,scale:1},transition:{delay:.2},className:"inline-flex items-center gap-2 glass-card px-4 py-1.5 mb-8 text-xs mono-text text-muted-foreground",children:[e.jsx("span",{className:"w-1.5 h-1.5 rounded-full bg-primary animate-pulse-glow"}),"Enterprise AI Assistant"]}),e.jsxs("h1",{className:"text-4xl sm:text-5xl md:text-7xl font-black tracking-tight leading-[1.08] text-balance mb-6",children:["The Intelligent",e.jsx("br",{}),e.jsx("span",{className:"gradient-text",children:"Brain of Your"}),e.jsx("br",{}),"Organization"]}),e.jsx("p",{className:"text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 text-balance",children:"UACN connects your people to your knowledge. Ask questions, get instant answers from approved internal documents — securely, intelligently, instantly."}),e.jsxs("div",{className:"flex flex-col sm:flex-row gap-4 justify-center mb-16",children:[e.jsxs(ye,{size:"lg",className:"text-base gap-2 px-8 h-12",children:["Request Demo ",e.jsx(ma,{size:16})]}),e.jsx(ye,{size:"lg",variant:"outline",className:"text-base px-8 h-12 border-border/60 text-foreground hover:bg-secondary",children:"See How It Works"})]}),e.jsx("div",{className:"grid sm:grid-cols-3 gap-4 max-w-3xl mx-auto",children:pc.map((t,a)=>e.jsxs(E.div,{initial:{opacity:0,y:20},animate:{opacity:1,y:0},transition:{delay:.5+a*.15},className:"glass-card p-4 flex items-start gap-3 text-left",children:[e.jsx(t.icon,{size:18,className:"text-primary mt-0.5 shrink-0"}),e.jsx("span",{className:"text-sm text-secondary-foreground",children:t.text})]},a))})]})})]}),gc=[{icon:Qi,title:"Scattered Information",desc:"Critical documents buried across shared drives, emails, and legacy systems nobody remembers."},{icon:Xi,title:"Slow Decisions",desc:"Hours wasted hunting for the right policy or report when decisions need to happen now."},{icon:bl,title:"People Dependency",desc:"Institutional knowledge locked in the heads of a few people — what happens when they leave?"},{icon:fl,title:"Compliance Risk",desc:"Outdated procedures surface. Audit trails are incomplete. The risk compounds silently."}],fc=()=>e.jsx("section",{className:"section-padding",children:e.jsxs("div",{className:"container mx-auto max-w-5xl",children:[e.jsxs(E.div,{initial:{opacity:0},whileInView:{opacity:1},viewport:{once:!0},className:"text-center mb-16",children:[e.jsx("p",{className:"mono-text text-xs text-primary mb-3 uppercase tracking-widest",children:"The Problem"}),e.jsxs("h2",{className:"text-3xl md:text-5xl font-black tracking-tight text-balance mb-4",children:["Your Organization Knows More ",e.jsx("br",{className:"hidden md:block"}),"Than It Can ",e.jsx("span",{className:"gradient-text",children:"Access"})]}),e.jsx("p",{className:"text-muted-foreground max-w-2xl mx-auto text-lg",children:"Every day, teams waste hours searching for answers that already exist somewhere in your organization."})]}),e.jsx("div",{className:"grid sm:grid-cols-2 gap-5",children:gc.map((t,a)=>e.jsxs(E.div,{initial:{opacity:0,y:20},whileInView:{opacity:1,y:0},viewport:{once:!0},transition:{delay:a*.1},className:"glass-card p-6 group hover:glow-border transition-all duration-300",children:[e.jsx("div",{className:"w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center mb-4",children:e.jsx(t.icon,{size:20,className:"text-destructive"})}),e.jsx("h3",{className:"font-semibold text-lg mb-2 text-foreground",children:t.title}),e.jsx("p",{className:"text-sm text-muted-foreground leading-relaxed",children:t.desc})]},a))})]})}),xc=[{icon:il,title:"Conversational AI",desc:"Ask questions in plain language. UACN understands context, nuance, and intent."},{icon:pa,title:"Secure Document Access",desc:"Only approved, authorized content is searchable. Every query respects access controls."},{icon:$i,title:"Instant Insights",desc:"From financial summaries to compliance checks — get analytical answers in seconds."},{icon:nl,title:"Data-Driven Decisions",desc:"Move from gut-feel to evidence-based decisions with AI that knows your data."}],bc=()=>e.jsx("section",{className:"section-padding bg-secondary/30",children:e.jsxs("div",{className:"container mx-auto max-w-5xl",children:[e.jsxs(E.div,{initial:{opacity:0},whileInView:{opacity:1},viewport:{once:!0},className:"text-center mb-16",children:[e.jsx("p",{className:"mono-text text-xs text-primary mb-3 uppercase tracking-widest",children:"The Solution"}),e.jsxs("h2",{className:"text-3xl md:text-5xl font-black tracking-tight text-balance mb-4",children:["Meet ",e.jsx("span",{className:"gradient-text",children:"UACN"})]}),e.jsx("p",{className:"text-muted-foreground max-w-2xl mx-auto text-lg",children:"An AI assistant that turns your organization's documents into an intelligent, conversational knowledge engine."})]}),e.jsx("div",{className:"grid sm:grid-cols-2 gap-5",children:xc.map((t,a)=>e.jsxs(E.div,{initial:{opacity:0,y:20},whileInView:{opacity:1,y:0},viewport:{once:!0},transition:{delay:a*.1},className:"glass-card p-6 glow-border",children:[e.jsx("div",{className:"w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4",children:e.jsx(t.icon,{size:20,className:"text-primary"})}),e.jsx("h3",{className:"font-semibold text-lg mb-2 text-foreground",children:t.title}),e.jsx("p",{className:"text-sm text-muted-foreground leading-relaxed",children:t.desc})]},a))})]})}),yc=[{icon:xl,num:"01",title:"Upload & Approve",desc:"Privileged users upload documents — policies, reports, SOPs — and approve them for the knowledge base."},{icon:ha,num:"02",title:"Secure Access Control",desc:"Define who can access what. Role-based permissions ensure the right people see the right information."},{icon:rl,num:"03",title:"Ask Anything",desc:"Employees ask questions in natural language through an intuitive chat interface."},{icon:pl,num:"04",title:"Get Intelligent Answers",desc:"UACN delivers precise, contextual answers with source references — in seconds."}],vc=()=>e.jsx("section",{id:"how-it-works",className:"section-padding",children:e.jsxs("div",{className:"container mx-auto max-w-5xl",children:[e.jsxs(E.div,{initial:{opacity:0},whileInView:{opacity:1},viewport:{once:!0},className:"text-center mb-16",children:[e.jsx("p",{className:"mono-text text-xs text-primary mb-3 uppercase tracking-widest",children:"How It Works"}),e.jsxs("h2",{className:"text-3xl md:text-5xl font-black tracking-tight text-balance mb-4",children:["Four Steps to ",e.jsx("span",{className:"gradient-text",children:"Organizational Intelligence"})]})]}),e.jsx("div",{className:"grid md:grid-cols-4 gap-6",children:yc.map((t,a)=>e.jsxs(E.div,{initial:{opacity:0,y:20},whileInView:{opacity:1,y:0},viewport:{once:!0},transition:{delay:a*.12},className:"relative text-center",children:[e.jsx("div",{className:"mono-text text-5xl font-black text-primary/10 mb-3",children:t.num}),e.jsx("div",{className:"w-14 h-14 mx-auto rounded-2xl bg-primary/10 glow-border flex items-center justify-center mb-4",children:e.jsx(t.icon,{size:24,className:"text-primary"})}),e.jsx("h3",{className:"font-semibold text-foreground mb-2",children:t.title}),e.jsx("p",{className:"text-sm text-muted-foreground leading-relaxed",children:t.desc})]},a))})]})}),wc=[{icon:dl,title:"Smart Document Search & Retrieval",desc:"Find exactly what you need across thousands of documents. UACN understands meaning, not just keywords."},{icon:gl,title:"AI-Powered Analysis",desc:"Analyze financial reports, spot trends, compare data across periods — all through natural conversation."},{icon:ha,title:"Role-Based Access & Security",desc:"Granular permissions ensure every user only sees what they're authorized to access."},{icon:Ji,title:"Compliance & Audit Readiness",desc:"Instant access to policies and procedures. Full audit trails of every query and response."},{icon:Hi,title:"Continuous Learning Knowledge Base",desc:"As new documents are approved, UACN learns and evolves — always current, always accurate."}],jc=()=>e.jsx("section",{id:"features",className:"section-padding bg-secondary/30",children:e.jsxs("div",{className:"container mx-auto max-w-5xl",children:[e.jsxs(E.div,{initial:{opacity:0},whileInView:{opacity:1},viewport:{once:!0},className:"text-center mb-16",children:[e.jsx("p",{className:"mono-text text-xs text-primary mb-3 uppercase tracking-widest",children:"Core Features"}),e.jsxs("h2",{className:"text-3xl md:text-5xl font-black tracking-tight text-balance mb-4",children:["Everything Your Organization ",e.jsx("span",{className:"gradient-text",children:"Needs to Know"})]})]}),e.jsx("div",{className:"grid md:grid-cols-3 gap-5",children:wc.map((t,a)=>e.jsxs(E.div,{initial:{opacity:0,y:20},whileInView:{opacity:1,y:0},viewport:{once:!0},transition:{delay:a*.08},className:`glass-card p-6 hover:glow-border transition-all duration-300 ${a>=3?"md:col-span-1":""}`,children:[e.jsx("div",{className:"w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4",children:e.jsx(t.icon,{size:20,className:"text-primary"})}),e.jsx("h3",{className:"font-semibold text-lg mb-2 text-foreground",children:t.title}),e.jsx("p",{className:"text-sm text-muted-foreground leading-relaxed",children:t.desc})]},a))})]})}),_c=[{icon:Zi,dept:"Finance",prompt:'"Summarize Q3 revenue vs Q2 and highlight anomalies"',desc:"Analyze quarterly reports in seconds. Compare periods, spot trends, surface key metrics — no spreadsheets required."},{icon:cl,dept:"Compliance",prompt:'"Show me the latest anti-bribery policy and when it was last updated"',desc:"Instant access to policies, regulatory documents, and full audit trails for every interaction."},{icon:el,dept:"HSE",prompt:'"What is the emergency evacuation procedure for Building 7?"',desc:"Quickly retrieve safety procedures, incident protocols, and training materials when every second counts."},{icon:ul,dept:"Operations",prompt:'"What is the SOP for onboarding a new vendor?"',desc:"Reduce dependency on tribal knowledge. Standard procedures available to everyone, instantly."},{icon:sl,dept:"Executives",prompt:'"What were our top 3 risk factors last quarter?"',desc:"Ask strategic questions, get instant insights backed by your organization's actual data."}],Nc=()=>e.jsx("section",{id:"use-cases",className:"section-padding",children:e.jsxs("div",{className:"container mx-auto max-w-5xl",children:[e.jsxs(E.div,{initial:{opacity:0},whileInView:{opacity:1},viewport:{once:!0},className:"text-center mb-16",children:[e.jsx("p",{className:"mono-text text-xs text-primary mb-3 uppercase tracking-widest",children:"Use Cases"}),e.jsxs("h2",{className:"text-3xl md:text-5xl font-black tracking-tight text-balance mb-4",children:["Built for Every ",e.jsx("span",{className:"gradient-text",children:"Team"})]}),e.jsx("p",{className:"text-muted-foreground max-w-2xl mx-auto text-lg",children:"From the boardroom to the plant floor — UACN speaks every department's language."})]}),e.jsx("div",{className:"space-y-5",children:_c.map((t,a)=>e.jsxs(E.div,{initial:{opacity:0,x:a%2===0?-20:20},whileInView:{opacity:1,x:0},viewport:{once:!0},transition:{delay:a*.08},className:"glass-card p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start hover:glow-border transition-all duration-300",children:[e.jsx("div",{className:"shrink-0",children:e.jsx("div",{className:"w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center",children:e.jsx(t.icon,{size:22,className:"text-primary"})})}),e.jsxs("div",{className:"flex-1",children:[e.jsx("div",{className:"flex items-center gap-3 mb-2",children:e.jsx("h3",{className:"font-semibold text-lg text-foreground",children:t.dept})}),e.jsx("p",{className:"mono-text text-sm text-primary/80 mb-3 italic",children:t.prompt}),e.jsx("p",{className:"text-sm text-muted-foreground leading-relaxed",children:t.desc})]})]},a))})]})}),Cc=[{icon:Ki,title:"Built for Internal Data",desc:"Unlike generic AI tools, UACN works exclusively with your approved internal documents — no hallucinated external data."},{icon:pa,title:"Secure & Controlled",desc:"Enterprise-grade access controls, approval workflows, and audit logging. Your data never leaves your environment."},{icon:ua,title:"Context-Aware Responses",desc:"UACN understands organizational context — departments, roles, document relationships — for truly relevant answers."},{icon:al,title:"Knowledge + Analytics",desc:"Not just retrieval. UACN combines knowledge base search with analytical intelligence for deeper insights."}],kc=()=>e.jsx("section",{className:"section-padding bg-secondary/30",children:e.jsxs("div",{className:"container mx-auto max-w-5xl",children:[e.jsxs(E.div,{initial:{opacity:0},whileInView:{opacity:1},viewport:{once:!0},className:"text-center mb-16",children:[e.jsx("p",{className:"mono-text text-xs text-primary mb-3 uppercase tracking-widest",children:"Why UACN"}),e.jsxs("h2",{className:"text-3xl md:text-5xl font-black tracking-tight text-balance mb-4",children:["Not Another ",e.jsx("span",{className:"gradient-text",children:"Chatbot"})]}),e.jsx("p",{className:"text-muted-foreground max-w-2xl mx-auto text-lg",children:"UACN is purpose-built for enterprise knowledge — not a generic AI with your data bolted on."})]}),e.jsx("div",{className:"grid sm:grid-cols-2 gap-5",children:Cc.map((t,a)=>e.jsxs(E.div,{initial:{opacity:0,y:20},whileInView:{opacity:1,y:0},viewport:{once:!0},transition:{delay:a*.1},className:"glass-card p-6 glow-border",children:[e.jsx("div",{className:"w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4",children:e.jsx(t.icon,{size:20,className:"text-primary"})}),e.jsx("h3",{className:"font-semibold text-lg mb-2 text-foreground",children:t.title}),e.jsx("p",{className:"text-sm text-muted-foreground leading-relaxed",children:t.desc})]},a))})]})}),Sc=[{icon:ga,title:"Data Privacy First",desc:"Your documents stay within your infrastructure. Zero data exposure to external systems."},{icon:tl,title:"Role-Based Access Control",desc:"Fine-grained permissions at user, team, and document level. See only what you're authorized to."},{icon:Yi,title:"Approval Workflows",desc:"Every document goes through an approval process before entering the knowledge base."},{icon:ml,title:"Enterprise Architecture",desc:"SOC 2 compliant infrastructure, encrypted at rest and in transit, with comprehensive audit logging."}],zc=()=>e.jsx("section",{id:"security",className:"section-padding",children:e.jsxs("div",{className:"container mx-auto max-w-5xl",children:[e.jsxs(E.div,{initial:{opacity:0},whileInView:{opacity:1},viewport:{once:!0},className:"text-center mb-16",children:[e.jsx("p",{className:"mono-text text-xs text-primary mb-3 uppercase tracking-widest",children:"Trust & Security"}),e.jsxs("h2",{className:"text-3xl md:text-5xl font-black tracking-tight text-balance mb-4",children:["Enterprise-Grade ",e.jsx("span",{className:"gradient-text",children:"Security"})]}),e.jsx("p",{className:"text-muted-foreground max-w-2xl mx-auto text-lg",children:"Built from the ground up with the security posture that enterprise organizations demand."})]}),e.jsx("div",{className:"grid sm:grid-cols-2 gap-5",children:Sc.map((t,a)=>e.jsxs(E.div,{initial:{opacity:0,y:20},whileInView:{opacity:1,y:0},viewport:{once:!0},transition:{delay:a*.1},className:"glass-card p-6 hover:glow-border transition-all duration-300",children:[e.jsx("div",{className:"w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4",children:e.jsx(t.icon,{size:20,className:"text-primary"})}),e.jsx("h3",{className:"font-semibold text-lg mb-2 text-foreground",children:t.title}),e.jsx("p",{className:"text-sm text-muted-foreground leading-relaxed",children:t.desc})]},a))})]})}),Lc=()=>e.jsx("section",{className:"section-padding",children:e.jsx("div",{className:"container mx-auto max-w-3xl",children:e.jsxs(E.div,{initial:{opacity:0,y:30},whileInView:{opacity:1,y:0},viewport:{once:!0},className:"glass-card glow-border p-10 md:p-16 text-center",children:[e.jsx("p",{className:"mono-text text-xs text-primary mb-3 uppercase tracking-widest",children:"Get Started"}),e.jsxs("h2",{className:"text-3xl md:text-5xl font-black tracking-tight text-balance mb-4",children:["Ready to Unlock Your ",e.jsx("br",{}),"Organization's ",e.jsx("span",{className:"gradient-text",children:"Intelligence"}),"?"]}),e.jsx("p",{className:"text-muted-foreground max-w-xl mx-auto text-lg mb-8",children:"Join forward-thinking enterprises that trust UACN to turn internal knowledge into a competitive advantage."}),e.jsxs("div",{className:"flex flex-col sm:flex-row gap-4 justify-center",children:[e.jsxs(ye,{size:"lg",className:"text-base gap-2 px-8 h-12",children:["Request a Demo ",e.jsx(ma,{size:16})]}),e.jsx(ye,{size:"lg",variant:"outline",className:"text-base px-8 h-12 border-border/60 text-foreground hover:bg-secondary",children:"Talk to Sales"})]})]})})}),Ic=()=>e.jsx("footer",{className:"border-t border-border/50 py-12 px-6",children:e.jsxs("div",{className:"container mx-auto max-w-5xl flex flex-col md:flex-row items-center justify-between gap-6",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx("div",{className:"w-7 h-7 md:w-10 md:h-10 rounded-md flex items-center justify-center",children:e.jsx("img",{src:"/logo.png",alt:"UACN Logo",className:"w-5 h-5 md:w-8 md:h-8 object-contain"})}),e.jsx("span",{className:"font-bold text-foreground",children:"UACN"}),e.jsx("span",{className:"text-muted-foreground text-sm ml-2",children:"— The Central Intelligence Hub"})]}),e.jsxs("p",{className:"text-xs text-muted-foreground",children:["© ",new Date().getFullYear()," UACN AI. All rights reserved."]})]})}),Ac=()=>e.jsxs("div",{className:"min-h-screen bg-background",children:[e.jsx(uc,{}),e.jsx(hc,{}),e.jsx(fc,{}),e.jsx(bc,{}),e.jsx(vc,{}),e.jsx(jc,{}),e.jsx(Nc,{}),e.jsx(kc,{}),e.jsx(zc,{}),e.jsx(Lc,{}),e.jsx(Ic,{})]}),Tc=()=>{var St;const t=aa(),a=i.useRef(null),[n,o]=i.useState(()=>!!localStorage.getItem("token")),[s,r]=i.useState(()=>{const f=localStorage.getItem("user");return f?JSON.parse(f):null}),[l,c]=i.useState(()=>localStorage.getItem("token")),[u,p]=i.useState(()=>{const f=localStorage.getItem("token"),w=localStorage.getItem("authInProgress");return!f||w==="true"}),[d,y]=i.useState(!1),[b,_]=i.useState(()=>!localStorage.getItem("token")),[z,S]=i.useState(()=>!1),[m,g]=i.useState(()=>!!localStorage.getItem("token")),[k,M]=i.useState([]),[x,F]=i.useState(null),[le,Z]=i.useState(""),[Y,B]=i.useState(!1),[ee,H]=i.useState(!1),[I,me]=i.useState(null),[ce,de]=i.useState(!1),[oe,te]=i.useState(null),[ie,Q]=i.useState(""),[ue,ae]=i.useState(!1),[pe,fe]=i.useState(null),[Ne,re]=i.useState(!1),[we,j]=i.useState(null),[P,D]=i.useState(null),[N,R]=i.useState(""),[q,W]=i.useState(()=>{try{const f=localStorage.getItem("pinnedConversations");return new Set(f?JSON.parse(f):[])}catch{return new Set}}),[Fe,Ie]=i.useState("chat"),at=i.useRef(null),Ae=i.useRef(null),Be=typeof window<"u"&&(window.location.pathname==="/admin"||window.location.pathname==="/admin"||window.location.pathname.includes("/admin")),nt=s?`${((St=s.fullName)==null?void 0:St.split(" ").map(f=>f[0]).join("").toUpperCase())||""}`:"",Te=(f=!1)=>{if(!Ae.current)return;const w=(L=0)=>{if(!Ae.current)return;const{scrollHeight:V,scrollTop:he,clientHeight:ge}=Ae.current;(f||he+ge<V-10)&&(Ae.current.scrollTop=V),L<3&&requestAnimationFrame(()=>w(L+1))};setTimeout(()=>{requestAnimationFrame(()=>w(0))},50)},T=async(f=10)=>{for(let w=0;w<f;w++)try{if((await K.get("/health",{timeout:2e3})).status===200)return console.log("Backend is ready"),!0}catch{console.log(`Backend not ready (attempt ${w+1}/${f}), retrying...`),await new Promise(V=>setTimeout(V,500))}return console.error("Backend failed to become ready"),!1};i.useEffect(()=>{(async()=>{const w=localStorage.getItem("token"),L=localStorage.getItem("user");w&&L?(c(w),r(JSON.parse(L)),o(!0),K.defaults.headers.common.Authorization=`Bearer ${w}`,await T()?(()=>{try{return!!JSON.parse(atob(w.split(".")[1])).isAdmin}catch{return!1}})()?(g(!1),window.location.pathname.includes("/admin")||(window.location.href="/UACN-GPT/admin")):(a.current=Date.now(),J(w)):(console.error("Could not connect to backend"),g(!1))):g(!1),p(!1)})()},[]),i.useEffect(()=>{Be?document.title="UACN GPT - Admin":document.title="UACN GPT - User"},[Be]),i.useEffect(()=>{Te(!0)},[x==null?void 0:x._id,x==null?void 0:x.messages.length]),i.useEffect(()=>{localStorage.setItem("pinnedConversations",JSON.stringify(Array.from(q)))},[q]),i.useEffect(()=>{x!=null&&x._id&&localStorage.setItem("lastConversationId",x._id)},[x==null?void 0:x._id]);const J=async f=>{try{const{data:w}=await K.get("/api/conversations",{headers:{Authorization:`Bearer ${f}`}});if(M(w.conversations),w.conversations.length>0){const L=localStorage.getItem("lastConversationId"),V=L?w.conversations.find(he=>he._id===L):null;F(V||w.conversations[0])}}catch(w){console.error("Load conversations error:",w)}finally{const w=Date.now()-(a.current||Date.now()),L=Math.max(0,3e3-w);L>0?setTimeout(()=>{g(!1),setTimeout(()=>Te(!0),100)},L):(g(!1),setTimeout(()=>Te(!0),100))}},ne=async(f,w)=>{a.current=Date.now(),c(f),r(w),o(!0),g(!0),K.defaults.headers.common.Authorization=`Bearer ${f}`,await J(f)},X=()=>{de(!0)},Ee=()=>{localStorage.removeItem("token"),localStorage.removeItem("user"),o(!1),r(null),c(null),M([]),F(null),delete K.defaults.headers.common.Authorization,de(!1)},Re=async()=>{if(l)try{const{data:f}=await K.post("/api/conversations",{},{headers:{Authorization:`Bearer ${l}`}});M([f.conversation,...k]),F(f.conversation),Z("")}catch(f){console.error("Create conversation error:",f)}},Ce=async()=>{if(I)try{await K.delete(`/api/conversations/${I}`,{headers:{Authorization:`Bearer ${l}`}});const f=k.filter(w=>w._id!==I);M(f),(x==null?void 0:x._id)===I&&F(f.length>0?f[0]:null),H(!1),me(null),re(!1),j(null)}catch(f){console.error("Delete conversation error:",f),alert("Failed to delete conversation")}},Na=(f,w)=>{w.stopPropagation(),j(we===f?null:f),re(we!==f)},Nt=async()=>{if(!(!P||!N.trim()||!l))try{await K.put(`/api/conversations/${P}`,{title:N.trim()},{headers:{Authorization:`Bearer ${l}`}});const f=k.map(w=>w._id===P?{...w,title:N.trim()}:w);M(f),(x==null?void 0:x._id)===P&&F({...x,title:N.trim()}),D(null),R("")}catch(f){console.error("Rename conversation error:",f),alert("Failed to rename conversation")}},Ca=(f,w)=>{w.stopPropagation(),me(f),H(!0),re(!1),j(null)},ka=(f,w)=>{w.stopPropagation();const L=new Set(q);L.has(f)?L.delete(f):L.add(f),W(L),re(!1),j(null)},Sa=(f,w)=>{te(f),Q(w),ae(!0)},za=async()=>{if(!(!x||oe===null||!ie.trim()||!l))try{B(!0),ae(!1),fe(oe+1);const{data:f}=await K.post(`/api/conversations/${x._id}/message/${oe}/edit`,{content:ie.trim()},{headers:{Authorization:`Bearer ${l}`}});F(f.conversation),M(k.map(w=>w._id===f.conversation._id?f.conversation:w))}catch(f){console.error("Edit message error:",f),alert("Failed to edit message")}finally{ae(!1),te(null),Q(""),fe(null),B(!1)}},Ct=async(f,w)=>{const L=await fetch(`/api/conversations/${f}/message-stream`,{method:"POST",headers:{Authorization:`Bearer ${l}`,"Content-Type":"application/json"},body:JSON.stringify({content:w})});if(!L.ok)throw new Error(`HTTP ${L.status}: ${L.statusText}`);if(!L.body)throw new Error("No response body");const V=L.body.getReader(),he=new TextDecoder;let ge="",xe="",qe=null;try{for(;;){const{done:He,value:Aa}=await V.read();if(He)break;ge+=he.decode(Aa,{stream:!0});const Ye=ge.split(`
`);for(let st=0;st<Ye.length-1;st++){const zt=Ye[st].trim();if(zt.startsWith("data: "))try{const ke=JSON.parse(zt.slice(6));if(ke.done)return ke.conversation&&(qe=ke.conversation),qe;if(ke.error)throw new Error(ke.error);xe=ke.fullResponse||"",F(Se=>{if(!Se)return Se;const ot=Se.messages[Se.messages.length-1];if(ot&&ot.role==="assistant"){const Je={...Se};return Je.messages=[...Se.messages],Je.messages[Je.messages.length-1]={...ot,content:xe},Je}else return{...Se,messages:[...Se.messages,{role:"assistant",content:xe,timestamp:new Date}]}}),Te(!1)}catch(ke){console.error("Error parsing stream data:",ke)}}ge=Ye[Ye.length-1]}}finally{V.releaseLock()}return qe},kt=async()=>{const f=le.trim();if(!f||Y||!l)return;if(Z(""),!x){const V=await K.post("/api/conversations",{},{headers:{Authorization:`Bearer ${l}`}});F(V.data.conversation),M([V.data.conversation,...k]);const he={role:"user",content:f,timestamp:new Date},ge={...V.data.conversation,messages:[he]};F(ge),B(!0);try{const xe=await Ct(V.data.conversation._id,f);xe&&(F(xe),M(qe=>qe.map(He=>He._id===xe._id?xe:He)))}catch(xe){console.error("Send message error:",xe),alert("Error sending message. Please try again.")}finally{B(!1)}return}const w={role:"user",content:f,timestamp:new Date},L={...x,messages:[...x.messages,w]};F(L),B(!0);try{const V=await Ct(x._id,f);V&&(F(V),M(he=>he.map(ge=>ge._id===V._id?V:ge)))}catch(V){console.error("Send message error:",V),alert("Error sending message. Please try again.")}finally{B(!1)}},La=f=>{f.key==="Enter"&&!f.shiftKey&&(f.preventDefault(),kt())};if(u)return e.jsx("div",{style:{width:"100%",height:"100dvh",display:"flex",alignItems:"center",justifyContent:"center",background:"#ffffff"},children:e.jsx("div",{style:{textAlign:"center"},children:e.jsx("div",{style:{fontSize:"18px",color:"#333",marginBottom:"10px",fontFamily:"Georgia, serif"},children:"Loading..."})})});if(n&&m)return e.jsx(Ze,{userType:"user"});if(Be)return e.jsx("div",{style:{height:"100dvh",background:"#ffffff"},children:e.jsx(Ir,{})});if(!n&&t.pathname==="/login")return e.jsx(Rt,{onLoginSuccess:ne});if(n===!1&&u===!1&&b)return e.jsx(Ac,{});if(n===!1&&u===!1&&z)return e.jsx(Oi,{onEnter:()=>S(!1),user:s});if(!n)return e.jsx(Rt,{onLoginSuccess:ne});const Ia=()=>y(!d);return e.jsxs(e.Fragment,{children:[u&&e.jsx(Ze,{userType:Be?"admin":"user"}),e.jsxs("div",{className:"ufl-root",children:[e.jsxs("aside",{className:`sidebar ${d?"sidebar-open":""}`,children:[e.jsx("div",{className:"sidebar-header",children:e.jsx("button",{className:"new-chat-btn",onClick:()=>{Re(),window.innerWidth<=768&&y(!1)},children:"+ New chat"})}),e.jsxs("div",{className:"sidebar-conversations",children:[e.jsx("div",{className:"sidebar-conversations-label",children:"Conversations"}),k.length===0?e.jsx("div",{className:"sidebar-empty",children:"No conversations yet"}):[...k].sort((w,L)=>{const V=q.has(w._id),he=q.has(L._id);return V!==he?V?-1:1:0}).map(w=>e.jsxs("div",{className:`sidebar-conversation ${(x==null?void 0:x._id)===w._id?"active":""} ${q.has(w._id)?"pinned":""}`,onClick:()=>{F(w),window.innerWidth<=768&&y(!1)},children:[e.jsx("div",{className:"conv-main",children:P===w._id?e.jsx("input",{type:"text",className:"rename-input",value:N,onChange:L=>R(L.target.value),onBlur:Nt,onKeyDown:L=>{L.key==="Enter"&&Nt(),L.key==="Escape"&&(D(null),R(""))},onClick:L=>L.stopPropagation(),autoFocus:!0}):e.jsxs(e.Fragment,{children:[e.jsxs("div",{className:"conv-title",title:w.title,children:[q.has(w._id)&&e.jsx(Ut,{className:"pin-icon",size:14}),w.title]}),e.jsx("div",{className:"conv-date",children:new Date(w.updatedAt).toLocaleDateString()})]})}),e.jsxs("div",{className:"conv-menu-container",onMouseEnter:()=>re(!0),onMouseLeave:()=>{re(!1),j(null)},children:[e.jsx("button",{className:"conv-menu-btn",onClick:L=>Na(w._id,L),title:"More options",children:"..."}),Ne&&we===w._id&&e.jsxs("div",{className:"context-menu-dropdown",onClick:L=>L.stopPropagation(),children:[e.jsxs("button",{className:"context-menu-item",onClick:L=>ka(w._id,L),children:[e.jsx(Ut,{size:16}),q.has(w._id)?"Unpin chat":"Pin chat"]}),e.jsxs("button",{className:"context-menu-item delete",onClick:L=>Ca(w._id,L),children:[e.jsx(cn,{size:16}),"Delete"]})]})]})]},w._id))]}),e.jsxs("div",{className:"sidebar-footer",children:[e.jsxs("div",{className:"user-info",children:[e.jsx("div",{className:"user-name",children:s==null?void 0:s.fullName}),e.jsx("div",{className:"user-email",children:s==null?void 0:s.businessUnit})]}),e.jsxs("button",{className:"logout-btn",onClick:X,children:[e.jsx(un,{className:"logout-btn-icon"}),"Logout"]})]})]}),e.jsxs("main",{className:"chat-layout",onClick:()=>{d&&typeof window<"u"&&window.innerWidth<=768&&y(!1)},children:[e.jsxs("header",{className:"chat-header",children:[e.jsxs("button",{className:"hamburger-btn",onClick:Ia,children:[e.jsx("span",{className:"hamburger-line"}),e.jsx("span",{className:"hamburger-line"}),e.jsx("span",{className:"hamburger-line"})]}),e.jsxs("div",{className:"chat-header-left",children:[e.jsxs("div",{className:"chat-title",children:[s==null?void 0:s.businessUnit," GPT"]}),e.jsxs("div",{className:"chat-subtitle",children:["Ask anything about ",s==null?void 0:s.businessUnit," documents and guidelines"]})]}),e.jsxs("div",{className:"chat-header-right",children:[e.jsxs("div",{className:"header-user-info",children:[e.jsx("div",{className:"header-user-name",children:s==null?void 0:s.fullName}),e.jsx("div",{className:"header-user-email",children:s==null?void 0:s.email})]}),e.jsx("button",{className:"header-tab active",children:"Chat"})]})]}),e.jsxs(e.Fragment,{children:[e.jsxs("section",{className:"chat-messages",ref:Ae,children:[!(x!=null&&x.messages.length)&&!Y?e.jsxs("div",{className:"chat-empty-state",children:[e.jsx("div",{className:"empty-logo",children:e.jsx("img",{src:"/avatar-1.png",alt:"UACN GPT"})}),e.jsx("h1",{className:"empty-title",children:"What's on your mind today?"}),e.jsxs("p",{className:"empty-subtitle",children:["Ask anything about ",s==null?void 0:s.businessUnit," company documents, policies, procedures, and guidelines"]})]}):e.jsx(e.Fragment,{children:x==null?void 0:x.messages.map((f,w)=>e.jsx("div",{children:pe===w?e.jsx("div",{className:"message-row assistant",children:e.jsxs("div",{className:"bubble typing",children:[e.jsx("span",{className:"dot"}),e.jsx("span",{className:"dot"}),e.jsx("span",{className:"dot"})]})}):e.jsxs("div",{className:`message-row ${f.role==="assistant"?"assistant":"user"}`,children:[f.role==="user"&&e.jsx("div",{className:"avatar",children:e.jsx("span",{className:"avatar-user",children:nt||"U"})}),e.jsx("div",{className:"bubble",children:f.content.split(`
`).map((L,V)=>e.jsx("p",{children:ca(L)},V))}),f.role==="user"&&e.jsx("div",{className:"message-actions",children:e.jsx("button",{className:"message-action-btn",onClick:()=>Sa(w,f.content),title:"Edit message",children:e.jsx(on,{size:18})})})]})},w))}),Y&&e.jsx("div",{className:"message-row assistant",children:e.jsxs("div",{className:"bubble typing",children:[e.jsx("span",{className:"dot"}),e.jsx("span",{className:"dot"}),e.jsx("span",{className:"dot"})]})}),e.jsx("div",{ref:at})]}),e.jsxs("footer",{className:"chat-input-wrapper",children:[e.jsxs("div",{className:"chat-input-inner",children:[e.jsx("textarea",{rows:1,className:"chat-input",placeholder:"Send a message...",value:le,onChange:f=>Z(f.target.value),onKeyDown:La}),e.jsx("button",{className:"send-btn",onClick:kt,disabled:Y||!le.trim(),children:e.jsx(yt,{size:20})})]}),e.jsxs("div",{className:"chat-hint",children:[s==null?void 0:s.businessUnit," GPT may not always be accurate. Verify critical information with HR or Compliance."]})]})]})]}),e.jsx("style",{children:`
        .hamburger-btn {
          display: none;
          flex-direction: column;
          gap: 5px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 8px;
          margin-right: 10px;
          z-index: 1002;
        }

        .hamburger-line {
          width: 24px;
          height: 3px;
          background: #333;
          border-radius: 2px;
          transition: all 0.3s;
        }

        .sidebar-conversations {
          flex: 1;
          overflow-y: auto;
          padding: 10px 0;
          border-bottom: 1px solid #e0e0e0;
          -webkit-overflow-scrolling: touch;
          touch-action: pan-y;
        }

        .sidebar-conversations-label {
          font-size: 12px;
          font-weight: 600;
          color: #999;
          padding: 10px 12px;
          text-transform: uppercase;
          font-family: Georgia, serif;
        }

        .sidebar-empty {
          padding: 20px 12px;
          text-align: center;
          color: #999;
          font-size: 13px;
          font-family: Georgia, serif;
        }

        .sidebar-conversation {
          padding: 12px;
          margin: 4px 8px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.2s;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          position: relative;
        }

        .sidebar-conversation:hover {
          background: #f5f5f5;
        }

        .sidebar-conversation.active {
          background: #e8e8ff;
        }

        .sidebar-conversation.pinned {
          background: #fff5e6;
          border-left: 3px solid #ed0000;
        }

        .sidebar-conversation.pinned.active {
          background: #ffeccc;
        }

        .sidebar-conversation.pinned:hover {
          background: #fff9f0;
        }

        .conv-main {
          flex: 1;
          min-width: 0;
        }

        .conv-title {
          font-size: 14px;
          font-weight: 500;
          color: #333;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: Georgia, serif;
        }

        .pin-icon {
          font-size: 12px;
          flex-shrink: 0;
        }

        .conv-date {
          font-size: 12px;
          color: #999;
          margin-top: 4px;
          font-family: Georgia, serif;
        }

        .conv-menu-btn {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          border: none;
          background: transparent;
          color: #999;
          font-size: 18px;
          cursor: pointer;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          opacity: 1;
          font-weight: bold;
        }

        .sidebar-conversation:hover .conv-menu-btn {
          background: #f0f0f0;
          color: #ed0000;
        }

        .conv-menu-container:hover .conv-menu-btn {
          background: #f0f0f0;
          color: #ed0000;
        }

        .conv-menu-btn:active {
          background: #e0e0e0;
        }

        .conv-menu-container {
          position: relative;
          display: flex;
          align-items: center;
        }

        .context-menu-dropdown {
          position: absolute;
          right: 0;
          top: 100%;
          margin-top: 4px;
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          min-width: 140px;
          z-index: 1000;
          animation: slideDown 0.15s ease-out;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .context-menu-item {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 10px 12px;
          border: none;
          background: transparent;
          text-align: left;
          cursor: pointer;
          font-size: 13px;
          color: #333;
          transition: background 0.15s;
          font-family: Georgia, serif;
        }

        .context-menu-item:first-child {
          border-radius: 6px 6px 0 0;
        }

        .context-menu-item:last-child {
          border-radius: 0 0 6px 6px;
        }

        .context-menu-item:hover {
          background: #f5f5f5;
        }

        .context-menu-item.delete {
          color: #d32f2f;
        }

        .context-menu-item.delete:hover {
          background: #ffebee;
        }

        .rename-input {
          width: 100%;
          padding: 6px 8px;
          border: 2px solid #ed0000;
          border-radius: 4px;
          font-size: 13px;
          font-family: Georgia, serif;
          outline: none;
          background: white;
        }


        .user-info {
          margin-bottom: 12px;
          padding: 0 0 12px 0;
          border-bottom: 1px solid #e0e0e0;
        }

        .user-name {
          font-weight: 600;
          color: #333;
          font-size: 14px;
          font-family: Georgia, serif;
        }

        .user-email {
          font-size: 12px;
          color: #999;
          font-family: Georgia, serif;
          margin-top: 2px;
        }

        .logout-btn {
          width: 100%;
          padding: 12px 16px;
          background: linear-gradient(135deg, #d92322 0%, #b81a19 100%);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          color: #ffffff;
          margin-bottom: 12px;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 2px 4px rgba(217, 35, 34, 0.2);
        }

        .logout-btn-icon {
          font-size: 16px;
          display: flex;
          align-items: center;
        }

        .logout-btn:hover {
          background: linear-gradient(135deg, #a91a19 0%, #8f1615 100%);
          box-shadow: 0 4px 8px rgba(217, 35, 34, 0.3);
          transform: translateY(-2px);
        }

        .logout-btn:active {
          transform: translateY(0);
          box-shadow: 0 2px 4px rgba(217, 35, 34, 0.2);
        }

        .chat-header {
          padding: 16px;
          display: flex;
          align-items: center;
          border-bottom: 1px solid #e0e0e0;
          background: white;
        }

        .chat-title {
          font-size: 18px;
          font-weight: 600;
          color: #333;
          font-family: Georgia, serif;
        }

        .chat-subtitle {
          font-size: 12px;
          color: #999;
          font-family: Georgia, serif;
        }

        .header-user-info {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }

        .header-user-name {
          font-size: 14px;
          font-weight: 600;
          color: #333;
          font-family: Georgia, serif;
        }

        .header-user-email {
          font-size: 12px;
          color: #999;
          font-family: Georgia, serif;
        }

        .chat-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
        }

        .empty-title {
          font-size: 24px;
          font-weight: 600;
          color: #333;
          margin: 0 0 12px 0;
          font-family: Georgia, serif;
        }

        .empty-subtitle {
          font-size: 14px;
          color: #999;
          margin: 0;
          max-width: 400px;
          font-family: Georgia, serif;
        }

        /* Mobile Responsive Styles */
        @media (max-width: 768px) {
          .ufl-root {
            width: 100%;
            height: 100dvh;
            position: relative;
            overflow: hidden;
          }

          .hamburger-btn {
            display: flex;
          }

          .sidebar {
            position: fixed;
            left: 0;
            top: 0;
            width: 260px;
            height: 100dvh;
            transform: translateX(-100%);
            transition: transform 0.3s ease;
            z-index: 1001;
          }

          .sidebar.sidebar-open {
            transform: translateX(0);
          }

          .chat-layout {
            flex: 1;
            width: 100%;
          }

          .chat-header {
            padding: 12px 16px;
            display: flex;
            align-items: center;
          }

          .chat-title {
            font-size: 18px;
            font-family: Georgia, serif;
          }

          .chat-subtitle {
            font-size: 12px;
            font-family: Georgia, serif;
          }

          .message-row {
            padding: 10px 16px;
          }

          .avatar {
            min-width: 32px;
          }

          .bubble {
            max-width: 85%;
            font-size: 14px;
          }

          .chat-textarea {
            min-height: 40px;
            font-size: 16px;
          }
        }

        @media (max-width: 480px) {
          .chat-header {
            padding: 10px 12px;
          }

          .chat-title {
            font-size: 16px;
            font-family: Georgia, serif;
          }

          .chat-subtitle {
            font-size: 11px;
            font-family: Georgia, serif;
          }

          .chat-messages {
            padding: 8px 0;
          }

          .message-row {
            padding: 8px 12px;
            gap: 8px;
          }

          .avatar {
            min-width: 28px;
            width: 28px;
            height: 28px;
          }

          .bubble {
            max-width: 90%;
            font-size: 13px;
            padding: 8px 10px;
          }

          .chat-input-wrapper {
            padding: 10px 10px 12px;
          }

          .chat-textarea {
            min-height: 36px;
            font-size: 15px;
            padding: 8px;
          }

          .send-btn {
            padding: 8px 12px;
            font-size: 12px;
          }

          .chat-actions-bar {
            display: flex;
            gap: 1rem;
            padding: 1rem;
            background: linear-gradient(135deg, rgba(237, 0, 0, 0.08) 0%, rgba(237, 0, 0, 0.04) 100%);
            border-bottom: 1px solid rgba(237, 0, 0, 0.15);
            flex-wrap: wrap;
            align-items: center;
            backdrop-filter: blur(10px);
          }

          .export-btn {
            display: flex;
            align-items: center;
            gap: 0.6rem;
            padding: 0.7rem 1.2rem;
            background: linear-gradient(135deg, #ED0000 0%, #c70000 100%);
            border: none;
            color: white;
            border-radius: 8px;
            font-size: 0.95rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.23, 1, 0.320, 1);
            box-shadow: 0 2px 8px rgba(237, 0, 0, 0.2), 0 1px 3px rgba(0, 0, 0, 0.1);
            position: relative;
            overflow: hidden;
            white-space: nowrap;
          }

          .export-btn::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: rgba(255, 255, 255, 0.2);
            transition: left 0.3s ease;
            z-index: 0;
          }

          .export-btn:hover::before {
            left: 100%;
          }

          .export-btn:hover {
            background: linear-gradient(135deg, #ff1a1a 0%, #ed0000 100%);
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(237, 0, 0, 0.35), 0 2px 6px rgba(0, 0, 0, 0.15);
          }

          .export-btn:active {
            transform: translateY(0);
            box-shadow: 0 1px 4px rgba(237, 0, 0, 0.25), 0 1px 2px rgba(0, 0, 0, 0.1);
          }

          .export-btn svg {
            flex-shrink: 0;
            position: relative;
            z-index: 1;
            transition: transform 0.3s ease;
          }

          .export-btn:hover svg {
            transform: scale(1.1) rotate(5deg);
          }

          .export-btn span {
            position: relative;
            z-index: 1;
          }
        }
      `}),ee&&e.jsx("div",{className:"delete-modal-backdrop",children:e.jsxs("div",{className:"delete-modal-card",children:[e.jsx("h3",{children:"Delete Conversation?"}),e.jsx("p",{children:"Are you sure you want to delete this conversation? This action cannot be undone."}),e.jsxs("div",{className:"delete-modal-actions",children:[e.jsx("button",{className:"delete-modal-cancel",onClick:()=>{H(!1),me(null)},children:"Cancel"}),e.jsx("button",{className:"delete-modal-confirm",onClick:Ce,children:"Delete"})]})]})}),ce&&e.jsx("div",{className:"delete-modal-backdrop",children:e.jsxs("div",{className:"delete-modal-card",children:[e.jsx("h3",{children:"Confirm Logout"}),e.jsx("p",{children:"Are you sure you want to logout? You will need to login again to access this application."}),e.jsxs("div",{className:"delete-modal-actions",children:[e.jsx("button",{className:"delete-modal-cancel",onClick:()=>de(!1),children:"Cancel"}),e.jsx("button",{className:"delete-modal-confirm",onClick:Ee,children:"Logout"})]})]})}),ue&&e.jsx("div",{className:"edit-modal-backdrop",children:e.jsxs("div",{className:"edit-modal-card",children:[e.jsx("h3",{children:"Edit Message"}),e.jsx("textarea",{className:"edit-message-textarea",value:ie,onChange:f=>Q(f.target.value),placeholder:"Enter your message..."}),e.jsxs("div",{className:"edit-modal-actions",children:[e.jsx("button",{className:"edit-modal-cancel",onClick:()=>{ae(!1),te(null),Q("")},disabled:Y,children:"Cancel"}),e.jsx("button",{className:"edit-modal-save",onClick:za,disabled:Y,children:Y?"Loading response":"Save"})]})]})}),e.jsx("style",{children:`
        .delete-modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
        }

        .delete-modal-card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          font-family: Georgia, "Times New Roman", serif;
        }

        .delete-modal-card h3 {
          margin: 0 0 12px 0;
          font-size: 18px;
          color: #333;
        }

        .delete-modal-card p {
          margin: 0 0 20px 0;
          font-size: 14px;
          color: #666;
          line-height: 1.5;
        }

        .delete-modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .delete-modal-cancel {
          padding: 10px 20px;
          border: 1px solid #d0d0d0;
          background: white;
          color: #333;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s;
        }

        .delete-modal-cancel:hover {
          background: #f5f5f5;
        }

        .delete-modal-confirm {
          padding: 10px 20px;
          border: none;
          background: #d32f2f;
          color: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s;
        }

        .delete-modal-confirm:hover {
          background: #b71c1c;
        }

        .edit-modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
        }

        .edit-modal-card {
          background: white;
          border-radius: 12px;
          padding: 24px;
          max-width: 500px;
          width: 90%;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          font-family: Georgia, "Times New Roman", serif;
        }

        .edit-modal-card h3 {
          margin: 0 0 12px 0;
          font-size: 18px;
          color: #333;
        }

        .edit-message-textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid #d0d0d0;
          border-radius: 6px;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 14px;
          resize: vertical;
          min-height: 120px;
          max-height: 300px;
          margin-bottom: 16px;
          color: #333;
          line-height: 1.5;
        }

        .edit-message-textarea:focus {
          outline: none;
          border-color: #22c55e;
          box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.1);
        }

        .edit-modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .edit-modal-cancel {
          padding: 10px 20px;
          border: 1px solid #d0d0d0;
          background: white;
          color: #333;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s;
        }

        .edit-modal-cancel:hover {
          background: #f5f5f5;
        }

        .edit-modal-save {
          padding: 10px 20px;
          border: none;
          background: #22c55e;
          color: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          transition: background 0.2s;
        }

        .edit-modal-save:hover {
          background: #16a34a;
        }
      `})]})]})};document.addEventListener("dragstart",t=>t.preventDefault(),!1);document.addEventListener("dragover",t=>t.preventDefault(),!1);document.addEventListener("drop",t=>t.preventDefault(),!1);document.addEventListener("touchmove",t=>{t.target.closest(".chat-messages")||t.target.closest(".sidebar-conversations")||t.preventDefault()},{passive:!1});document.addEventListener("wheel",t=>{t.ctrlKey&&t.preventDefault()},{passive:!1});let _t=!1;document.addEventListener("pointerdown",()=>{_t=!0},!1);document.addEventListener("pointerup",()=>{_t=!1},!1);document.addEventListener("pointermove",t=>{_t&&t.isPrimary&&t.preventDefault()},{passive:!1});mt.createRoot(document.getElementById("root")).render(e.jsx(Ta.StrictMode,{children:e.jsx(sn,{future:{v7_startTransition:!0,v7_relativeSplatPath:!0},children:e.jsx(Tc,{})})}));
