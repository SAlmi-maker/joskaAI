// ============================================================
// RENVA - Dashboard Module
// ============================================================

const RENVA_DASHBOARD = (() => {

  // ── State ─────────────────────────────────────────────────
  let companySettings = null;
  let unsubscribeInvoices = null;
  let allInvoices = [];

  // ── Init ─────────────────────────────────────────────────
  async function init(user) {
    if (!user) return;
    renderUserInfo(user);
    await loadCompanySettings(user.uid);
    subscribeToInvoices(user.uid);
    initSidebar();
    initAnimations();
    wirePreviewClose();
  }

  // ── User Info ─────────────────────────────────────────────
  function renderUserInfo(user) {
    const name = companySettings?.companyName || '';
    const initials = name ? name.slice(0, 2).toUpperCase() : 'RV';
    document.querySelectorAll('.user-email').forEach(el => el.textContent = user.email);
    document.querySelectorAll('.user-avatar-text').forEach(el => el.textContent = initials);
  }

  // ── Company Settings ──────────────────────────────────────
  async function loadCompanySettings(uid) {
    try {
      const doc = await db.collection('users').doc(uid)
                          .collection('settings').doc('company').get();

      if (doc.exists) {
        companySettings = doc.data();
        applyCompanyBranding(companySettings);
        RENVA_I18N.setCurrency(companySettings.currency || 'MAD');
        hideSetupBanner();
      } else {
        showSetupBanner();
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    }
  }

  function setBrandSubtitle(name) {
    document.querySelectorAll('.company-name').forEach(el => {
      el.textContent = name || RENVA_I18N.t('brand.subtitle');
    });
  }

  function applyCompanyBranding(settings) {
    setBrandSubtitle(settings.companyName);

    if (settings.logoUrl) {
      const logoEls = document.querySelectorAll('.company-logo-img');
      logoEls.forEach(el => {
        el.src = settings.logoUrl;
        el.style.display = 'block';
      });
    }

    document.title = `${settings.companyName || 'RENVA'} — Dashboard`;
  }

  function showSetupBanner() {
    const banner = document.getElementById('setupBanner');
    if (banner) banner.style.display = 'flex';
  }

  function hideSetupBanner() {
    const banner = document.getElementById('setupBanner');
    if (banner) banner.style.display = 'none';
  }

  // ── Invoice Subscription ──────────────────────────────────
  function subscribeToInvoices(uid) {
    if (unsubscribeInvoices) unsubscribeInvoices();

    setStatsLoading(true);

    unsubscribeInvoices = db.collection('users').doc(uid)
      .collection('invoices')
      .orderBy('createdAt', 'desc')
      .onSnapshot(snapshot => {
        const invoices = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        allInvoices = invoices;
        renderStats(invoices);
        renderRecentInvoices(invoices.slice(0, 6));
        setStatsLoading(false);
      }, err => {
        console.error('Invoice subscription error:', err);
        setStatsLoading(false);
        renderEmptyStats();
      });
  }

  // ── Stats Calculation ─────────────────────────────────────
  function renderStats(invoices) {
    const now       = new Date();
    const todayStr  = now.toISOString().split('T')[0];
    const thisMonth = now.getMonth();
    const thisYear  = now.getFullYear();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

    const paidInvoices = invoices.filter(inv => inv.status === 'paid');

    const toNum = inv => parseFloat(inv.total || inv.amount || 0);

    // Today
    const todayRevenue = paidInvoices
      .filter(inv => (inv.paidAt || inv.createdAt?.toDate?.()?.toISOString() || '').startsWith(todayStr))
      .reduce((sum, inv) => sum + toNum(inv), 0);

    // This month
    const thisMonthRevenue = paidInvoices
      .filter(inv => {
        const d = getInvoiceDate(inv);
        return d && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      })
      .reduce((sum, inv) => sum + toNum(inv), 0);

    // Last month (for trend)
    const lastMonthRevenue = paidInvoices
      .filter(inv => {
        const d = getInvoiceDate(inv);
        return d && d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
      })
      .reduce((sum, inv) => sum + toNum(inv), 0);

    // This year
    const thisYearRevenue = paidInvoices
      .filter(inv => {
        const d = getInvoiceDate(inv);
        return d && d.getFullYear() === thisYear;
      })
      .reduce((sum, inv) => sum + toNum(inv), 0);

    // Last year
    const lastYearRevenue = paidInvoices
      .filter(inv => {
        const d = getInvoiceDate(inv);
        return d && d.getFullYear() === thisYear - 1;
      })
      .reduce((sum, inv) => sum + toNum(inv), 0);

    // Invoice counts
    const totalInvoices     = invoices.length;
    const thisMonthInvoices = invoices.filter(inv => {
      const d = getInvoiceDate(inv);
      return d && d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    }).length;

    const currency = RENVA_I18N.t('common.currency');

    // Set values
    setStatCard('statToday',      formatCurrency(todayRevenue, currency), null, null);
    setStatCard('statMonth',      formatCurrency(thisMonthRevenue, currency), lastMonthRevenue, thisMonthRevenue, RENVA_I18N.t('dash.vsLastMonth'));
    setStatCard('statYear',       formatCurrency(thisYearRevenue, currency), lastYearRevenue, thisYearRevenue, RENVA_I18N.t('dash.vsLastYear'));
    setStatCard('statInvoices',   totalInvoices, null, null, `${thisMonthInvoices} ${RENVA_I18N.t('dash.invoicesThisMonth')}`);
  }

  function getInvoiceDate(inv) {
    if (inv.startDate)         return new Date(inv.startDate);
    if (inv.createdAt?.toDate) return inv.createdAt.toDate();
    if (inv.date)              return new Date(inv.date);
    return null;
  }

  function setStatCard(id, value, prev, curr, subtitle) {
    const card = document.getElementById(id);
    if (!card) return;

    const valEl  = card.querySelector('.stat-value');
    const subEl  = card.querySelector('.stat-subtitle');
    const trendEl = card.querySelector('.stat-trend');

    if (valEl) {
      valEl.textContent = value;
      animateCount(valEl);
    }
    if (subEl && subtitle) subEl.textContent = subtitle;

    if (trendEl && prev !== null && curr !== null) {
      const diff = prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev * 100);
      const sign = diff >= 0 ? '+' : '';
      const cls  = diff >= 0 ? 'up' : 'down';
      const icon = diff >= 0 ? '↑' : '↓';
      trendEl.textContent = `${icon} ${sign}${diff.toFixed(1)}%`;
      trendEl.className   = `stat-trend ${cls}`;
    }
  }

  function renderEmptyStats() {
    const currency = RENVA_I18N.t('common.currency');
    ['statToday','statMonth','statYear'].forEach(id => {
      const card = document.getElementById(id);
      if (!card) return;
      const v = card.querySelector('.stat-value');
      if (v) v.textContent = formatCurrency(0, currency);
    });
    const si = document.getElementById('statInvoices');
    if (si) { const v = si.querySelector('.stat-value'); if (v) v.textContent = '0'; }
  }

  function setStatsLoading(state) {
    document.querySelectorAll('.stat-card').forEach(card => {
      card.classList.toggle('skeleton', state);
    });
  }

  // ── Recent Invoices Table ─────────────────────────────────
  function renderRecentInvoices(invoices) {
    const tbody = document.getElementById('recentInvoicesBody');
    const empty = document.getElementById('recentEmpty');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!invoices.length) {
      if (empty) empty.style.display = 'block';
      return;
    }
    if (empty) empty.style.display = 'none';

    const currency = RENVA_I18N.t('common.currency');

    invoices.forEach((inv, i) => {
      const tr = document.createElement('tr');
      tr.style.animationDelay = `${i * 50}ms`;
      tr.classList.add('fade-in-row');

      const date = getInvoiceDate(inv);
      const dateStr = date ? date.toLocaleDateString(RENVA_I18N.getLang()) : '—';
      const statusLabel = RENVA_I18N.t(`dash.${inv.status || 'draft'}`);
      const statusCls   = `badge badge-${inv.status || 'draft'}`;

      tr.innerHTML = `
        <td><span class="invoice-num">#${inv.invoiceNumber || inv.id.slice(-6).toUpperCase()}</span></td>
        <td>${escHtml(inv.clientName || '—')}</td>
        <td>${dateStr}</td>
        <td><span class="amount">${formatCurrency(parseFloat(inv.total || inv.amount || 0), currency)}</span></td>
        <td><span class="${statusCls}">${statusLabel}</span></td>
        <td>
          <div class="row-actions">
            <button class="btn-icon" title="View" onclick="RENVA_DASHBOARD.viewInvoice('${inv.id}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </td>`;

      tbody.appendChild(tr);
    });
  }

  function lockScroll() { const y=window.scrollY; document.body.dataset.sy=y; document.documentElement.style.overflow='hidden'; document.body.style.position='fixed'; document.body.style.top=`-${y}px`; document.body.style.left='0'; document.body.style.right='0'; }
  function unlockScroll() { const y=parseInt(document.body.dataset.sy||'0'); document.documentElement.style.overflow=''; document.body.style.position=''; document.body.style.top=''; document.body.style.left=''; document.body.style.right=''; window.scrollTo(0,y); delete document.body.dataset.sy; }

  function viewInvoice(id) {
    const inv = allInvoices.find(i => i.id === id);
    if (!inv) return;
    populateDashboardPreview(inv);
    document.getElementById('dashPreviewBackdrop')?.classList.add('open');
    document.getElementById('invPreviewWrap')?.classList.add('open');
    lockScroll();
  }

  function closePreview() {
    document.getElementById('dashPreviewBackdrop')?.classList.remove('open');
    document.getElementById('invPreviewWrap')?.classList.remove('open');
    unlockScroll();
  }

  function wirePreviewClose() {
    document.getElementById('previewCloseBtn')?.addEventListener('click', closePreview);
    document.getElementById('dashPreviewBackdrop')?.addEventListener('click', e => {
      if (e.target === document.getElementById('dashPreviewBackdrop')) closePreview();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closePreview();
    });
  }

  function populateDashboardPreview(inv) {
    const emptyEl = document.getElementById('invPreviewEmpty');
    if (emptyEl) emptyEl.classList.add('hidden');

    const cs = companySettings || {};
    const invLang = cs.invoiceLanguage || '';
    const t = invLang && invLang !== RENVA_I18N.getLang()
      ? (key) => RENVA_I18N.tLang(key, invLang)
      : RENVA_I18N.t;
    const currency = RENVA_I18N.t('common.currency');
    const fmtNum = (n) => {
      if (isNaN(n)) n = 0;
      return new Intl.NumberFormat(invLang || RENVA_I18N.getLang(), {
        minimumFractionDigits: 0, maximumFractionDigits: 2
      }).format(n);
    };
    const fmt = (n) => (invLang === 'ar' || RENVA_I18N.getLang() === 'ar' ? '\u200E' : '') + fmtNum(n) + ' ' + currency;
    const startDate = inv.startDate || '';
    const endDate = inv.endDate || '';
    let days = inv.days;
    if (days === undefined && startDate && endDate) {
      const d1 = new Date(startDate);
      const d2 = new Date(endDate);
      days = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1);
    }
    days = days || 0;
    const dp = parseFloat(inv.dailyPrice || 0);
    const rental = days * dp;
    const total = parseFloat(inv.total || 0);
    const status = inv.status || 'draft';

    const extras = [
      { label: t('inv.field.insurance'), val: parseFloat(inv.insurance || 0) },
      { label: t('inv.field.fuel'), val: parseFloat(inv.fuel || 0) },
      { label: t('inv.field.extraDriver'), val: parseFloat(inv.extraDriver || 0) },
      { label: t('inv.field.other'), val: parseFloat(inv.other || 0) },
    ].filter(e => e.val > 0);

    const colorMode = cs.invoiceColorMode || 'bw';
    const accentHex = colorMode === 'bw' ? '#1e293b' : (cs.invoiceColor || '#2563EB');
    const invoiceEl = document.getElementById('ip_invoicePreview');
    if (invoiceEl) {
      invoiceEl.setAttribute('dir', invLang === 'ar' ? 'rtl' : 'ltr');
      invoiceEl.style.setProperty('--ip-primary', accentHex);
    }

    const logoEl = document.getElementById('preview_logo');
    if (cs.logoBase64 && logoEl) {
      logoEl.src = cs.logoBase64;
      logoEl.style.display = 'block';
    } else if (logoEl) {
      logoEl.style.display = 'none';
    }

    s('preview_companyName', cs.companyName || 'RENVA');
    s('preview_companyAddr', cs.address || '');
    s('preview_companyEmail', cs.email || '');
    s('preview_companyPhone', cs.phone || '');
    s('preview_companyWebsite', cs.website || '');
    s('preview_title', t('pdf.invoice'));
    s('preview_invNumber', `#${inv.invoiceNumber || inv.id?.slice(-6) || '—'}`);
    s('preview_issueLabel', t('pdf.issue'));
    s('preview_issueDate', startDate || '—');
    s('preview_dueLabel', t('pdf.due'));
    s('preview_dueDate', endDate || '—');
    s('preview_billToLabel', t('pdf.billTo'));
    s('preview_clientName', inv.clientName || '—');
    s('preview_clientCIN', inv.cin ? `${t('pdf.cin')}: ${inv.cin}` : '');
    s('preview_clientPhone', inv.phone ? `${t('pdf.tel')}: ${inv.phone}` : '');
    s('preview_clientVehicle', `${inv.vehicleBrand || ''} ${inv.vehicleModel || ''}`.trim() || '');
    s('preview_clientPlate', inv.plate ? `${t('pdf.plate')}: ${inv.plate}` : '');
    s('preview_descLabel', t('pdf.description'));
    s('preview_qtyLabel', t('pdf.qty'));
    s('preview_unitLabel', t('pdf.ratePerDay'));
    s('preview_amtLabel', t('pdf.amount'));

    const tbody = document.getElementById('preview_itemsBody');
    if (tbody) {
      tbody.innerHTML = '';
      const dash = '—';
      const addRow = (desc, daysVal, unit, amt) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${escHtml(desc)}</td><td>${daysVal}</td><td>${typeof unit === 'number' ? fmt(unit) : unit}</td><td>${fmt(amt)}</td>`;
        tbody.appendChild(tr);
      };
      addRow(`${t('inv.field.rentalSubtotal')} (${inv.vehicleBrand || ''} ${inv.vehicleModel || ''})`, days, dp, rental);
      extras.forEach(e => addRow(e.label, dash, dash, e.val));
    }

    s('preview_grandLabel', t('pdf.grandTotal'));
    s('preview_grandTotal', fmt(total));

    const statusLabel = document.getElementById('preview_statusLabel');
    if (statusLabel) statusLabel.textContent = t('pdf.status');

    const badge = document.getElementById('preview_status');
    if (badge) {
      badge.textContent = t('dash.' + status);
      badge.className = 'ip-status-badge ip-status-' + status;
    }

    const notesWrap = document.getElementById('preview_notesWrap');
    if (inv.notes) {
      s('preview_notesLabel', t('pdf.notes'));
      s('preview_notes', inv.notes);
      if (notesWrap) notesWrap.style.display = 'block';
    } else if (notesWrap) {
      notesWrap.style.display = 'none';
    }
  }

  // ── Theme Toggle ─────────────────────────────────────────
  // ── Sidebar ───────────────────────────────────────────────
  function initSidebar() {
    const hamburger = document.getElementById('hamburger');
    const sidebar   = document.getElementById('sidebar');
    const overlay   = document.getElementById('sidebarOverlay');

    if (hamburger && sidebar) {
      hamburger.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay?.classList.toggle('show');
      });
    }
    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
      });
    }
  }

  // ── Animations ────────────────────────────────────────────
  function initAnimations() {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.stat-card, .glass-card').forEach(el => observer.observe(el));
  }

  function animateCount(el) {
    el.classList.remove('count-animate');
    void el.offsetWidth; // reflow
    el.classList.add('count-animate');
  }

  // ── Helpers ───────────────────────────────────────────────
  function s(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function formatCurrency(amount, currency) {
    if (isNaN(amount)) amount = 0;
    const lang = RENVA_I18N.getLang();
    const num = new Intl.NumberFormat(lang, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount);
    return (lang === 'ar' ? '\u200E' : '') + num + ' ' + currency;
  }

  function escHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { init, viewInvoice };
})();


// ── Boot ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  RENVA_I18N.init();
  RENVA_AUTH.init();

  document.addEventListener('RENVA:authReady', ({ detail }) => {
    if (detail.user) RENVA_DASHBOARD.init(detail.user);
  });

  document.addEventListener('RENVA:langChanged', () => {
    // Re-render dynamic content when language changes
    const user = RENVA_AUTH.currentUser();
    if (user) RENVA_DASHBOARD.init(user);
  });
});
