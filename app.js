import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://fbukkqomytzoilxxvpef.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_YSGF9y8LHX6qeb-9J1aKwg_jrw4utyQ";
const MAX_IMAGES = 4;
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

const CATEGORY_OPTIONS = [
  "All",
  "Mobiles",
  "Vehicles",
  "Property",
  "Electronics & Appliances",
  "Furniture",
  "Fashion & Beauty",
  "Books, Sports & Hobbies",
  "Jobs",
  "Services",
  "Pets"
];

const POST_CATEGORY_OPTIONS = CATEGORY_OPTIONS.filter((category) => category !== "All");
const CONDITION_OPTIONS = ["All", "New", "Used", "Refurbished"];

const state = {
  currentUser: null,
  users: [],
  listings: [],
  favoriteIds: [],
  chats: [],
  marketStats: {
    listingCount: 0,
    sellerCount: 0,
    chatCount: 0
  },
  filters: {
    search: "",
    location: "All",
    category: "All",
    condition: "All",
    sort: "recent",
    savedOnly: false
  },
  selectedListingId: null,
  selectedImageIndex: 0,
  selectedThreadId: null,
  draftImages: []
};

const el = {
  listingTotal: document.getElementById("listingTotal"),
  sellerTotal: document.getElementById("sellerTotal"),
  chatTotal: document.getElementById("chatTotal"),
  sessionBadge: document.getElementById("sessionBadge"),
  profileLink: document.getElementById("profileLink"),
  heroSearchForm: document.getElementById("heroSearchForm"),
  heroSearchInput: document.getElementById("heroSearchInput"),
  heroLocationSelect: document.getElementById("heroLocationSelect"),
  quickCategoryGrid: document.getElementById("quickCategoryGrid"),
  searchInput: document.getElementById("searchInput"),
  locationFilter: document.getElementById("locationFilter"),
  sortSelect: document.getElementById("sortSelect"),
  categoryRow: document.getElementById("categoryRow"),
  conditionRow: document.getElementById("conditionRow"),
  savedOnlyToggle: document.getElementById("savedOnlyToggle"),
  clearFiltersBtn: document.getElementById("clearFiltersBtn"),
  listingCount: document.getElementById("listingCount"),
  marketSummary: document.getElementById("marketSummary"),
  listingGrid: document.getElementById("listingGrid"),
  detailEmpty: document.getElementById("detailEmpty"),
  detailContent: document.getElementById("detailContent"),
  detailVisual: document.getElementById("detailVisual"),
  detailImage: document.getElementById("detailImage"),
  detailCategoryLabel: document.getElementById("detailCategoryLabel"),
  detailThumbRow: document.getElementById("detailThumbRow"),
  detailBadge: document.getElementById("detailBadge"),
  detailTitle: document.getElementById("detailTitle"),
  detailPrice: document.getElementById("detailPrice"),
  detailMeta: document.getElementById("detailMeta"),
  detailDescription: document.getElementById("detailDescription"),
  sellerName: document.getElementById("sellerName"),
  sellerRole: document.getElementById("sellerRole"),
  sellerLocation: document.getElementById("sellerLocation"),
  sellerStats: document.getElementById("sellerStats"),
  favoriteBtn: document.getElementById("favoriteBtn"),
  contactSellerBtn: document.getElementById("contactSellerBtn"),
  googleSignInBtn: document.getElementById("googleSignInBtn"),
  appleSignInBtn: document.getElementById("appleSignInBtn"),
  registerForm: document.getElementById("registerForm"),
  loginForm: document.getElementById("loginForm"),
  authSection: document.getElementById("authSection"),
  dashboardSection: document.getElementById("dashboardSection"),
  accountGreeting: document.getElementById("accountGreeting"),
  accountMeta: document.getElementById("accountMeta"),
  dashboardProfileLink: document.getElementById("dashboardProfileLink"),
  logoutBtn: document.getElementById("logoutBtn"),
  savedCount: document.getElementById("savedCount"),
  myListingCount: document.getElementById("myListingCount"),
  threadCount: document.getElementById("threadCount"),
  savedGrid: document.getElementById("savedGrid"),
  myListingsGrid: document.getElementById("myListingsGrid"),
  threadList: document.getElementById("threadList"),
  chatEmpty: document.getElementById("chatEmpty"),
  chatBox: document.getElementById("chatBox"),
  chatPartnerName: document.getElementById("chatPartnerName"),
  chatListingMeta: document.getElementById("chatListingMeta"),
  openChatListingBtn: document.getElementById("openChatListingBtn"),
  chatMessages: document.getElementById("chatMessages"),
  chatForm: document.getElementById("chatForm"),
  chatInput: document.getElementById("chatInput"),
  sellLocked: document.getElementById("sellLocked"),
  postForm: document.getElementById("postForm"),
  postCategorySelect: document.getElementById("postCategorySelect"),
  postNote: document.getElementById("postNote"),
  imagesInput: document.getElementById("imagesInput"),
  imagePreviewGrid: document.getElementById("imagePreviewGrid"),
  toast: document.getElementById("toast")
};

