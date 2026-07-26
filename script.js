/* ================================================================
   KONFIGURASI
================================================================ */
var LOGO_URL = 'https://z-cdn-media.chatglm.cn/files/50ca2c37-9a98-4c90-923b-ae99959846b9.png?auth_key=1876671393-5447ef07c70045b48cce9108e1c0bf25-0-4f77a9446e7fe2d91efdbbfa00385980';
var WA_NUMBER = '62817776175';
var TAKEAWAY_FEE = 3000;

/* Kategori makanan berat — kena biaya takeaway Rp 3.000/pcs */
var MAKANAN_BERAT = ['paket-bubur', 'bubur', 'mie-kecil', 'mie-lebar', 'mie-yamin', 'kwetiau', 'bihun', 'baso', 'nasi-uduk'];

var CAT_SWITCH_MAP = {
    bubur: ['bubur'],
    mieKecil: ['mie-kecil'],
    mieLebar: ['mie-lebar'],
    mieYamin: ['mie-yamin'],
    kwetiau: ['kwetiau'],
    bihun: ['bihun'],
    baso: ['baso'],
    nasiUduk: ['nasi-uduk']
};

var firebaseConfig = {
    apiKey: "AIzaSyCj__JH5w__RdSEqtR59Cr7ctEOyl6lzUg",
    authDomain: "buburgrace.firebaseapp.com",
    databaseURL: "https://buburgrace-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "buburgrace"
};

/* ================================================================
   STATE
================================================================ */
var cart = [];
var db = null;
var storeIsOpen = true;
var currentStoreMode = 'auto';
var stockData = {};
var weekendStockData = {};
var categorySwitches = {
    bubur: true,
    mieKecil: true,
    mieLebar: true,
    mieYamin: true,
    kwetiau: true,
    bihun: true,
    baso: true,
    nasiUduk: true
};
var scheduleData = null;
var pendingVariantCard = null;
var selectedVariant = '';
var activeFilter = 'all';

/* ================================================================
   UTILITY
================================================================ */
function fmtRp(n) {
    return 'Rp ' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function showToast(msg, isError) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.className = (isError ? 'error ' : '') + 'show';
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.className = ''; }, 2500);
}

function parseTime(str) {
    if (!str || str.indexOf(':') === -1) return null;
    var p = str.split(':');
    return parseInt(p[0]) * 60 + parseInt(p[1]);
}

function getTodayDay() { return new Date().getDay(); }
function isWeekendNow() { var d = getTodayDay(); return d === 0 || d === 6; }

function isMakananBerat(category, isTopping) {
    if (isTopping) return false;
    return MAKANAN_BERAT.indexOf(category) !== -1;
}

/* ================================================================
   FILTER KATEGORI
================================================================ */
function filterCat(catId) {
    activeFilter = catId;
    document.querySelectorAll('.cat-pill').forEach(function (p) {
        p.classList.toggle('active', p.getAttribute('data-target') === catId);
    });
    document.querySelectorAll('.section-header').forEach(function (sh) {
        if (catId === 'all') { sh.classList.remove('hidden'); return; }
        sh.classList.toggle('hidden', sh.getAttribute('data-category') !== catId);
    });
    document.querySelectorAll('.menu-grid').forEach(function (grid) {
        var gridCat = grid.previousElementSibling ? grid.previousElementSibling.getAttribute('data-category') : null;
        if (catId === 'all') { grid.style.display = ''; return; }
        grid.style.display = (gridCat === catId) ? '' : 'none';
    });
}

/* ================================================================
   SEARCH
================================================================ */
document.getElementById('searchInput').addEventListener('input', function () {
    var kw = this.value.toLowerCase().trim();
   document.getElementById('clearSearchBtn').style.display = kw ? 'flex' : 'none';

    document.querySelectorAll('.menu-grid').forEach(function (grid) {
        var sectionHeader = grid.previousElementSibling;
        var hasMatch = false;

        grid.querySelectorAll('.menu-card').forEach(function (card) {
            var title = card.querySelector('.card-title');
            var name = title ? title.textContent.toLowerCase() : '';
            var match = (!kw || name.indexOf(kw) !== -1);
            card.style.display = match ? '' : 'none';
            if (match) hasMatch = true;
        });

        if (kw) {
            grid.style.display = hasMatch ? '' : 'none';
            if (sectionHeader && sectionHeader.classList.contains('section-header')) {
                sectionHeader.classList.toggle('hidden', !hasMatch);
            }
        } else {
            grid.style.display = '';
            if (sectionHeader && sectionHeader.classList.contains('section-header')) {
                sectionHeader.classList.remove('hidden');
            }
        }
    });

    if (!kw && activeFilter !== 'all') filterCat(activeFilter);
});

