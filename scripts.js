// --- CART SYSTEM ---
let cart = [];
let currentVariantCard = null;
const PACKAGING_FEE_PER_ITEM = 3000;
// Menambahkan 'bihun' ke kategori eligible untuk biaya kemasan
const ELIGIBLE_CATEGORIES = ['bubur', 'mie', 'kwetiau', 'bihun', 'nasi', 'baso', 'weekend'];

// Delegasi Event Listener
document.body.addEventListener('click', function(e) {
    const btn = e.target.closest('.add-btn');
    if (btn) {
        const card = btn.closest('.menu-card');
        if (card) {
            if (card.getAttribute('data-has-variants') === 'true') {
                showVariantModal(card);
            } else {
                const name = card.querySelector('.card-title').innerText;
                const price = parseInt(card.dataset.price); 
                const category = card.getAttribute('data-category');
                addToCart(name, price, category);
            }
        }
    }
});

// --- VARIANT MODAL LOGIC ---
function showVariantModal(card) {
    currentVariantCard = card;
    const baseName = card.querySelector('.card-title').innerText;
    const variantName = card.getAttribute('data-variant-name');
    const optionsStr = card.getAttribute('data-options');
    const options = optionsStr.split(',');

    const modalTitle = document.getElementById('variantTitle');
    const container = document.getElementById('variantOptionsContainer');
    
    modalTitle.innerText = `Pilih ${variantName}`;
    container.innerHTML = '';

    options.forEach((opt, index) => {
        const isSelected = index === 0 ? 'selected' : '';
        const isChecked = index === 0 ? 'checked' : '';
        
        const label = document.createElement('label');
        label.className = `variant-option-label ${isSelected}`;
        label.onclick = function() {
            document.querySelectorAll('.variant-option-label').forEach(l => l.classList.remove('selected'));
            this.classList.add('selected');
            this.querySelector('input').checked = true;
        };

        label.innerHTML = `
            <input type="radio" name="variantOpt" value="${opt}" ${isChecked}>
            <div class="radio-circle"></div>
            <span>${opt}</span>
        `;
        container.appendChild(label);
    });

    document.getElementById('variantModal').classList.add('active');
}

function closeVariantModal(e) {
    if (e.target.id === 'variantModal') {
        document.getElementById('variantModal').classList.remove('active');
    }
}

function confirmVariantSelection() {
    if (!currentVariantCard) return;
    
    const selectedOpt = document.querySelector('input[name="variantOpt"]:checked').value;
    const baseName = currentVariantCard.querySelector('.card-title').innerText;
    const price = parseInt(currentVariantCard.dataset.price); 
    const category = currentVariantCard.getAttribute('data-category');
    
    const finalName = `${baseName} (${selectedOpt})`;

    addToCart(finalName, price, category);
    document.getElementById('variantModal').classList.remove('active');
    currentVariantCard = null;
}

function addToCart(name, price, category) {
    const existingItem = cart.find(item => item.name === name);
    if (existingItem) {
        existingItem.qty++;
    } else {
        cart.push({ name, price, qty: 1, category });
    }
    updateCartUI();
    showToast();
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateCartUI();
}

function updateQty(index, change) {
    cart[index].qty += change;
    if (cart[index].qty <= 0) {
        removeFromCart(index);
    } else {
        updateCartUI();
    }
}

function updateCartUI() {
    const container = document.getElementById('cartItemsContainer');
    const badge = document.getElementById('cartBadge');
    container.innerHTML = '';
    
    let totalQty = 0;

    if (cart.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:#999; margin-top:20px; font-size:0.9rem;">Keranjang masih kosong.</p>';
        badge.style.display = 'none';
    } else {
        badge.style.display = 'flex';
        cart.forEach((item, index) => {
            totalQty += item.qty;

            const itemDiv = document.createElement('div');
            itemDiv.className = 'cart-item';
            itemDiv.innerHTML = `
                <div class="item-info">
                    <h4>${item.name}</h4>
                    <p>${formatRupiah(item.price)}</p>
                </div>
                <div class="item-controls">
                    <button class="qty-btn" onclick="updateQty(${index}, -1)">-</button>
                    <span style="font-size:0.9rem; font-weight:600; min-width:20px; text-align:center;">${item.qty}</span>
                    <button class="qty-btn" onclick="updateQty(${index}, 1)">+</button>
                </div>
            `;
            container.appendChild(itemDiv);
        });
        badge.innerText = totalQty;
    }
    updateTotal();
}

function updateTotal() {
    const totalEl = document.getElementById('cartTotal');
    const isTakeAway = document.getElementById('takeawayToggle').checked;
    
    let subtotal = 0;
    let eligibleCount = 0;

    cart.forEach(item => {
        subtotal += item.price * item.qty;
        if (ELIGIBLE_CATEGORIES.includes(item.category)) {
            eligibleCount += item.qty;
        }
    });

    const packagingFee = isTakeAway ? (eligibleCount * PACKAGING_FEE_PER_ITEM) : 0;
    const total = subtotal + packagingFee;
    totalEl.innerText = formatRupiah(total);
}

function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
}

function toggleCart() {
    document.getElementById('cartModal').classList.toggle('active');
}