el.heroSearchForm?.addEventListener("submit", onHeroSearch);
el.quickCategoryGrid?.addEventListener("click", onQuickCategoryClick);
el.searchInput?.addEventListener("input", onSearchInput);
el.locationFilter?.addEventListener("change", onLocationChange);
el.sortSelect?.addEventListener("change", onSortChange);
el.savedOnlyToggle?.addEventListener("change", onSavedToggle);
el.clearFiltersBtn?.addEventListener("click", resetFilters);
el.listingGrid?.addEventListener("click", onListingGridClick);
el.detailThumbRow?.addEventListener("click", onThumbRowClick);
el.favoriteBtn?.addEventListener("click", () => void toggleFavorite(state.selectedListingId));
el.contactSellerBtn?.addEventListener("click", () => void openChatForSelectedListing());
el.googleSignInBtn?.addEventListener("click", () => void onOAuthSignIn("google"));
el.registerForm?.addEventListener("submit", onRegister);
el.loginForm?.addEventListener("submit", onLogin);
el.logoutBtn?.addEventListener("click", () => void onLogout());
el.savedGrid?.addEventListener("click", onSavedGridClick);
el.myListingsGrid?.addEventListener("click", onMyListingsClick);
el.threadList?.addEventListener("click", onThreadListClick);
el.chatForm?.addEventListener("submit", onChatSubmit);
el.openChatListingBtn?.addEventListener("click", onOpenChatListing);
el.postForm?.addEventListener("submit", onPostListing);
el.imagesInput?.addEventListener("change", onImagesSelected);
el.imagePreviewGrid?.addEventListener("click", onImagePreviewClick);

void bootstrap();

async function bootstrap() {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    throwIfError(sessionError, "Could not restore your session.");

    const authUser = sessionData.session?.user || null;
    const [profiles, listings, favoriteIds, chats] = await Promise.all([
      loadProfiles(),
      loadListings(),
      loadFavoriteIds(authUser?.id),
      loadChats(authUser?.id)
    ]);

    state.currentUser = authUser ? buildCurrentUser(authUser, profiles.find((profile) => profile.id === authUser.id) || null) : null;
    state.users = profiles.map(mapProfile);
    state.listings = listings.map(mapListing);
    state.favoriteIds = favoriteIds;
    state.chats = chats;
    state.marketStats = {
      listingCount: state.listings.length,
      sellerCount: new Set(state.listings.map((listing) => listing.sellerId)).size,
      chatCount: state.currentUser ? state.chats.length : 0
    };

    if (state.currentUser) {
      if (!threadsForCurrentUser().some((thread) => thread.id === state.selectedThreadId)) {
        state.selectedThreadId = threadsForCurrentUser()[0]?.id || null;
      }
    } else {
      state.selectedThreadId = null;
      state.filters.savedOnly = false;
    }

    renderAll();
  } catch (error) {
    toast(friendlyError(error, "Could not connect to JustMarket."));
  }
}

function renderAll() {
  populatePostCategories();
  renderLocationOptions();
  renderCategoryChips();
  renderConditionChips();
  renderQuickCategories();
  renderStats();
  renderSessionState();
  renderListings();
  renderDraftImages();
  bindButtonHover(document.querySelectorAll(".button"));
}

function renderStats() {
  const fallbackSellerCount = new Set(state.listings.map((listing) => listing.sellerId)).size;
  const stats = state.marketStats || {};

  el.listingTotal.textContent = String(stats.listingCount ?? state.listings.length);
  el.sellerTotal.textContent = String(stats.sellerCount ?? fallbackSellerCount);
  el.chatTotal.textContent = String(stats.chatCount ?? state.chats.length);
}

function populatePostCategories() {
  if (!el.postCategorySelect) return;

  el.postCategorySelect.innerHTML = [
    '<option value="">Select one</option>',
    ...POST_CATEGORY_OPTIONS.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
  ].join("");
}

function renderLocationOptions() {
  const current = state.filters.location;
  const locations = ["All", ...new Set(state.listings.map((listing) => listing.location))];
  const options = locations.map((location) => `<option value="${escapeHtml(location)}">${escapeHtml(location)}</option>`).join("");

  el.locationFilter.innerHTML = options;
  el.heroLocationSelect.innerHTML = options;

  if (!locations.includes(current)) state.filters.location = "All";

  el.locationFilter.value = state.filters.location;
  el.heroLocationSelect.value = state.filters.location;
}

function renderCategoryChips() {
  el.categoryRow.innerHTML = CATEGORY_OPTIONS.map((category) => {
    const active = category === state.filters.category ? "active" : "";
    return `<button class="chip ${active}" data-category="${escapeHtml(category)}" type="button">${escapeHtml(category)}</button>`;
  }).join("");

  el.categoryRow.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filters.category = button.getAttribute("data-category") || "All";
      renderCategoryChips();
      renderQuickCategories();
      renderListings();
    });
  });
}

function renderConditionChips() {
  el.conditionRow.innerHTML = CONDITION_OPTIONS.map((condition) => {
    const active = condition === state.filters.condition ? "active" : "";
    return `<button class="chip ${active}" data-condition="${escapeHtml(condition)}" type="button">${escapeHtml(condition)}</button>`;
  }).join("");

  el.conditionRow.querySelectorAll("[data-condition]").forEach((button) => {
    button.addEventListener("click", () => {
      state.filters.condition = button.getAttribute("data-condition") || "All";
      renderConditionChips();
      renderListings();
    });
  });
}

function renderQuickCategories() {
  if (!el.quickCategoryGrid) return;

  const quickCategories = POST_CATEGORY_OPTIONS.slice(0, 6);
  el.quickCategoryGrid.innerHTML = quickCategories
    .map((category) => {
      const count = state.listings.filter((listing) => listing.category === category).length;
      const active = state.filters.category === category ? "active" : "";
      return `
        <button class="category-tile ${active}" data-quick-category="${escapeHtml(category)}" type="button">
          <div class="category-tile-head">
            <span class="category-mark">${escapeHtml(categoryMark(category))}</span>
            <span class="category-count">${count} ad${count === 1 ? "" : "s"}</span>
          </div>
          <strong>${escapeHtml(category)}</strong>
          <p>${escapeHtml(categoryHint(category))}</p>
        </button>
      `;
    })
    .join("");
}