document.getElementById('clearSearchBtn').addEventListener('click', function () {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchInput').focus();
    this.style.display = 'none';
    document.querySelectorAll('.menu-card').forEach(function (card) { card.style.display = ''; });
    document.querySelectorAll('.menu-grid').forEach(function (grid) { grid.style.display = ''; });
    document.querySelectorAll('.section-header').forEach(function (sh) { sh.classList.remove('hidden'); });
    if (activeFilter !== 'all') filterCat(activeFilter);
});

/* ================================================================
   IMAGE ZOOM
================================================================ */
document.addEventListener('click', function (e) {
    var wrapper = e.target.closest('.card-img-wrapper');
    if (wrapper) {
        var img = wrapper.querySelector('img');
        if (img) {
            document.getElementById('zoomedImg').src = img.src;
            document.getElementById('imageModal').classList.add('active');
        }
        return;
    }
});

document.getElementById('closeImageZoom').addEventListener('click', function () {
    document.getElementById('imageModal').classList.remove('active');
});

document.getElementById('imageModal').addEventListener('click', function (e) {
    if (e.target === this) this.classList.remove('active');
});

/* ================================================================
   VARIANT MODAL
================================================================ */
document.addEventListener('click', function (e) {
    var btn = e.target.closest('.add-btn');
    if (!btn) return;
    var card = btn.closest('.menu-card');
    if (!card) return;
    if (!storeIsOpen) { showToast('Maaf, toko sedang tutup.', true); return; }
    if (card.classList.contains('stock-empty') || card.classList.contains('weekend-locked') || card.classList.contains('cat-disabled')) return;

    var hasVariants = card.getAttribute('data-has-variants') === 'true';
    if (hasVariants) {
        pendingVariantCard = card;
        openVariantModal(card);
    } else {
        addToCart(card, '');
    }
});

function openVariantModal(card) {
    var name = card.querySelector('.card-title').textContent;
    var variantName = card.getAttribute('data-variant-name') || 'Variant';
    var options = (card.getAttribute('data-options') || '').split(',');

    document.getElementById('variantTitle').textContent = 'Pilih ' + variantName;
    var html = '';
    options.forEach(function (opt, i) {
        html += '<label class="variant-option-label' + (i === 0 ? ' selected' : '') + '" data-value="' + opt.trim() + '">';
        html += '<input type="radio" name="variant" value="' + opt.trim() + '"' + (i === 0 ? ' checked' : '') + '>';
        html += '<div class="radio-circle"></div>';
        html += '<span>' + opt.trim() + '</span></label>';
    });
    document.getElementById('variantOptions').innerHTML = html;
    selectedVariant = options[0].trim();

    document.querySelectorAll('.variant-option-label').forEach(function (label) {
        label.addEventListener('click', function () {
            document.querySelectorAll('.variant-option-label').forEach(function (l) { l.classList.remove('selected'); });
            this.classList.add('selected');
            this.querySelector('input').checked = true;
            selectedVariant = this.getAttribute('data-value');
        });
    });

    document.getElementById('variantModal').classList.add('active');
}

document.getElementById('btnConfirmVariant').addEventListener('click', function () {
    if (pendingVariantCard) {
        addToCart(pendingVariantCard, selectedVariant);
        pendingVariantCard = null;
        selectedVariant = '';
    }
    document.getElementById('variantModal').classList.remove('active');
});

document.getElementById('variantModal').addEventListener('click', function (e) {
    if (e.target === this) this.classList.remove('active');
});

