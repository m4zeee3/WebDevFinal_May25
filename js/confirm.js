/* =============================================
   Roots – Confirm Modal Utility
   showConfirm({ title, message, confirmLabel, cancelLabel, type, onConfirm, onCancel })
   types: 'danger' | 'warning' | 'logout' | 'save' | 'info'
   ============================================= */
(function () {
  function inject() {
    if (document.getElementById('ccOverlay')) return;
    const el = document.createElement('div');
    el.id = 'ccOverlay';
    el.className = 'cc-overlay';
    el.innerHTML = `
      <div class="cc-modal">
        <div class="cc-icon" id="ccIcon"></div>
        <h3 class="cc-title" id="ccTitle"></h3>
        <p class="cc-msg"   id="ccMsg"></p>
        <div class="cc-actions">
          <button class="btn btn-secondary" id="ccCancelBtn">Cancel</button>
          <button class="btn btn-danger"    id="ccOkBtn">Confirm</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) dismiss(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') dismiss(); });
  }

  function dismiss() {
    const el = document.getElementById('ccOverlay');
    if (el) el.classList.remove('active');
  }

  window.showConfirm = function ({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', type = 'danger', onConfirm, onCancel }) {
    inject();

    const iconMap = {
      danger:  '<i class="fa-solid fa-triangle-exclamation"></i>',
      warning: '<i class="fa-solid fa-circle-exclamation"></i>',
      logout:  '<i class="fa-solid fa-right-from-bracket"></i>',
      save:    '<i class="fa-solid fa-floppy-disk"></i>',
      info:    '<i class="fa-solid fa-circle-info"></i>',
    };
    const btnClassMap = {
      danger:  'btn-danger',
      warning: 'btn-warning',
      logout:  'btn-danger',
      save:    'btn-primary',
      info:    'btn-primary',
    };

    document.getElementById('ccIcon').innerHTML = iconMap[type] || iconMap.danger;
    document.getElementById('ccIcon').className = `cc-icon cc-icon-${type}`;
    document.getElementById('ccTitle').textContent = title;
    document.getElementById('ccMsg').textContent   = message;

    // Rebuild buttons to clear old event listeners
    ['ccCancelBtn', 'ccOkBtn'].forEach(id => {
      const old = document.getElementById(id);
      const neu = old.cloneNode(false);
      neu.id = id;
      old.parentNode.replaceChild(neu, old);
    });

    const cancelBtn  = document.getElementById('ccCancelBtn');
    const confirmBtn = document.getElementById('ccOkBtn');

    cancelBtn.className   = 'btn btn-secondary';
    cancelBtn.textContent = cancelLabel;
    cancelBtn.addEventListener('click', () => { dismiss(); if (onCancel) onCancel(); });

    confirmBtn.className   = `btn ${btnClassMap[type] || 'btn-danger'}`;
    confirmBtn.textContent = confirmLabel;
    confirmBtn.addEventListener('click', () => { dismiss(); if (onConfirm) onConfirm(); });

    document.getElementById('ccOverlay').classList.add('active');
    confirmBtn.focus();
  };
})();