function renderListings() {
  const listings = filteredListings();
  const favoriteIds = new Set(state.favoriteIds);

  ensureSelectedListing(listings);
  el.listingCount.textContent = `${listings.length} listing${listings.length === 1 ? "" : "s"}`;
  el.marketSummary.textContent = buildMarketSummary(listings.length);

  if (!listings.length) {
    el.listingGrid.innerHTML = `
      <article class="listing-card">
        <div class="listing-main">
          <h4>No listings yet for these filters.</h4>
          <p>Try a different category, clear the filters, or create the first listing on JustMarket.</p>
          <div class="hero-actions">
            <a class="button" href="#account">Create Account</a>
            <a class="button button-secondary" href="#sell">Post First Ad</a>
          </div>
        </div>
      </article>
    `;
    renderSelectedListing(null);
    bindButtonHover(document.querySelectorAll(".button"));
    return;
  }

  el.listingGrid.innerHTML = listings
    .map((listing) => {
      const seller = userById(listing.sellerId);
      const selected = listing.id === state.selectedListingId ? "selected" : "";
      const saved = favoriteIds.has(listing.id);

      return `
        <article class="listing-card ${selected}" data-select-listing="${listing.id}">
          ${renderListingArt(listing)}
          <div class="listing-main">
            <div class="listing-top">
              <strong class="listing-price">${formatMoney(listing.price)}</strong>
              <button class="button button-ghost mini-button save-chip" data-toggle-favorite="${listing.id}" type="button">
                ${saved ? "Saved" : "Save"}
              </button>
            </div>
            <h4>${escapeHtml(listing.title)}</h4>
            <p>${escapeHtml(listing.category)} · ${escapeHtml(listing.condition)} · ${escapeHtml(listing.location)}</p>
            <div class="listing-footer">
              <span>${escapeHtml(seller?.name || "Unknown seller")}</span>
              <span>${escapeHtml(timeAgo(listing.createdAt))}</span>
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  renderSelectedListing(listings.find((listing) => listing.id === state.selectedListingId) || null);
  bindButtonHover(document.querySelectorAll(".button"));
}

function renderSelectedListing(listing) {
  if (!listing) {
    el.detailEmpty.hidden = false;
    el.detailContent.hidden = true;
    return;
  }

  const seller = userById(listing.sellerId);
  const saved = state.favoriteIds.includes(listing.id);
  const selfOwned = state.currentUser?.id === listing.sellerId;
  const sellerListings = state.listings.filter((entry) => entry.sellerId === listing.sellerId).length;

  el.detailEmpty.hidden = true;
  el.detailContent.hidden = false;
  el.detailVisual.className = `detail-visual tone-${toneForCategory(listing.category)}`;
  el.detailCategoryLabel.textContent = listing.category;
  el.detailBadge.textContent = `${listing.category} · ${listing.condition}`;
  el.detailTitle.textContent = listing.title;
  el.detailPrice.textContent = formatMoney(listing.price);
  el.detailMeta.innerHTML = `
    <span>${escapeHtml(listing.location)}</span>
    <span>${escapeHtml(timeAgo(listing.createdAt))}</span>
    <span>${escapeHtml(roleLabel(seller?.role || "customer"))}</span>
  `;
  el.detailDescription.textContent = listing.description;
  el.sellerName.textContent = seller?.name || "Unknown seller";
  el.sellerRole.textContent = roleLabel(seller?.role || "customer");
  el.sellerLocation.textContent = seller?.location || listing.location;
  el.sellerStats.textContent = `${sellerListings} active ad${sellerListings === 1 ? "" : "s"}`;
  el.favoriteBtn.textContent = saved ? "Saved" : "Save";
  el.contactSellerBtn.disabled = selfOwned;
  el.contactSellerBtn.textContent = selfOwned ? "Your Listing" : "Open Chat";

  renderDetailImages(listing);
}

function renderDetailImages(listing) {
  const images = listing.images || [];
  const currentImage = images[state.selectedImageIndex] || "";

  if (currentImage) {
    el.detailImage.hidden = false;
    el.detailImage.src = currentImage;
    el.detailCategoryLabel.hidden = true;
  } else {
    el.detailImage.hidden = true;
    el.detailImage.removeAttribute("src");
    el.detailCategoryLabel.hidden = false;
  }

  if (!images.length) {
    el.detailThumbRow.innerHTML = "";
    return;
  }

  el.detailThumbRow.innerHTML = images
    .map((image, index) => {
      const active = index === state.selectedImageIndex ? "active" : "";
      return `
        <button class="thumb-button ${active}" data-thumb-index="${index}" type="button">
          <img src="${escapeHtml(image)}" alt="Listing image ${index + 1}" />
        </button>
      `;
    })
    .join("");
}

function renderSessionState() {
  const user = state.currentUser;
  const isLoggedIn = Boolean(user);

  if (!user) {
    state.filters.savedOnly = false;
    state.selectedThreadId = null;
  }

  const threads = threadsForCurrentUser();
  if (user && !threads.some((thread) => thread.id === state.selectedThreadId)) {
    state.selectedThreadId = threads[0]?.id || null;
  }

  el.sessionBadge.textContent = user ? `${user.name} · ${roleLabel(user.role)}` : "Browse freely";
  el.profileLink.hidden = !isLoggedIn;
  el.dashboardProfileLink.hidden = !isLoggedIn;
  el.savedOnlyToggle.checked = state.filters.savedOnly;
  el.savedOnlyToggle.disabled = !isLoggedIn;
  el.authSection.hidden = isLoggedIn;
  el.dashboardSection.hidden = !isLoggedIn;
  el.sellLocked.hidden = isLoggedIn;
  el.postForm.hidden = !isLoggedIn;

  if (!user) {
    renderSavedGrid([]);
    renderMyListings([]);
    renderThreads([]);
    renderChatWindow(null);
    return;
  }

  const savedListings = state.listings.filter((listing) => state.favoriteIds.includes(listing.id));
  const myListings = state.listings
    .filter((listing) => listing.sellerId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  el.accountGreeting.textContent = `Welcome, ${user.name}`;
  el.accountMeta.textContent = `${roleLabel(user.role)} in ${user.location}. Your account lets you post ads, save listings, and chat across the shared JustMarket marketplace.`;
  el.savedCount.textContent = String(savedListings.length);
  el.myListingCount.textContent = String(myListings.length);
  el.threadCount.textContent = String(threads.length);

  renderSavedGrid(savedListings);
  renderMyListings(myListings);
  renderThreads(threads);
  renderChatWindow(threads.find((thread) => thread.id === state.selectedThreadId) || null);
}

function renderSavedGrid(listings) {
  if (!listings.length) {
    el.savedGrid.innerHTML = "<article class='mini-card'><p>No saved ads yet.</p></article>";
    return;
  }

  el.savedGrid.innerHTML = listings
    .map(
      (listing) => `
        <article class="mini-card">
          ${renderMiniCardImage(listing)}
          <strong>${escapeHtml(listing.title)}</strong>
          <p>${formatMoney(listing.price)} · ${escapeHtml(listing.location)}</p>
          <div class="mini-card-footer">
            <button class="button button-ghost mini-button" data-open-listing="${listing.id}" type="button">Open</button>
            <button class="button button-ghost mini-button" data-remove-saved="${listing.id}" type="button">Remove</button>
          </div>
        </article>
      `
    )
    .join("");

  bindButtonHover(el.savedGrid.querySelectorAll(".button"));
}

function renderMyListings(listings) {
  if (!listings.length) {
    el.myListingsGrid.innerHTML = "<article class='mini-card'><p>You have not posted any ads yet.</p></article>";
    return;
  }

  el.myListingsGrid.innerHTML = listings
    .map(
      (listing) => `
        <article class="mini-card">
          ${renderMiniCardImage(listing)}
          <strong>${escapeHtml(listing.title)}</strong>
          <p>${formatMoney(listing.price)} · ${escapeHtml(listing.category)} · ${escapeHtml(listing.location)}</p>
          <div class="mini-card-footer">
            <button class="button button-ghost mini-button" data-open-listing="${listing.id}" type="button">Open</button>
            <button class="button button-ghost mini-button" data-delete-listing="${listing.id}" type="button">Delete</button>
          </div>
        </article>
      `
    )
    .join("");

  bindButtonHover(el.myListingsGrid.querySelectorAll(".button"));
}

function renderThreads(threads) {
  if (!threads.length) {
    el.threadList.innerHTML = "<div class='thread-empty'>No chats yet. Open a listing and start the first real conversation.</div>";
    return;
  }

  el.threadList.innerHTML = threads
    .map((thread) => {
      const partner = threadPartner(thread);
      const listing = listingById(thread.listingId);
      const lastMessage = thread.messages.at(-1);
      const active = thread.id === state.selectedThreadId ? "active" : "";

      return `
        <article class="thread-card ${active}" data-thread-id="${thread.id}">
          <div class="thread-card-head">
            <strong>${escapeHtml(partner?.name || "Unknown user")}</strong>
            <span class="product-pill">${escapeHtml(timeAgo(thread.updatedAt))}</span>
          </div>
          <p class="thread-subtitle">${escapeHtml(listing?.title || "Listing removed")}</p>
          <p class="thread-preview">${escapeHtml(lastMessage?.text || "No messages yet. Send the first one.")}</p>
        </article>
      `;
    })
    .join("");
}

function renderChatWindow(thread) {
  if (!thread || !state.currentUser) {
    el.chatEmpty.hidden = false;
    el.chatBox.hidden = true;
    return;
  }

  const listing = listingById(thread.listingId);
  const partner = threadPartner(thread);

  el.chatEmpty.hidden = true;
  el.chatBox.hidden = false;
  el.chatPartnerName.textContent = partner?.name || "Unknown user";
  el.chatListingMeta.textContent = listing ? `${listing.title} · ${formatMoney(listing.price)}` : "Listing removed";
  el.openChatListingBtn.dataset.listingId = listing?.id || "";

  if (!thread.messages.length) {
    el.chatMessages.innerHTML = "<div class='chat-empty'>Conversation opened. Send the first message here.</div>";
    return;
  }

  el.chatMessages.innerHTML = thread.messages
    .map((message) => {
      const own = message.senderId === state.currentUser.id ? "own" : "";
      return `
        <div class="message-row ${own}">
          <article class="message-bubble">
            <p>${escapeHtml(message.text)}</p>
            <span class="message-time">${escapeHtml(timeAgo(message.createdAt))}</span>
          </article>
        </div>
      `;
    })
    .join("");

  el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
}

function renderDraftImages() {
  if (!state.draftImages.length) {
    el.imagePreviewGrid.innerHTML = "<div class='preview-empty'>No images selected yet.</div>";
    return;
  }

  el.imagePreviewGrid.innerHTML = state.draftImages
    .map(
      (image, index) => `
        <article class="preview-card">
          <img src="${escapeHtml(image)}" alt="Draft image ${index + 1}" />
          <button class="button button-ghost mini-button" data-remove-draft="${index}" type="button">Remove</button>
        </article>
      `
    )
    .join("");

  bindButtonHover(el.imagePreviewGrid.querySelectorAll(".button"));
}

function filteredListings() {
  const query = state.filters.search.trim().toLowerCase();
  const savedIds = new Set(state.favoriteIds);

  return [...state.listings]
    .filter((listing) => {
      const seller = userById(listing.sellerId);

      if (state.filters.category !== "All" && listing.category !== state.filters.category) return false;
      if (state.filters.condition !== "All" && listing.condition !== state.filters.condition) return false;
      if (state.filters.location !== "All" && listing.location !== state.filters.location) return false;
      if (state.filters.savedOnly && !savedIds.has(listing.id)) return false;
      if (!query) return true;

      return [listing.title, listing.category, listing.description, listing.location, seller?.name || ""]
        .join(" ")
        .toLowerCase()
        .includes(query);
    })
    .sort((a, b) => {
      if (state.filters.sort === "price-low") return a.price - b.price;
      if (state.filters.sort === "price-high") return b.price - a.price;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
}

function ensureSelectedListing(listings) {
  if (!listings.length) {
    state.selectedListingId = null;
    state.selectedImageIndex = 0;
    return;
  }

  if (!listings.some((listing) => listing.id === state.selectedListingId)) {
    state.selectedListingId = listings[0].id;
    state.selectedImageIndex = 0;
  }
}

function onHeroSearch(event) {
  event.preventDefault();
  state.filters.search = el.heroSearchInput.value.trim();
  state.filters.location = el.heroLocationSelect.value || "All";
  syncFilterInputs();
  renderListings();
}

function onQuickCategoryClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const button = target.closest("[data-quick-category]");
  if (!button) return;

  state.filters.category = button.getAttribute("data-quick-category") || "All";
  renderCategoryChips();
  renderQuickCategories();
  renderListings();
  document.getElementById("marketplace")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function onSearchInput(event) {
  state.filters.search = event.target.value.trim();
  el.heroSearchInput.value = state.filters.search;
  renderListings();
}

function onLocationChange(event) {
  state.filters.location = event.target.value || "All";
  el.heroLocationSelect.value = state.filters.location;
  renderListings();
}

function onSortChange(event) {
  state.filters.sort = event.target.value || "recent";
  renderListings();
}

function onSavedToggle(event) {
  if (!state.currentUser) {
    event.target.checked = false;
    toast("Log in to filter by saved ads.");
    return;
  }

  state.filters.savedOnly = event.target.checked;
  renderListings();
}

function resetFilters() {
  state.filters = {
    search: "",
    location: "All",
    category: "All",
    condition: "All",
    sort: "recent",
    savedOnly: false
  };

  syncFilterInputs();
  renderCategoryChips();
  renderConditionChips();
  renderQuickCategories();
  renderListings();
}

function syncFilterInputs() {
  el.searchInput.value = state.filters.search;
  el.heroSearchInput.value = state.filters.search;
  el.locationFilter.value = state.filters.location;
  el.heroLocationSelect.value = state.filters.location;
  el.sortSelect.value = state.filters.sort;
  el.savedOnlyToggle.checked = state.filters.savedOnly;
}

function onListingGridClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const favoriteButton = target.closest("[data-toggle-favorite]");
  if (favoriteButton) {
    void toggleFavorite(favoriteButton.getAttribute("data-toggle-favorite"));
    return;
  }

  const card = target.closest("[data-select-listing]");
  if (!card) return;

  state.selectedListingId = card.getAttribute("data-select-listing");
  state.selectedImageIndex = 0;
  renderListings();
}

function onThumbRowClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const button = target.closest("[data-thumb-index]");
  if (!button) return;

  state.selectedImageIndex = Number(button.getAttribute("data-thumb-index")) || 0;
  renderSelectedListing(listingById(state.selectedListingId));
}

function onSavedGridClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const open = target.closest("[data-open-listing]");
  if (open) {
    openListing(open.getAttribute("data-open-listing"));
    return;
  }

  const remove = target.closest("[data-remove-saved]");
  if (remove) {
    void toggleFavorite(remove.getAttribute("data-remove-saved"));
  }
}

function onMyListingsClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const open = target.closest("[data-open-listing]");
  if (open) {
    openListing(open.getAttribute("data-open-listing"));
    return;
  }

  const remove = target.closest("[data-delete-listing]");
  if (!remove) return;

  const listingId = remove.getAttribute("data-delete-listing");
  if (!listingId) return;

  void deleteListing(listingId);
}

function onThreadListClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const thread = target.closest("[data-thread-id]");
  if (!thread) return;

  state.selectedThreadId = thread.getAttribute("data-thread-id");
  renderSessionState();
}

function onOpenChatListing() {
  const listingId = el.openChatListingBtn.dataset.listingId;
  if (!listingId) return;
  openListing(listingId);
}

async function onRegister(event) {
  event.preventDefault();
  const formElement = event.currentTarget;
  if (!(formElement instanceof HTMLFormElement)) return;

  const form = new FormData(formElement);
  const payload = {
    role: String(form.get("role") || "").trim(),
    name: String(form.get("name") || "").trim(),
    email: String(form.get("email") || "").trim(),
    password: String(form.get("password") || ""),
    location: String(form.get("location") || "").trim()
  };

  try {
    const { data, error } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          role: payload.role,
          name: payload.name,
          location: payload.location
        }
      }
    });
    throwIfError(error, "Could not register.");

    formElement.reset();

    if (!data.session) {
      toast("Account created. Check your email to confirm it, then log in.");
      return;
    }

    await bootstrap();
    toast(`Account created for ${payload.name}.`);
  } catch (error) {
    toast(friendlyError(error, "Could not register."));
  }
}

async function onLogin(event) {
  event.preventDefault();
  const formElement = event.currentTarget;
  if (!(formElement instanceof HTMLFormElement)) return;

  const form = new FormData(formElement);
  const payload = {
    email: String(form.get("email") || "").trim(),
    password: String(form.get("password") || "")
  };

  try {
    const { data, error } = await supabase.auth.signInWithPassword(payload);
    throwIfError(error, "Could not log in.");

    formElement.reset();
    await bootstrap();
    toast(`Logged in as ${data.user.user_metadata?.name || data.user.email || "your account"}.`);
  } catch (error) {
    toast(friendlyError(error, "Could not log in."));
  }
}

async function onOAuthSignIn(provider) {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}${window.location.pathname}`
      }
    });
    throwIfError(error, `Could not start ${provider} sign in.`);
  } catch (error) {
    toast(friendlyError(error, `Could not start ${provider} sign in.`));
  }
}