/* ================================================================
   CART LOGIC
================================================================ */
function addToCart(card, variant) {
    var name = card.querySelector('.card-title').textContent;
    var price = parseInt(card.getAttribute('data-price')) || 0;
    var category = card.getAttribute('data-category') || '';
    var isTopping = card.getAttribute('data-topping') === 'true';

    var existIdx = -1;
    for (var i = 0; i < cart.length; i++) {
        if (cart[i].name === name && cart[i].variant === variant) { existIdx = i; break; }
    }

    if (existIdx >= 0) {
        cart[existIdx].qty++;
    } else {
        cart.push({
            name: name,
            price: price,
            category: category,
            isTopping: isTopping,
            qty: 1,
            note: '',
            status: 'dine',
            variant: variant
        });
    }
    updateCartBadge();
    showToast(name + ' ditambahkan');
}

function updateCartBadge() {
    var total = 0;
    cart.forEach(function (c) { total += c.qty; });
    var badge = document.getElementById('cartBadge');
    if (total > 0) {
        badge.style.display = 'flex';
        badge.textContent = total;
        badge.classList.add('pulse');
        setTimeout(function () { badge.classList.remove('pulse'); }, 200);
    } else {
        badge.style.display = 'none';
    }
}

/* ================================================================
   RENDER CART
================================================================ */
function renderCart() {
    var container = document.getElementById('cartItems');
    var formFields = document.getElementById('checkoutFormFields');
    var stickyBar = document.getElementById('stickyCheckoutBar');
    var headerCount = document.getElementById('cartHeaderCount');
    var scrollHint = document.getElementById('cartScrollHint');

    if (cart.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:30px;color:#ccc;"><i class="fa-solid fa-bag-shopping" style="font-size:2rem;margin-bottom:10px;display:block;"></i>Keranjang kosong</div>';
        formFields.style.display = 'none';
        stickyBar.style.display = 'none';
        if (headerCount) headerCount.style.display = 'none';
        if (scrollHint) scrollHint.style.display = 'none';
        updateCartScrollUI();
        return;
    }

    formFields.style.display = '';
    stickyBar.style.display = '';
    var html = '';
    var totalQty = 0;

    cart.forEach(function (item, idx) {
        totalQty += item.qty;
        var heavy = isMakananBerat(item.category, item.isTopping);
        var isAway = item.status === 'away';
        var displayName = item.name + (item.variant ? ' (' + item.variant + ')' : '');

        html += '<div class="cart-item">';
        html += '<div class="cart-item-row1">';
        html += '<div class="item-info"><div class="item-title">' + displayName + '</div>';
        html += '<div class="item-price-row">' + fmtRp(item.price) + '/pcs</div></div>';
        html += '<div class="status-toggle-area">';
        html += '<span class="item-status-badge ' + (isAway ? 'badge-away' : 'badge-dine') + '" data-idx="' + idx + '">';
        html += '<i class="fa-solid ' + (isAway ? 'fa-bag-shopping' : 'fa-utensils') + '"></i> ';
        html += (isAway ? 'Take Away' : 'Dine In');
        html += ' <i class="fa-solid fa-repeat swap-icon"></i>';
        html += '</span>';
        if (isAway && heavy) {
            html += '<span class="takeaway-fee-tag">+' + fmtRp(TAKEAWAY_FEE) + '</span>';
        }
        html += '<span class="tap-hint">ketuk untuk ubah</span>';
        html += '</div>';
        html += '</div>';
        html += '<div class="cart-item-row2">';
        html += '<div class="item-controls">';
        html += '<button class="qty-btn" data-idx="' + idx + '" data-delta="-1"><i class="fa-solid fa-minus"></i></button>';
        html += '<span class="qty-num">' + item.qty + '</span>';
        html += '<button class="qty-btn" data-idx="' + idx + '" data-delta="1"><i class="fa-solid fa-plus"></i></button>';
        html += '</div>';
        html += '<input type="text" class="item-note-input" data-idx="' + idx + '" placeholder="Catatan..." value="' + (item.note || '').replace(/"/g, '&quot;') + '">';
        html += '</div>';
        html += '</div>';
    });

    container.innerHTML = html;

    if (headerCount) {
        headerCount.textContent = totalQty + ' item';
        headerCount.style.display = 'inline-block';
    }

    container.querySelectorAll('.item-status-badge').forEach(function (b) {
        b.addEventListener('click', function () {
            var idx = parseInt(this.getAttribute('data-idx'));
            cart[idx].status = cart[idx].status === 'dine' ? 'away' : 'dine';
            renderCart();
        });
    });
    container.querySelectorAll('.qty-btn').forEach(function (b) {
        b.addEventListener('click', function () {
            var idx = parseInt(this.getAttribute('data-idx'));
            var delta = parseInt(this.getAttribute('data-delta'));
            cart[idx].qty += delta;
            if (cart[idx].qty <= 0) cart.splice(idx, 1);
            renderCart();
            updateCartBadge();
        });
    });
    container.querySelectorAll('.item-note-input').forEach(function (inp) {
        inp.addEventListener('input', function () {
            cart[parseInt(this.getAttribute('data-idx'))].note = this.value;
        });
        inp.addEventListener('focus', function () { scrollFieldIntoView(this); });
    });

    updateTotals();
    updateCheckoutForm();
    updateCartScrollUI();
}

/* ================================================================
   UX SCROLL: fade atas/bawah + hint "geser untuk lihat semua"
================================================================ */
function updateCartScrollUI() {
    var itemsEl = document.getElementById('cartScrollArea');
    var fadeTop = document.getElementById('fadeTop');
    var fadeBottom = document.getElementById('fadeBottom');
    var hint = document.getElementById('cartScrollHint');
    if (!itemsEl) return;

    function refresh() {
        var scrollable = itemsEl.scrollHeight > itemsEl.clientHeight + 2;
        if (hint) hint.style.display = (scrollable && cart.length > 0) ? 'flex' : 'none';
        if (!scrollable) {
            if (fadeTop) fadeTop.classList.remove('visible');
            if (fadeBottom) fadeBottom.classList.remove('visible');
            return;
        }
        var atTop = itemsEl.scrollTop <= 2;
        var atBottom = (itemsEl.scrollTop + itemsEl.clientHeight) >= (itemsEl.scrollHeight - 2);
        if (fadeTop) fadeTop.classList.toggle('visible', !atTop);
        if (fadeBottom) fadeBottom.classList.toggle('visible', !atBottom);
    }

    refresh();
    itemsEl.onscroll = refresh;
    window._cartScrollRefresh = refresh;
}

window.addEventListener('resize', function () {
    if (window._cartScrollRefresh) window._cartScrollRefresh();
});

/* ================================================================
   KEYBOARD HP
================================================================ */
function scrollFieldIntoView(field) {
    setTimeout(function () {
        if (field && typeof field.scrollIntoView === 'function') {
            field.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
        if (window._cartScrollRefresh) window._cartScrollRefresh();
    }, 300);
}

if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', function () {
        var cartModalEl = document.getElementById('cartModal');
        var isCartOpen = cartModalEl && cartModalEl.classList.contains('active');
        var keyboardLikelyOpen = window.visualViewport.height < window.innerHeight * 0.75;
        document.body.classList.toggle('keyboard-open', isCartOpen && keyboardLikelyOpen);
        if (window._cartScrollRefresh) window._cartScrollRefresh();
    });
}

