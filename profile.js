import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://fbukkqomytzoilxxvpef.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_YSGF9y8LHX6qeb-9J1aKwg_jrw4utyQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});

const state = {
  currentUser: null
};

const el = {
  guestState: document.getElementById("guestState"),
  profileLayout: document.getElementById("profileLayout"),
  profileSessionBadge: document.getElementById("profileSessionBadge"),
  logoutBtn: document.getElementById("logoutBtn"),
  profileName: document.getElementById("profileName"),
  profileSubtitle: document.getElementById("profileSubtitle"),
  summaryEmail: document.getElementById("summaryEmail"),
  summaryRole: document.getElementById("summaryRole"),
  summaryLocation: document.getElementById("summaryLocation"),
  summaryJoined: document.getElementById("summaryJoined"),
  profileForm: document.getElementById("profileForm"),
  profileNameInput: document.getElementById("profileNameInput"),
  profileLocationInput: document.getElementById("profileLocationInput"),
  profileRoleInput: document.getElementById("profileRoleInput"),
  currentEmailInput: document.getElementById("currentEmailInput"),
  emailForm: document.getElementById("emailForm"),
  providerInput: document.getElementById("providerInput"),
  passwordForm: document.getElementById("passwordForm"),
  toast: document.getElementById("toast")
};

el.logoutBtn?.addEventListener("click", () => void onLogout());
el.profileForm?.addEventListener("submit", onProfileSave);
el.emailForm?.addEventListener("submit", onEmailSave);
el.passwordForm?.addEventListener("submit", onPasswordSave);

bindButtonHover(document.querySelectorAll(".button, .button-secondary, .button-ghost"));
void bootstrap();

async function bootstrap() {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    throwIfError(sessionError, "Could not load your session.");

    const authUser = sessionData.session?.user || null;
    if (!authUser) {
      renderGuest();
      return;
    }

    const profile = await loadProfile(authUser.id);
    state.currentUser = buildCurrentUser(authUser, profile);
    renderProfile();
  } catch (error) {
    renderGuest();
    toast(friendlyError(error, "Could not load your profile."));
  }
}

async function onProfileSave(event) {
  event.preventDefault();
  if (!(event.currentTarget instanceof HTMLFormElement) || !state.currentUser) return;

  const form = new FormData(event.currentTarget);
  const name = String(form.get("name") || "").trim();
  const location = String(form.get("location") || "").trim();

  if (!name || !location) {
    toast("Name and location are required.");
    return;
  }

  try {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ name, location })
      .eq("id", state.currentUser.id);
    throwIfError(profileError, "Could not update your profile.");

    const { error: authError } = await supabase.auth.updateUser({
      data: {
        role: state.currentUser.role,
        name,
        location
      }
    });
    throwIfError(authError, "Could not update your profile.");

    state.currentUser = {
      ...state.currentUser,
      name,
      location
    };
    renderProfile();
    toast("Profile updated.");
  } catch (error) {
    toast(friendlyError(error, "Could not update your profile."));
  }
}

async function onEmailSave(event) {
  event.preventDefault();
  const formElement = event.currentTarget;
  if (!(formElement instanceof HTMLFormElement) || !state.currentUser) return;

  const form = new FormData(formElement);
  const nextEmail = String(form.get("email") || "").trim().toLowerCase();

  if (!nextEmail) {
    toast("Enter a new email address.");
    return;
  }

  if (nextEmail === state.currentUser.email.toLowerCase()) {
    toast("That email is already on your account.");
    return;
  }

  try {
    const { error } = await supabase.auth.updateUser({ email: nextEmail });
    throwIfError(error, "Could not update your email.");

    formElement.reset();
    toast("Email change requested. Check your inbox to confirm it.");
  } catch (error) {
    toast(friendlyError(error, "Could not update your email."));
  }
}