async function onLogout() {
  try {
    const { error } = await supabase.auth.signOut();
    throwIfError(error, "Could not log out.");
  } catch (error) {
    toast(friendlyError(error, "Could not log out."));
    return;
  }

  await bootstrap();
  toast("Logged out.");
}

async function onImagesSelected(event) {
  const files = Array.from(event.target.files || []).slice(0, MAX_IMAGES);

  if (!files.length) {
    state.draftImages = [];
    renderDraftImages();
    return;
  }

  try {
    state.draftImages = await Promise.all(files.map(readImageFile));
    renderDraftImages();
    toast(`${state.draftImages.length} image${state.draftImages.length === 1 ? "" : "s"} ready for upload.`);
  } catch {
    toast("Could not read one of the selected images.");
  }
}

function onImagePreviewClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const button = target.closest("[data-remove-draft]");
  if (!button) return;

  const index = Number(button.getAttribute("data-remove-draft"));
  state.draftImages = state.draftImages.filter((_, imageIndex) => imageIndex !== index);

  if (!state.draftImages.length && el.imagesInput) {
    el.imagesInput.value = "";
  }

  renderDraftImages();
}

async function onPostListing(event) {
  event.preventDefault();
  const formElement = event.currentTarget;
  if (!(formElement instanceof HTMLFormElement)) return;

  if (!state.currentUser) {
    toast("Browsing is open. Sign in to post a listing.");
    return;
  }

  const form = new FormData(formElement);
  const payload = {
    title: String(form.get("title") || "").trim(),
    category: String(form.get("category") || "").trim(),
    condition: String(form.get("condition") || "").trim(),
    price: Number(form.get("price") || 0),
    location: String(form.get("location") || "").trim(),
    description: String(form.get("description") || "").trim(),
    images: [...state.draftImages]
  };

  try {
    const { data, error } = await supabase
      .from("listings")
      .insert({
        seller_id: state.currentUser.id,
        title: payload.title,
        category: payload.category,
        condition: payload.condition,
        price: payload.price,
        location: payload.location,
        description: payload.description,
        images: sanitizeImages(payload.images)
      })
      .select("id")
      .single();
    throwIfError(error, "Could not publish listing.");

    state.selectedListingId = data.id;
    state.selectedImageIndex = 0;
    state.draftImages = [];
    if (el.imagesInput) el.imagesInput.value = "";
    formElement.reset();
    el.postNote.textContent = "Listing published to the shared marketplace.";
    await bootstrap();
    toast("Listing published.");
  } catch (error) {
    toast(friendlyError(error, "Could not publish listing."));
  }
}