document.addEventListener('focusin', function (e) {
    if (e.target && e.target.classList && e.target.classList.contains('input-field')) {
        scrollFieldIntoView(e.target);
    }
});
document.addEventListener('focusout', function (e) {
    if (e.target && e.target.classList && e.target.classList.contains('input-field')) {
        setTimeout(function () { document.body.classList.remove('keyboard-open'); }, 100);
    }
});

/* ================================================================
   UPDATE FORM CHECKOUT (DINAMIS)
================================================================ */
function updateCheckoutForm() {
    if (cart.length === 0) return;

    var hasDine = false;
    var hasAway = false;
    var dineCount = 0;
    var awayCount = 0;

    cart.forEach(function (item) {
        if (item.status === 'dine') { hasDine = true; dineCount += item.qty; }
        else { hasAway = true; awayCount += item.qty; }
    });

    var mejaSection = document.getElementById('mejaSection');
    var namaSection = document.getElementById('namaSection');
    var modeText = document.getElementById('checkoutModeText');
    var modeIcons = document.getElementById('checkoutModeIcons');

    var iconsHtml = '';
    if (hasDine) iconsHtml += '<span class="mode-icon-chip chip-dine"><i class="fa-solid fa-utensils"></i> Dine In ' + dineCount + '</span>';
    if (hasAway) iconsHtml += '<span class="mode-icon-chip chip-away"><i class="fa-solid fa-bag-shopping"></i> Bawa Pulang ' + awayCount + '</span>';
    modeIcons.innerHTML = iconsHtml;

    if (hasDine && hasAway) {
        mejaSection.style.display = '';
        namaSection.style.display = '';
        modeText.textContent = 'Anda memiliki pesanan Dine In & Bawa Pulang';
    } else if (hasDine) {
        mejaSection.style.display = '';
        namaSection.style.display = 'none';
        modeText.textContent = 'Semua pesanan Dine In — isi nomor meja';
    } else {
        mejaSection.style.display = 'none';
        namaSection.style.display = '';
        modeText.textContent = 'Semua pesanan Bawa Pulang — isi nama';
    }
}

