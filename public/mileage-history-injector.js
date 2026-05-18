(function() {
  'use strict';
  if (window.__mhInjectorLoaded) return;
  window.__mhInjectorLoaded = true;

  function fmt(n) {
    var num = Number(n);
    return isNaN(num) ? '-' : num.toLocaleString('es-PA', { minimumFractionDigits: num % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 });
  }

  function fmtDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('es-PA', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function fmtTime(d) {
    if (!d) return '-';
    return new Date(d).toLocaleTimeString('es-PA', { hour: '2-digit', minute: '2-digit' });
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getVehicleId() {
    var el = document.querySelector('[data-vehicle-id]');
    if (el && el.dataset.vehicleId) return el.dataset.vehicleId;
    var m = window.location.pathname.match(/\/fleet(?:\/details)?\/([^\/]+)/);
    return m ? m[1] : null;
  }

  function getVehicleName() {
    var h1 = document.querySelector('h1');
    if (h1) return h1.textContent.trim();
    var strong = document.querySelector('strong, .font-bold, .font-semibold');
    if (strong) return strong.textContent.trim();
    return '';
  }

  var historyIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-5 w-5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12"/><path d="M3 3v9h9"/></svg>';
  var userIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3 w-3"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  var emptyIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-10 w-10 mx-auto mb-3 opacity-50"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 12"/><path d="M3 3v9h9"/></svg>';

  async function showHistory(vehicleId, vehicleName) {
    if (!vehicleId) {
      alert('No se pudo determinar el ID del vehículo.');
      return;
    }
    var modalId = 'mh-modal-' + vehicleId;
    var existing = document.getElementById(modalId);
    if (existing) { existing.remove(); return; }

    var overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4';
    overlay.innerHTML =
      '<div class="mileage-history-backdrop fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity opacity-0"></div>' +
      '<div class="fixed inset-0 flex items-center justify-center p-4">' +
        '<div class="mileage-history-content bg-background border rounded-lg shadow-lg w-full max-w-[550px] max-h-[80vh] overflow-hidden transform scale-95 opacity-0 transition-all duration-200 flex flex-col">' +
          '<div class="px-6 py-4 border-b flex items-center justify-between">' +
            '<div>' +
              '<h2 class="text-lg font-semibold flex items-center gap-2">' + historyIconSvg + 'Historial de Kilometraje</h2>' +
              '<p class="text-sm text-muted-foreground mt-1">Registro de todos los cambios de kilometraje' + (vehicleName ? ' para ' + escapeHtml(vehicleName) : '') + '</p>' +
            '</div>' +
            '<button aria-label="Cerrar" class="mileage-history-close inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 w-8 p-0">&times;</button>' +
          '</div>' +
          '<div id="mh-body-' + vehicleId + '" class="p-6 overflow-y-auto flex-1">' +
            '<div class="flex items-center justify-center py-8">' +
              '<svg class="animate-spin h-6 w-6 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>' +
              '<span class="ml-2 text-sm text-muted-foreground">Cargando historial...</span>' +
            '</div>' +
          '</div>' +
          '<div class="px-6 py-4 border-t flex justify-end">' +
            '<button class="mileage-history-close-btn inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">Cerrar</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    var backdrop = overlay.querySelector('.mileage-history-backdrop');
    var content = overlay.querySelector('.mileage-history-content');

    function openModal() {
      void overlay.offsetWidth;
      backdrop.classList.remove('opacity-0');
      content.classList.remove('scale-95', 'opacity-0');
      document.body.style.overflow = 'hidden';
    }

    function closeModal() {
      backdrop.classList.add('opacity-0');
      content.classList.add('scale-95', 'opacity-0');
      setTimeout(function() {
        overlay.remove();
        document.body.style.overflow = '';
      }, 200);
    }

    overlay.querySelectorAll('.mileage-history-close, .mileage-history-close-btn').forEach(function(btn) {
      btn.addEventListener('click', closeModal);
    });
    overlay.querySelector('.mileage-history-backdrop').addEventListener('click', function(e) {
      if (e.target === backdrop) closeModal();
    });

    openModal();

    try {
      var res = await fetch('/api/fleet/' + vehicleId + '/mileage-history');
      var json = await res.json();
      var rows = Array.isArray(json.data) ? json.data : [];
      var body = document.getElementById('mh-body-' + vehicleId);
      if (!body) return;

      if (rows.length === 0) {
        body.innerHTML =
          '<div class="text-center py-8 text-muted-foreground">' +
            emptyIconSvg +
            '<p class="text-sm">No hay registros de cambios de kilometraje aún.</p>' +
            '<p class="text-xs mt-1">Los cambios se guardarán automáticamente cada vez que actualices el kilometraje.</p>' +
          '</div>';
        return;
      }

      var html = '<div class="space-y-3">';
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        var prev = Number(r.previousMileage != null ? r.previousMileage : 0);
        var next = Number(r.newMileage != null ? r.newMileage : 0);
        var diff = next - prev;
        var diffBadge = '';
        if (diff > 0) {
          diffBadge = '<span class="text-xs font-medium text-green-600 bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded">+' + fmt(diff) + ' km</span>';
        } else if (diff === 0) {
          diffBadge = '<span class="text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Sin cambio</span>';
        }
        var createdBy = r.createdByName ?
          '<span>•</span><span class="flex items-center gap-1">' + userIconSvg + escapeHtml(r.createdByName) + '</span>' : '';
        var notes = r.notes ? '<p class="text-xs text-muted-foreground mt-1 italic">' + escapeHtml(r.notes) + '</p>' : '';
        var lastBadge = i === 0 ?
          '<span class="text-[10px] font-semibold uppercase tracking-wide text-primary bg-primary/10 px-2 py-1 rounded-full shrink-0 ml-2">Último</span>' : '';

        html +=
          '<div class="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">' +
            '<div class="flex-1 min-w-0">' +
              '<div class="flex items-center gap-2 flex-wrap">' +
                '<span class="text-sm font-medium">' + fmt(prev) + ' km</span>' +
                '<span class="text-xs text-muted-foreground">→</span>' +
                '<span class="text-sm font-bold text-primary">' + fmt(next) + ' km</span>' +
                diffBadge +
              '</div>' +
              '<div class="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground flex-wrap">' +
                '<span>' + fmtDate(r.createdAt) + '</span>' +
                '<span>•</span>' +
                '<span>' + fmtTime(r.createdAt) + '</span>' +
                createdBy +
              '</div>' +
              notes +
            '</div>' +
            lastBadge +
          '</div>';
      }
      html += '</div>';
      body.innerHTML = html;
    } catch (e) {
      var body = document.getElementById('mh-body-' + vehicleId);
      if (body) {
        body.innerHTML = '<div class="text-center py-8 text-muted-foreground"><p class="text-sm text-red-600">Error cargando historial.</p></div>';
      }
    }
  }

  function hasButton(container, text) {
    for (var i = 0; i < container.children.length; i++) {
      if (container.children[i].textContent.trim() === text) return true;
    }
    return false;
  }

  function createHistoryButton(vehicleId, vehicleName) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 px-3';
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span>Ver Historial</span>';
    btn.addEventListener('click', function(e) { e.stopPropagation(); showHistory(vehicleId, vehicleName); });
    return btn;
  }

  function injectIntoEstados() {
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
    var node;
    while ((node = walker.nextNode())) {
      if (node.textContent.indexOf('Estados del Vehículo') === -1 && node.textContent.indexOf('Estados del Veh\xedculo') === -1) continue;
      var titleEl = node.parentElement;
      if (!titleEl) continue;
      var header = titleEl;
      var depth = 0;
      while (header && depth < 6) {
        var cls = header.className || '';
        if (typeof cls === 'string' && cls.indexOf('justify-between') !== -1) break;
        header = header.parentElement;
        depth++;
      }
      if (!header || depth >= 6) continue;
      if (hasButton(header, 'Ver Historial')) continue;

      var vehicleId = getVehicleId();
      if (!vehicleId) continue;

      var vehicleName = getVehicleName();
      var btn = createHistoryButton(vehicleId, vehicleName);
      header.appendChild(btn);
    }
  }

  function injectIntoMileageCounter() {
    var nodes = document.querySelectorAll('[data-vehicle-id]');
    for (var i = 0; i < nodes.length; i++) {
      var container = nodes[i];
      var vid = container.dataset.vehicleId;
      if (!vid) continue;

      var candidates = Array.from(container.children);
      var btnContainer = null;
      for (var j = 0; j < candidates.length; j++) {
        var c = candidates[j];
        var cls = c.className || '';
        if (typeof cls === 'string' && (cls.indexOf('flex items-center gap-1') !== -1 || cls.indexOf('flex gap-2 pt-1') !== -1 || cls.indexOf('flex gap-2') !== -1)) {
          btnContainer = c;
          break;
        }
      }
      if (!btnContainer) continue;
      if (hasButton(btnContainer, 'Ver Historial')) continue;

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'inline-flex items-center justify-center rounded-md text-xs font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-6 px-2 shadow-sm transition-colors';
      btn.textContent = 'Ver Historial';
      btn.addEventListener('click', function(e) { e.stopPropagation(); showHistory(vid, container.dataset.vehicleName || ''); });
      btnContainer.appendChild(btn);
    }
  }

  function scan() {
    injectIntoEstados();
    injectIntoMileageCounter();
  }

  var observer = new MutationObserver(function() {
    scan();
  });

  function start() {
    if (!document.body) {
      setTimeout(start, 50);
      return;
    }
    observer.observe(document.body, { childList: true, subtree: true });
    scan();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