async function toggleFavorite(listingId) {
  if (!listingId) return;
  if (!state.currentUser) {
    toast("Browsing is open. Sign in to save ads.");
    return;
  }

  try {
    const { data: existing, error: readError } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", state.currentUser.id)
      .eq("listing_id", listingId)
      .maybeSingle();
    throwIfError(readError, "Could not load saved ads.");

    if (existing) {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", state.currentUser.id)
        .eq("listing_id", listingId);
      throwIfError(error, "Could not remove this saved ad.");
      await bootstrap();
      toast("Removed from saved ads.");
      return;
    }

    const { error } = await supabase.from("favorites").insert({
      user_id: state.currentUser.id,
      listing_id: listingId
    });
    throwIfError(error, "Could not save this ad.");

    await bootstrap();
    toast("Saved ad.");
  } catch (error) {
    toast(friendlyError(error, "Could not update saved ads."));
  }
}

async function openChatForSelectedListing() {
  const listing = listingById(state.selectedListingId);

  if (!listing) return;
  if (!state.currentUser) {
    toast("Browsing is open. Sign in to open a chat.");
    return;
  }
  if (listing.sellerId === state.currentUser.id) {
    toast("This is your own listing.");
    return;
  }

  try {
    const { data: existing, error: existingError } = await supabase
      .from("chats")
      .select("id")
      .eq("listing_id", listing.id)
      .eq("buyer_id", state.currentUser.id)
      .eq("seller_id", listing.sellerId)
      .maybeSingle();
    throwIfError(existingError, "Could not open chat.");

    let chatId = existing?.id || "";

    if (!chatId) {
      const { data, error } = await supabase
        .from("chats")
        .insert({
          listing_id: listing.id,
          buyer_id: state.currentUser.id,
          seller_id: listing.sellerId
        })
        .select("id")
        .single();
      throwIfError(error, "Could not open chat.");
      chatId = data.id;
    }

    state.selectedThreadId = chatId;
    await bootstrap();
    document.getElementById("account")?.scrollIntoView({ behavior: "smooth", block: "start" });
    toast("Chat opened.");
  } catch (error) {
    toast(friendlyError(error, "Could not open chat."));
  }
}