/* ================================================================
   HITUNG TOTAL
================================================================ */
function updateTotals() {
    var subtotal = 0;
    var takeawayCount = 0;

    cart.forEach(function (item) {
        subtotal += item.price * item.qty;
        if (item.status === 'away' && isMakananBerat(item.category, item.isTopping)) {
            takeawayCount += item.qty;
        }
    });

    var takeawayFee = takeawayCount * TAKEAWAY_FEE;
    var total = subtotal + takeawayFee;

    document.getElementById('subtotalDisplay').textContent = fmtRp(subtotal);
    document.getElementById('totalDisplay').textContent = fmtRp(total);

    var feeRow = document.getElementById('takeawayFeeRow');
    var totalSubLabel = document.getElementById('totalSubLabel');
    if (takeawayFee > 0) {
        feeRow.style.display = 'flex';
        document.getElementById('takeawayCount').textContent = takeawayCount;
        document.getElementById('takeawayFeeDisplay').textContent = fmtRp(takeawayFee);
        if (totalSubLabel) totalSubLabel.textContent = 'termasuk biaya takeaway';
    } else {
        feeRow.style.display = 'none';
        if (totalSubLabel) totalSubLabel.textContent = 'termasuk semua biaya';
    }
}

/* ================================================================
   CART MODAL OPEN / CLOSE
================================================================ */
document.getElementById('fabCart').addEventListener('click', function () {
    renderCart();
    document.getElementById('cartModal').classList.add('active');
    setTimeout(updateCartScrollUI, 50);
});

document.getElementById('btnCloseCart').addEventListener('click', function () {
    document.getElementById('cartModal').classList.remove('active');
    document.body.classList.remove('keyboard-open');
});

document.getElementById('cartModal').addEventListener('click', function (e) {
    if (e.target === this) {
        this.classList.remove('active');
        document.body.classList.remove('keyboard-open');
    }
});

document.getElementById('btnClearCart').addEventListener('click', function () {
    if (cart.length === 0) return;
    if (confirm('Kosongkan seluruh keranjang?')) {
        cart = [];
        renderCart();
        updateCartBadge();
    }
});