async function onPasswordSave(event) {
  event.preventDefault();
  const formElement = event.currentTarget;
  if (!(formElement instanceof HTMLFormElement)) return;

  const form = new FormData(formElement);
  const password = String(form.get("password") || "");
  const confirmPassword = String(form.get("confirmPassword") || "");

  if (password.length < 6) {
    toast("Password must be at least 6 characters.");
    return;
  }

  if (password !== confirmPassword) {
    toast("Passwords do not match.");
    return;
  }

  try {
    const { error } = await supabase.auth.updateUser({ password });
    throwIfError(error, "Could not update your password.");

    formElement.reset();
    toast("Password updated.");
  } catch (error) {
    toast(friendlyError(error, "Could not update your password."));
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

  window.location.href = "./index.html";
}

function renderGuest() {
  el.guestState.hidden = false;
  el.profileLayout.hidden = true;
  el.logoutBtn.hidden = true;
  el.profileSessionBadge.textContent = "Profile";
}

function renderProfile() {
  const user = state.currentUser;
  if (!user) {
    renderGuest();
    return;
  }

  el.guestState.hidden = true;
  el.profileLayout.hidden = false;
  el.logoutBtn.hidden = false;
  el.profileSessionBadge.textContent = `${user.name} · Profile`;
  el.profileName.textContent = user.name;
  el.profileSubtitle.textContent = `${roleLabel(user.role)} account · ${providerLabel(user.provider)} sign-in`;
  el.summaryEmail.textContent = user.email || "-";
  el.summaryRole.textContent = roleLabel(user.role);
  el.summaryLocation.textContent = user.location;
  el.summaryJoined.textContent = formatDate(user.createdAt);
  el.profileNameInput.value = user.name;
  el.profileLocationInput.value = user.location;
  el.profileRoleInput.value = roleLabel(user.role);
  el.currentEmailInput.value = user.email || "";
  el.providerInput.value = providerLabel(user.provider);
}

async function loadProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, name, location, created_at")
    .eq("id", userId)
    .maybeSingle();

  throwIfError(error, "Could not load your profile.");
  return data;
}

function buildCurrentUser(authUser, profile) {
  const metadata = authUser.user_metadata || {};
  const provider = authUser.app_metadata?.provider || authUser.identities?.[0]?.provider || "email";

  return {
    id: authUser.id,
    email: authUser.email || "",
    role: profile?.role || metadata.role || "customer",
    name: profile?.name || metadata.name || authUser.email?.split("@")[0] || "JustMarket user",
    location: profile?.location || metadata.location || "Location pending",
    provider,
    createdAt: profile?.created_at || authUser.created_at || new Date().toISOString()
  };
}

function roleLabel(role) {
  return role === "company" ? "Company" : "Customer";
}

function providerLabel(provider) {
  if (provider === "google") return "Google";
  if (provider === "apple") return "Apple";
  return "Email";
}

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function throwIfError(error, fallbackMessage) {
  if (!error) return;
  throw new Error(error.message || fallbackMessage || "Request failed.");
}

function friendlyError(error, fallbackMessage = "Request failed.") {
  const message = error instanceof Error ? error.message : String(error || "");

  if (!message) return fallbackMessage;
  if (message.includes("Auth session missing")) {
    return "Sign in again, then retry this action.";
  }
  if (message.includes("Email rate limit exceeded")) {
    return "Too many email requests. Wait a little, then try again.";
  }
  if (message.includes("same as the old password")) {
    return "Choose a new password that is different from the old one.";
  }
  if (message.includes("Password should be at least")) {
    return "Password must be at least 6 characters.";
  }
  if (message.includes("Unable to validate email address")) {
    return "Enter a valid email address.";
  }

  return message || fallbackMessage;
}

function bindButtonHover(buttons) {
  buttons.forEach((button) => {
    if (!(button instanceof HTMLElement) || button.dataset.glowBound === "true") return;
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
  clearTimeout(toast.timeoutId);
  toast.timeoutId = setTimeout(() => el.toast.classList.remove("show"), 2200);
}