async function onChatSubmit(event) {
  event.preventDefault();

  const text = el.chatInput.value.trim();
  if (!state.currentUser || !state.selectedThreadId || !text) return;

  try {
    const { error } = await supabase.from("messages").insert({
      chat_id: state.selectedThreadId,
      sender_id: state.currentUser.id,
      text
    });
    throwIfError(error, "Could not send the message.");

    el.chatInput.value = "";
    await bootstrap();
  } catch (error) {
    toast(friendlyError(error, "Could not send the message."));
  }
}

async function deleteListing(listingId) {
  try {
    const { error } = await supabase.from("listings").delete().eq("id", listingId);
    throwIfError(error, "Could not delete the listing.");

    if (state.selectedListingId === listingId) {
      state.selectedListingId = null;
      state.selectedImageIndex = 0;
    }
    await bootstrap();
    toast("Listing deleted.");
  } catch (error) {
    toast(friendlyError(error, "Could not delete the listing."));
  }
}

function openListing(listingId) {
  state.selectedListingId = listingId;
  state.selectedImageIndex = 0;
  renderListings();
  document.getElementById("marketplace")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderListingArt(listing) {
  const image = listing.images?.[0];
  const tone = toneForCategory(listing.category);

  if (image) {
    return `
      <div class="listing-art tone-${tone}">
        <img src="${escapeHtml(image)}" alt="${escapeHtml(listing.title)}" />
        <span>${escapeHtml(listing.category)}</span>
      </div>
    `;
  }

  return `
    <div class="listing-art tone-${tone}">
      <span>${escapeHtml(listing.category)}</span>
    </div>
  `;
}

function renderMiniCardImage(listing) {
  const image = listing.images?.[0];

  if (image) {
    return `<img class="mini-card-image" src="${escapeHtml(image)}" alt="${escapeHtml(listing.title)}" />`;
  }

  return `<div class="listing-art mini-card-image tone-${toneForCategory(listing.category)}"><span>${escapeHtml(listing.category)}</span></div>`;
}

function threadsForCurrentUser() {
  if (!state.currentUser) return [];

  return [...state.chats].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

function threadPartner(thread) {
  if (!state.currentUser) return null;
  const partnerId = thread.buyerId === state.currentUser.id ? thread.sellerId : thread.buyerId;
  return userById(partnerId);
}

function listingById(id) {
  return state.listings.find((listing) => listing.id === id) || null;
}

function userById(id) {
  return state.users.find((user) => user.id === id) || null;
}

function roleLabel(role) {
  return role === "company" ? "Company account" : "Customer account";
}

function categoryMark(category) {
  const map = {
    Mobiles: "MO",
    Vehicles: "VE",
    Property: "PR",
    "Electronics & Appliances": "EA",
    Furniture: "FU",
    "Fashion & Beauty": "FB",
    "Books, Sports & Hobbies": "BH",
    Jobs: "JO",
    Services: "SE",
    Pets: "PE"
  };

  return map[category] || "AD";
}

function categoryHint(category) {
  const map = {
    Mobiles: "Phones, tablets, wearables, and accessories.",
    Vehicles: "Cars, bikes, scooters, and spare parts.",
    Property: "Rooms, apartments, offices, and plots.",
    "Electronics & Appliances": "Laptops, cameras, TVs, and home appliances.",
    Furniture: "Sofas, beds, desks, and home pieces.",
    "Fashion & Beauty": "Clothing, shoes, watches, and beauty items.",
    "Books, Sports & Hobbies": "Books, fitness gear, instruments, and collectibles.",
    Jobs: "Hiring posts and work opportunities.",
    Services: "Repairs, design, delivery, and local help.",
    Pets: "Pets, accessories, food, and supplies."
  };

  return map[category] || "Browse listings in this category.";
}

function toneForCategory(category) {
  const map = {
    Mobiles: "blue",
    Vehicles: "orange",
    Property: "purple",
    "Electronics & Appliances": "blue",
    Furniture: "teal",
    "Fashion & Beauty": "rose",
    "Books, Sports & Hobbies": "teal",
    Jobs: "lime",
    Services: "orange",
    Pets: "lime"
  };

  return map[category] || "blue";
}

function buildMarketSummary(count) {
  const parts = [];

  if (state.filters.category !== "All") parts.push(state.filters.category);
  if (state.filters.location !== "All") parts.push(state.filters.location);
  if (state.filters.condition !== "All") parts.push(state.filters.condition.toLowerCase());
  if (state.filters.search) parts.push(`matching "${state.filters.search}"`);

  const scope = parts.length ? parts.join(" · ") : "All listings";
  return `${scope} · ${count} result${count === 1 ? "" : "s"} · ${sortLabel(state.filters.sort)}`;
}

function sortLabel(value) {
  if (value === "price-low") return "lowest price first";
  if (value === "price-high") return "highest price first";
  return "newest first";
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function timeAgo(value) {
  const diff = Date.now() - new Date(value).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
}

function bindButtonHover(buttons) {
  buttons.forEach((button) => {
    if (button.dataset.glowBound === "true") return;
    button.dataset.glowBound = "true";

    const resetGlow = () => {
      button.style.setProperty("--hover-x", "50%");
      button.style.setProperty("--hover-y", "50%");
      button.style.setProperty("--hover-opacity", "0");
    };

    const updateGlow = (event) => {
      const rect = button.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;

      button.style.setProperty("--hover-x", `${x}%`);
      button.style.setProperty("--hover-y", `${y}%`);
      button.style.setProperty("--hover-opacity", "1");
    };

    resetGlow();
    button.addEventListener("pointerenter", updateGlow);
    button.addEventListener("pointermove", updateGlow);
    button.addEventListener("pointerleave", resetGlow);
  });
}

function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.add("show");
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => el.toast.classList.remove("show"), 2000);
}

async function loadProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, name, location, created_at")
    .order("created_at", { ascending: false });

  throwIfError(error, "Could not load profiles.");
  return data || [];
}