/* ================================================================
   CHECKOUT VIA WHATSAPP
   (Format pesan disesuaikan: hanya NO MEJA/NAMA, lalu daftar
   DINE IN / TAKE AWAY per item beserta catatannya, tanpa header
   "PESANAN BARU", tanpa baris Waktu, dan tanpa garis pemisah "---")
================================================================ */
document.getElementById('btnCheckout').addEventListener('click', function () {
    var hasDine = false;
    var hasAway = false;
    cart.forEach(function (item) {
        if (item.status === 'dine') hasDine = true;
        else hasAway = true;
    });

    var mejaVal = '';
    var namaVal = '';

    if (hasDine) {
        mejaVal = document.getElementById('inputMeja').value.trim();
        if (!mejaVal) {
            document.getElementById('inputMeja').classList.add('input-error');
            document.getElementById('inputMeja').focus();
            setTimeout(function () { document.getElementById('inputMeja').classList.remove('input-error'); }, 600);
            showToast('Nomor meja wajib diisi!', true);
            return;
        }
    }

    if (hasAway) {
        namaVal = document.getElementById('inputNama').value.trim();
        if (!namaVal) {
            document.getElementById('inputNama').classList.add('input-error');
            document.getElementById('inputNama').focus();
            setTimeout(function () { document.getElementById('inputNama').classList.remove('input-error'); }, 600);
            showToast('Nama pemesan wajib diisi!', true);
            return;
        }
    }

    var subtotal = 0;
    var takeawayCount = 0;
    var lines = [];

    if (hasDine) lines.push('*NO MEJA - ' + mejaVal + '*');
    if (hasAway) lines.push('*NAMA - ' + namaVal + '*');

    var dineItems = cart.filter(function (item) { return item.status === 'dine'; });
    var awayItems = cart.filter(function (item) { return item.status === 'away'; });

    function pushItemLines(items) {
        items.forEach(function (item) {
            var sub = item.price * item.qty;
            subtotal += sub;
            var displayName = item.name + (item.variant ? ' (' + item.variant + ')' : '');
            lines.push('- (' + item.qty + 'x) ' + displayName);
            if (item.note) lines.push('*' + item.note);
            if (item.status === 'away' && isMakananBerat(item.category, item.isTopping)) {
                takeawayCount += item.qty;
            }
        });
    }

    if (dineItems.length > 0) {
        lines.push('*DINE IN:*');
        pushItemLines(dineItems);
    }
    if (awayItems.length > 0) {
        lines.push('*TAKE AWAY:*');
        pushItemLines(awayItems);
    }

    lines.push('Subtotal: ' + fmtRp(subtotal));
    if (takeawayCount > 0) {
        var fee = takeawayCount * TAKEAWAY_FEE;
        lines.push('Biaya Takeaway (' + takeawayCount + ' item makanan berat): ' + fmtRp(fee));
        lines.push('*TOTAL: ' + fmtRp(subtotal + fee) + '*');
    } else {
        lines.push('*TOTAL: ' + fmtRp(subtotal) + '*');
    }

    var msg = encodeURIComponent(lines.join('\n'));
    window.open('https://wa.me/' + WA_NUMBER + '?text=' + msg, '_blank');

    saveOrderToFirebase(mejaVal, namaVal, subtotal, takeawayCount * TAKEAWAY_FEE);
});

document.getElementById('inputMeja').addEventListener('input', function () { this.classList.remove('input-error'); });
document.getElementById('inputNama').addEventListener('input', function () { this.classList.remove('input-error'); });

/* ================================================================
   SIMPAN ORDER KE FIREBASE
================================================================ */
function saveOrderToFirebase(meja, nama, subtotal, takeawayFee) {
    if (!db) return;
    var orderRef = db.ref('bubur_grace/orders').push();
    var items = cart.map(function (c) {
        return { name: c.name, variant: c.variant || '', qty: c.qty, price: c.price, note: c.note, status: c.status };
    });
    var orderData = { items: items, subtotal: subtotal, takeawayFee: takeawayFee, total: subtotal + takeawayFee, timestamp: Date.now() };
    if (meja) orderData.meja = meja;
    if (nama) orderData.nama = nama;
    orderRef.set(orderData);
    var today = new Date().toISOString().slice(0, 10);
    var statsRef = db.ref('bubur_grace/daily_stats/' + today);
    statsRef.transaction(function (current) {
        if (!current) return { total: subtotal + takeawayFee, count: 1 };
        return { total: (current.total || 0) + subtotal + takeawayFee, count: (current.count || 0) + 1 };
    });
}

/* ================================================================
   SCROLL TO TOP
================================================================ */
var scrollBtn = document.getElementById('scrollTopBtn');
window.addEventListener('scroll', function () {
    scrollBtn.style.display = window.scrollY > 400 ? 'block' : 'none';
});
scrollBtn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

/* ================================================================
   FIREBASE INIT
================================================================ */
function initFirebase() {
    if (typeof firebase === 'undefined') return;
    try {
        var existing = firebase.apps.find(function (a) { return a.name === '[DEFAULT]'; });
        if (!existing) firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        startListeners();
    } catch (e) { console.error('Firebase init error:', e); }
}

