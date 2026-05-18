2:I[30565,[],"ClientPageRoot"]
3:I[43619,["2776","static/chunks/2776-6f88bbc17ece73fb.js","6970","static/chunks/6970-f66190147b1257be.js","9223","static/chunks/9223-bc1a23c6e9ddc0cf.js","2062","static/chunks/2062-82edcd95a791723c.js","2376","static/chunks/2376-6522d1b70e11a664.js","9540","static/chunks/9540-1ef6229033a2ea0e.js","7504","static/chunks/7504-ca799ef0997bcc96.js","7485","static/chunks/7485-ff4bb541a23fc529.js","8871","static/chunks/8871-3d3363287f5652a7.js","2329","static/chunks/2329-fefd6aa7d2bf2db6.js","6325","static/chunks/6325-3e319b7f387676f6.js","670","static/chunks/670-8199a4fd6076a486.js","6240","static/chunks/app/users/page-b1f9a47da551284a.js"],"default",1]
4:I[51466,[],""]
5:I[50752,[],""]
7:I[18927,["9223","static/chunks/9223-bc1a23c6e9ddc0cf.js","3185","static/chunks/app/layout-b8a2e6ad2904dfc8.js"],"ThemeProvider"]
8:I[9223,["9223","static/chunks/9223-bc1a23c6e9ddc0cf.js","3185","static/chunks/app/layout-b8a2e6ad2904dfc8.js"],"Toaster"]
6:T118e,
              (function() {
                try {
                  function getCookie(name) {
                    const value = "; " + document.cookie;
                    const parts = value.split("; " + name + "=");
                    if (parts.length === 2) return parts.pop().split(";").shift();
                    return null;
                  }
                  const theme = getCookie("admin-theme") || "light";
                  let resolvedTheme = theme;
                  if (theme === "system") {
                    resolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
                  } else {
                    resolvedTheme = theme;
                  }
                  if (resolvedTheme === "dark") {
                    document.documentElement.classList.add("dark");
                  } else {
                    document.documentElement.classList.remove("dark");
                  }
                } catch (e) {}
              })();
              
              // Interceptor global de fetch para incluir credentials en peticiones a /api/
              (function() {
                const originalFetch = window.fetch;
                window.fetch = function(...args) {
                  const [url, options = {}] = args;
                  const urlString = typeof url === 'string' ? url : url.toString();
                  
                  // Si es una petición a nuestra API y no tiene credentials definido
                  if (urlString.startsWith('/api/') && !options.credentials) {
                    options.credentials = 'include';
                  }
                  
                  return originalFetch.call(this, url, options);
                };
              })();
              
              // Suprimir errores de extensiones del navegador (MetaMask, ad blockers, etc.)
              (function() {
                const originalConsoleError = console.error;
                console.error = function(...args) {
                  const errorMessage = args[0]?.toString?.() || '';
                  // Filtrar errores comunes de extensiones
                  const extensionErrors = [
                    'message channel closed before a response was received',
                    'message port closed before',
                    'Extension context invalidated',
                    'The message port closed before',
                    'Error: Script error.',
                    'chrome-extension://',
                    'moz-extension://',
                  ];
                  const shouldSuppress = extensionErrors.some(err => 
                    errorMessage.includes(err) || 
                    (args[0]?.stack && extensionErrors.some(e => args[0].stack.includes(e)))
                  );
                  if (!shouldSuppress) {
                    originalConsoleError.apply(console, args);
                  }
                };
                
                // También capturar errores no manejados de extensiones
                window.addEventListener('error', function(event) {
                  const errorMessage = event.message || '';
                  const filename = event.filename || '';
                  if (
                    errorMessage.includes('message channel closed') ||
                    errorMessage.includes('message port closed') ||
                    filename.includes('chrome-extension://') ||
                    filename.includes('moz-extension://') ||
                    filename.includes('safari-extension://')
                  ) {
                    event.preventDefault();
                    return true;
                  }
                });
                
                window.addEventListener('unhandledrejection', function(event) {
                  const errorMessage = event.reason?.message || event.reason?.toString?.() || '';
                  const stack = event.reason?.stack || '';
                  if (
                    errorMessage.includes('message channel closed') ||
                    errorMessage.includes('message port closed') ||
                    errorMessage.includes('Extension context invalidated') ||
                    stack.includes('chrome-extension://') ||
                    stack.includes('moz-extension://')
                  ) {
                    event.preventDefault();
                    event.stopPropagation();
                  }
                });
              })();
            9:T2761,(function(){if(window.__mileageHistoryInjectorInstalled)return;window.__mileageHistoryInjectorInstalled=true;const formatNumber=(num)=>Number(num).toLocaleString('es-PA',{minimumFractionDigits:num%1===0?0:1,maximumFractionDigits:1});const formatDate=(dateString)=>new Date(dateString).toLocaleString('es-PA',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});let modalEl=null;function ensureModal(){if(modalEl)return modalEl;modalEl=document.createElement('div');modalEl.id='mileage-history-modal';modalEl.className='fixed inset-0 z-[9999] hidden';modalEl.innerHTML='<div class="mileage-history-backdrop fixed inset-0 bg-black/50 transition-opacity opacity-0"></div><div class="fixed inset-0 flex items-center justify-center p-4"><div class="mileage-history-content bg-background border rounded-lg shadow-lg w-full max-w-[550px] max-h-[80vh] overflow-hidden transform scale-95 opacity-0 transition-all duration-200 flex flex-col"><div class="px-6 py-4 border-b"><h2 class="text-lg font-semibold flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-history"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12"/><path d="M3 3v9h9"/></svg>Historial de Kilometraje</h2><p class="text-sm text-muted-foreground mt-1 mileage-history-subtitle">Registro de todos los cambios de kilometraje</p></div><div class="mileage-history-body p-6 overflow-y-auto flex-1"><div class="flex items-center justify-center py-8 mileage-history-loading"><svg class="animate-spin h-6 w-6 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span class="ml-2 text-sm text-muted-foreground">Cargando historial...</span></div><div class="mileage-history-empty hidden text-center py-8 text-muted-foreground"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-3 opacity-50"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12"/><path d="M3 3v9h9"/></svg><p class="text-sm">No hay registros de cambios de kilometraje aún.</p><p class="text-xs mt-1">Los cambios se guardarán automáticamente cada vez que actualices el kilometraje.</p></div><div class="mileage-history-list hidden space-y-3"></div></div><div class="px-6 py-4 border-t flex justify-end"><button class="mileage-history-close inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">Cerrar</button></div></div></div>';document.body.appendChild(modalEl);modalEl.querySelector('.mileage-history-backdrop').addEventListener('click',closeModal);modalEl.querySelector('.mileage-history-close').addEventListener('click',closeModal);document.addEventListener('keydown',(e)=>{if(e.key==='Escape'&&!modalEl.classList.contains('hidden')){closeModal()}});return modalEl}function openModal(){const modal=ensureModal();modal.classList.remove('hidden');void modal.offsetWidth;modal.querySelector('.mileage-history-backdrop').classList.remove('opacity-0');modal.querySelector('.mileage-history-content').classList.remove('scale-95','opacity-0');document.body.style.overflow='hidden'}function closeModal(){const modal=ensureModal();modal.querySelector('.mileage-history-backdrop').classList.add('opacity-0');modal.querySelector('.mileage-history-content').classList.add('scale-95','opacity-0');setTimeout(()=>{modal.classList.add('hidden');document.body.style.overflow=''},200)}async function loadHistory(vehicleId,vehicleName){const modal=ensureModal();modal.querySelector('.mileage-history-subtitle').textContent='Registro de todos los cambios de kilometraje para '+(vehicleName||'este vehículo');modal.querySelector('.mileage-history-loading').classList.remove('hidden');modal.querySelector('.mileage-history-empty').classList.add('hidden');modal.querySelector('.mileage-history-list').classList.add('hidden');try{const res=await fetch('/api/fleet/'+vehicleId+'/mileage-history');if(!res.ok)throw new Error('Error');const data=await res.json();const history=data.data||[];modal.querySelector('.mileage-history-loading').classList.add('hidden');if(history.length===0){modal.querySelector('.mileage-history-empty').classList.remove('hidden');return}const listEl=modal.querySelector('.mileage-history-list');listEl.innerHTML=history.map((item,index)=>{const diff=item.newMileage-item.previousMileage;let diffBadge='';if(diff>0){diffBadge='<span class="text-xs font-medium text-green-600 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">+'+formatNumber(diff)+' km</span>'}else if(diff===0){diffBadge='<span class="text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Sin cambio</span>'}const createdBy=item.createdByName?'<span>•</span><span class="flex items-center gap-1"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'+escapeHtml(item.createdByName)+'</span>':'';const notes=item.notes?'<p class="text-xs text-muted-foreground mt-1 italic">'+escapeHtml(item.notes)+'</p>':'';const lastBadge=index===0?'<span class="text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary/10 px-2 py-1 rounded-full shrink-0 ml-2">Último</span>':'';return'<div class="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"><div class="flex-1 min-w-0"><div class="flex items-center gap-2 flex-wrap"><span class="text-sm font-medium">'+formatNumber(item.previousMileage)+' km</span><span class="text-xs text-muted-foreground">→</span><span class="text-sm font-bold text-primary">'+formatNumber(item.newMileage)+' km</span>'+diffBadge+'</div><div class="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground"><span>'+formatDate(item.createdAt)+'</span>'+createdBy+'</div>'+notes+'</div>'+lastBadge+'</div>'}).join('');listEl.classList.remove('hidden')}catch(err){console.error(err);modal.querySelector('.mileage-history-loading').classList.add('hidden');modal.querySelector('.mileage-history-list').innerHTML='<div class="text-center py-4 text-red-600"><p class="text-sm">No se pudo cargar el historial.</p></div>';modal.querySelector('.mileage-history-list').classList.remove('hidden')}}function escapeHtml(text){const div=document.createElement('div');div.textContent=text;return div.innerHTML}function injectButton(node){if(node.querySelector('.mileage-history-injected-btn'))return;const vehicleId=node.getAttribute('data-vehicle-id');if(!vehicleId)return;const fullContainer=Array.from(node.querySelectorAll('div.flex.gap-2')).find(el=>el.textContent.includes('Colocar Nuevo Record')||el.textContent.includes('Colocar Nuevo'));const compactContainer=Array.from(node.querySelectorAll('div.flex.items-center.gap-1')).find(el=>el.textContent.includes('Actualizar KM'));const targetContainer=fullContainer||compactContainer;if(!targetContainer)return;const btn=document.createElement('button');btn.className='mileage-history-injected-btn inline-flex items-center justify-center rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3 py-2 shadow-sm';if(compactContainer){btn.className='mileage-history-injected-btn inline-flex items-center justify-center rounded-md text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-6 px-2 py-0 shadow-sm'}btn.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="'+(compactContainer?'h-3 w-3 mr-1':'h-3.5 w-3.5 mr-1')+'"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12"/><path d="M3 3v9h9"/></svg>'+(compactContainer?'Historial':'Ver Historial');btn.addEventListener('click',(e)=>{e.stopPropagation();let vehicleName='';const card=node.closest('[class*="card"]')||node.closest('article')||node.parentElement;if(card){const titleEl=card.querySelector('h2, h3, h4, [class*="font-bold"], [class*="font-semibold"]');if(titleEl)vehicleName=titleEl.textContent.trim()}openModal();loadHistory(vehicleId,vehicleName)});targetContainer.appendChild(btn)}function scanAndInject(){document.querySelectorAll('[data-vehicle-id]').forEach(injectButton)}const observer=new MutationObserver((mutations)=>{let shouldScan=false;for(const mutation of mutations){for(const node of mutation.addedNodes){if(node.nodeType===Node.ELEMENT_NODE){if(node.matches&&node.matches('[data-vehicle-id]')){injectButton(node)}else if(node.querySelector&&node.querySelector('[data-vehicle-id]')){shouldScan=true}}}}if(shouldScan)scanAndInject()});observer.observe(document.body,{childList:true,subtree:true});if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',scanAndInject)}else{scanAndInject()}})();0:["YzL_gQOPCd8R7c-gE-W8S",[[["",{"children":["users",{"children":["__PAGE__",{}]}]},"$undefined","$undefined",true],["",{"children":["users",{"children":["__PAGE__",{},[["$L1",["$","$L2",null,{"props":{"params":{},"searchParams":{}},"Component":"$3"}],null],null],null]},[null,["$","$L4",null,{"parallelRouterKey":"children","segmentPath":["children","users","children"],"error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L5",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":"$undefined","notFoundStyles":"$undefined"}]],null]},[[[["$","link","0",{"rel":"stylesheet","href":"/_next/static/css/3c9639d6136089ec.css","precedence":"next","crossOrigin":"$undefined"}],["$","link","1",{"rel":"stylesheet","href":"/_next/static/css/8558c9c1d30cfc9c.css","precedence":"next","crossOrigin":"$undefined"}]],["$","html",null,{"lang":"en","suppressHydrationWarning":true,"children":[["$","head",null,{"children":["$","script",null,{"dangerouslySetInnerHTML":{"__html":"$6"}}]}],["$","body",null,{"className":"__variable_f367f3 __variable_3c557b antialiased","children":[["$","$L7",null,{"children":[["$","$L4",null,{"parallelRouterKey":"children","segmentPath":["children"],"error":"$undefined","errorStyles":"$undefined","errorScripts":"$undefined","template":["$","$L5",null,{}],"templateStyles":"$undefined","templateScripts":"$undefined","notFound":[["$","title",null,{"children":"404: This page could not be found."}],["$","div",null,{"style":{"fontFamily":"system-ui,\"Segoe UI\",Roboto,Helvetica,Arial,sans-serif,\"Apple Color Emoji\",\"Segoe UI Emoji\"","height":"100vh","textAlign":"center","display":"flex","flexDirection":"column","alignItems":"center","justifyContent":"center"},"children":["$","div",null,{"children":[["$","style",null,{"dangerouslySetInnerHTML":{"__html":"body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}"}}],["$","h1",null,{"className":"next-error-h1","style":{"display":"inline-block","margin":"0 20px 0 0","padding":"0 23px 0 0","fontSize":24,"fontWeight":500,"verticalAlign":"top","lineHeight":"49px"},"children":"404"}],["$","div",null,{"style":{"display":"inline-block"},"children":["$","h2",null,{"style":{"fontSize":14,"fontWeight":400,"lineHeight":"49px","margin":0},"children":"This page could not be found."}]}]]}]}]],"notFoundStyles":[]}],["$","$L8",null,{"position":"top-right","richColors":true}]]}],["$","script",null,{"dangerouslySetInnerHTML":{"__html":"$9"}}]]}]]}]],null],null],["$La",null]]]]
a:[["$","meta","0",{"name":"viewport","content":"width=device-width, initial-scale=1"}],["$","meta","1",{"charSet":"utf-8"}],["$","title","2",{"children":"Create Next App"}],["$","meta","3",{"name":"description","content":"Generated by create next app"}],["$","link","4",{"rel":"icon","href":"/favicon.ico","type":"image/x-icon","sizes":"16x16"}],["$","meta","5",{"name":"next-size-adjust"}]]
1:null