async function loadListings() {
  const { data, error } = await supabase
    .from("listings")
    .select("id, seller_id, title, category, condition, price, location, description, images, created_at")
    .order("created_at", { ascending: false });

  throwIfError(error, "Could not load listings.");
  return data || [];
}

async function loadFavoriteIds(userId) {
  if (!userId) return [];

  const { data, error } = await supabase
    .from("favorites")
    .select("listing_id")
    .eq("user_id", userId);

  throwIfError(error, "Could not load saved ads.");
  return (data || []).map((row) => row.listing_id);
}

async function loadChats(userId) {
  if (!userId) return [];

  const { data: chats, error: chatsError } = await supabase
    .from("chats")
    .select("id, listing_id, buyer_id, seller_id, created_at, updated_at")
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
    .order("updated_at", { ascending: false });

  throwIfError(chatsError, "Could not load chats.");

  if (!chats?.length) return [];

  const chatIds = chats.map((chat) => chat.id);
  const { data: messages, error: messagesError } = await supabase
    .from("messages")
    .select("id, chat_id, sender_id, text, created_at")
    .in("chat_id", chatIds)
    .order("created_at", { ascending: true });

  throwIfError(messagesError, "Could not load chat messages.");

  const messagesByChat = new Map();
  (messages || []).forEach((message) => {
    const current = messagesByChat.get(message.chat_id) || [];
    current.push({
      id: message.id,
      senderId: message.sender_id,
      text: message.text,
      createdAt: message.created_at
    });
    messagesByChat.set(message.chat_id, current);
  });

  return chats.map((chat) => ({
    id: chat.id,
    listingId: chat.listing_id,
    buyerId: chat.buyer_id,
    sellerId: chat.seller_id,
    createdAt: chat.created_at,
    updatedAt: chat.updated_at,
    messages: messagesByChat.get(chat.id) || []
  }));
}