/* ================================================================
   FIREBASE LISTENERS
================================================================ */
function startListeners() {
    if (!db) return;
    db.ref('bubur_grace/status').on('value', function (snap) {
        determineStoreStatus(snap.val() || 'auto');
    });
    db.ref('bubur_grace/config/schedule').on('value', function (snap) {
        scheduleData = snap.val();
        updateHoursDisplay();
        db.ref('bubur_grace/status').once('value', function (s) { determineStoreStatus(s.val() || 'auto'); });
    });
    db.ref('bubur_grace/queue').on('value', function (snap) {
        var q = snap.val();
        document.getElementById('queueNum').textContent = (q !== null && q !== undefined) ? q : '-';
    });
    db.ref('bubur_grace/stock').on('value', function (snap) {
        stockData = {};
        var raw = snap.val() || {};
        for (var k in raw) stockData[k] = !!raw[k];
        applyStockAndSwitch();
    });
    db.ref('bubur_grace/weekendStock').on('value', function (snap) {
        weekendStockData = {};
        var raw = snap.val() || {};
        for (var k in raw) weekendStockData[k] = !!raw[k];
        applyStockAndSwitch();
    });
    db.ref('bubur_grace/categorySwitches').on('value', function (snap) {
        var raw = snap.val();
        if (raw && typeof raw === 'object') {
            for (var k in categorySwitches) { if (raw[k] !== undefined) categorySwitches[k] = !!raw[k]; }
        }
        applyStockAndSwitch();
    });
}

/* ================================================================
   TERAPKAN STOK & SWITCH KE KARTU MENU
================================================================ */
function applyStockAndSwitch() {
    var weekend = isWeekendNow() || currentStoreMode === 'open';
    document.querySelectorAll('.menu-card').forEach(function (card) {
        var titleEl = card.querySelector('.card-title');
        if (!titleEl) return;
        var name = titleEl.textContent;
        var isWeekendItem = card.getAttribute('data-weekend') === 'true';
        card.classList.remove('stock-empty', 'weekend-locked', 'cat-disabled');
        if (isWeekendItem) { if (weekendStockData[name] === false) card.classList.add('stock-empty'); }
        else { if (stockData[name] === false) card.classList.add('stock-empty'); }
        if (isWeekendItem && !weekend) card.classList.add('weekend-locked');
        var cat = card.getAttribute('data-category') || '';
        for (var swKey in CAT_SWITCH_MAP) {
            if (CAT_SWITCH_MAP[swKey].indexOf(cat) !== -1 && categorySwitches[swKey] === false) {
                card.classList.add('cat-disabled');
                break;
            }
        }
    });
    if (activeFilter !== 'all') filterCat(activeFilter);
}

/* ================================================================
   TENTUKAN STATUS TOKO
================================================================ */
function determineStoreStatus(mode) {
    currentStoreMode = mode;
    var badge = document.getElementById('storeStatusBadge');
    var text = document.getElementById('storeStatusText');
    if (mode === 'open') {
        storeIsOpen = true;
        badge.className = 'store-status-badge open'; text.textContent = 'BUKA';
    } else if (mode === 'close') {
        storeIsOpen = false;
        badge.className = 'store-status-badge closed'; text.textContent = 'TUTUP';
    } else {
        var now = new Date();
        var day = now.getDay();
        var minutes = now.getHours() * 60 + now.getMinutes();
        var sched = null;
        if (scheduleData) sched = scheduleData[day] || scheduleData[String(day)];
        if (sched && sched.isOpen) {
            var openT = parseTime(sched.open);
            var closeT = parseTime(sched.close);
            if (openT !== null && closeT !== null && minutes >= openT && minutes < closeT) {
                storeIsOpen = true; badge.className = 'store-status-badge open'; text.textContent = 'BUKA';
            } else {
                storeIsOpen = false; badge.className = 'store-status-badge closed'; text.textContent = 'TUTUP';
            }
        } else {
            storeIsOpen = false; badge.className = 'store-status-badge closed'; text.textContent = 'TUTUP';
        }
    }
    applyStockAndSwitch();
}

/* ================================================================
   TAMPILKAN JAM OPERASIONAL
================================================================ */
function updateHoursDisplay() {
    if (!scheduleData) return;
    var day = getTodayDay();
    var sched = scheduleData[day] || scheduleData[String(day)];
    var dayName = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][day];
    var text = '';
    if (sched && sched.isOpen) { text = dayName + ': ' + sched.open + ' - ' + sched.close; }
    else { text = dayName + ': Tutup'; }
    document.getElementById('heroHours').textContent = text;
    document.getElementById('footerHours').textContent = text;
}

/* ================================================================
   INIT
================================================================ */
document.addEventListener('DOMContentLoaded', function () { initFirebase(); });