function closeCart(e) {
    if (e.target.id === 'cartModal') toggleCart();
}

function showToast() {
    const toast = document.getElementById("toast");
    toast.className = "show";
    setTimeout(function(){ toast.className = toast.className.replace("show", ""); }, 2000);
}

function checkout() {
    if (cart.length === 0) return alert("Keranjang kosong!");
    
    const isTakeAway = document.getElementById('takeawayToggle').checked;
    let message = "Halo Bubur Grace, saya mau pesan:%0A";
    
    let subtotal = 0;
    let eligibleCount = 0;

    cart.forEach(item => {
        const itemTotal = item.price * item.qty;
        subtotal += itemTotal;
        if (ELIGIBLE_CATEGORIES.includes(item.category)) {
            eligibleCount += item.qty;
        }
        message += `- ${item.name} (${item.qty}x)%0A`;
    });

    message += `%0A*Subtotal Makanan: ${formatRupiah(subtotal)}*%0A`;

    if (isTakeAway && eligibleCount > 0) {
        const packagingFee = eligibleCount * PACKAGING_FEE_PER_ITEM;
        message += `*Biaya Kemasan (${eligibleCount} item Bubur/Mie/Kwetiau/Bihun/Nasi/Baso/Weekend): ${formatRupiah(packagingFee)}*%0A`;
    }

    const packagingFee = isTakeAway ? (eligibleCount * PACKAGING_FEE_PER_ITEM) : 0;
    const grandTotal = subtotal + packagingFee;

    message += `%0A*TOTAL BAYAR: ${formatRupiah(grandTotal)}*%0A`;
    
    if (isTakeAway && eligibleCount > 0) {
        message += "%0A(Mohon dibungkus untuk makanan berat)";
    } else if (isTakeAway && eligibleCount === 0) {
        message += "%0A(Tidak ada biaya kemasan karena hanya memesan minuman/snack)";
    } else {
        message += "%0A(Makan di tempat)";
    }
    
    message += "%0A%0AMohon diproses ya. Terima kasih!";
    
    window.open(`https://wa.me/62817776175?text=${message}`, '_blank');
}

// --- SEARCH & FILTER LOGIC ---
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const cards = document.querySelectorAll('.menu-card');
const noResultMsg = document.getElementById('noResultMsg');
const sectionHeaders = document.querySelectorAll('.section-header');
const menuGrids = document.querySelectorAll('.menu-grid');

searchInput.addEventListener('keyup', (e) => {
    const term = e.target.value.toLowerCase();
    
    if(term.length > 0) {
        clearSearchBtn.style.display = 'block';
        
        let hasGlobalResult = false;
        
        menuGrids.forEach((grid, index) => {
            const header = sectionHeaders[index];
            const cardsInGrid = grid.querySelectorAll('.menu-card');
            let hasResultInGrid = false;

            cardsInGrid.forEach(card => {
                const title = card.querySelector('.card-title').innerText.toLowerCase();
                const desc = card.querySelector('.card-desc') ? card.querySelector('.card-desc').innerText.toLowerCase() : '';
                
                if(title.includes(term) || desc.includes(term)) {
                    card.style.display = 'flex';
                    hasResultInGrid = true;
                    hasGlobalResult = true;
                } else {
                    card.style.display = 'none';
                }
            });

            // Tampilkan header hanya jika ada item yang cocok di grid tersebut
            // Tampilkan juga separator (divider) jika ada yang terlihat
            const dividers = grid.querySelectorAll('.sub-section-divider');
            if (hasResultInGrid) {
                header.style.display = 'flex';
                header.classList.remove('hidden');
                dividers.forEach(div => div.style.display = 'flex');
            } else {
                header.style.display = 'none';
                header.classList.add('hidden');
                dividers.forEach(div => div.style.display = 'none');
            }
        });

        noResultMsg.style.display = hasGlobalResult ? 'none' : 'block';
    } else {
        resetSearch();
    }
});

function resetSearch() {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    
    cards.forEach(card => card.style.display = 'flex');
    document.querySelectorAll('.sub-section-divider').forEach(div => div.style.display = 'flex');
    sectionHeaders.forEach(header => {
        header.style.display = 'flex';
        header.classList.remove('hidden');
    });
    noResultMsg.style.display = 'none';
}

const catPills = document.querySelectorAll('.cat-pill');
function filterCat(category) {
    if(searchInput.value !== '') resetSearch();
    
    catPills.forEach(pill => pill.classList.remove('active'));
    event.target.classList.add('active');
    
    cards.forEach(card => {
        const cardCat = card.getAttribute('data-category');
        if(category === 'all' || cardCat === category) {
            card.style.display = 'flex';
        } else {
            card.style.display = 'none';
        }
    });

    // Logic untuk menyembunyikan divider/section header jika tidak ada item terlihat
    menuGrids.forEach((grid, index) => {
        const header = sectionHeaders[index];
        let hasVisible = false;
        Array.from(grid.children).forEach(child => {
            if (child.style.display !== 'none') hasVisible = true;
        });

        if(!hasVisible) {
            header.style.display = 'none';
        } else {
            header.style.display = 'flex';
        }
    });
}