function buildCurrentUser(authUser, profile) {
  const metadata = authUser.user_metadata || {};

  return {
    id: authUser.id,
    role: profile?.role || metadata.role || "customer",
    name: profile?.name || metadata.name || authUser.email?.split("@")[0] || "JustMarket user",
    location: profile?.location || metadata.location || "Location pending",
    email: authUser.email || ""
  };
}

function mapProfile(profile) {
  return {
    id: profile.id,
    role: profile.role,
    name: profile.name,
    location: profile.location
  };
}

function mapListing(listing) {
  return {
    id: listing.id,
    sellerId: listing.seller_id,
    title: listing.title,
    category: listing.category,
    condition: listing.condition,
    price: Number(listing.price) || 0,
    location: listing.location,
    description: listing.description,
    images: sanitizeImages(listing.images),
    createdAt: listing.created_at
  };
}

function sanitizeImages(images) {
  if (!Array.isArray(images)) return [];
  return images.filter((image) => typeof image === "string" && image.startsWith("data:image/")).slice(0, MAX_IMAGES);
}

function throwIfError(error, fallbackMessage) {
  if (!error) return;
  throw new Error(error.message || fallbackMessage || "Request failed.");
}

function friendlyError(error, fallbackMessage = "Request failed.") {
  const message = error instanceof Error ? error.message : String(error || "");

  if (!message) return fallbackMessage;
  if (message.includes("relation") && message.includes("does not exist")) {
    return "Supabase setup is not finished yet. Run the SQL setup file in the Supabase SQL Editor first.";
  }
  if (message.includes("Database error saving new user")) {
    return "Account setup is incomplete. Run the Supabase SQL setup file, then try again.";
  }
  if (message.includes("Invalid login credentials")) {
    return "Invalid email or password.";
  }
  if (message.includes("Email not confirmed")) {
    return "Check your email and confirm your account before logging in.";
  }
  if (message.includes("provider is not enabled") || message.includes("Unsupported provider")) {
    return "That sign-in option is not configured in Supabase yet.";
  }
  if (message.includes("email rate limit exceeded") || message.includes("security purposes")) {
    return "Email sign-in is rate-limited right now. Use Google or Apple instead.";
  }
  if (message.includes("User already registered")) {
    return "That email is already registered.";
  }
  if (message.includes("duplicate key value")) {
    return "That record already exists.";
  }
  if (message.includes("row-level security")) {
    return "Permission denied. Finish the Supabase setup or log in again.";
  }

  return message || fallbackMessage;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const image = await compressImage(String(reader.result || ""));
        resolve(image);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function compressImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const maxSide = 1280;
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
      const width = Math.round(image.width * scale);
      const height = Math.round(image.height * scale);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("Canvas not supported"));
        return;
      }

      canvas.width = width;
      canvas.height = height;
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = reject;
    image.src = dataUrl;
  });
}
