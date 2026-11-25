(() => {
  const form = document.getElementById("admin-login");
  const errorBox = document.getElementById("error");
  if (!form || !errorBox) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.textContent = "";
    const emailField = form.elements.namedItem("email");
    const passwordField = form.elements.namedItem("password");
    const button = form.querySelector('button[type="submit"]');
    if (!emailField || !passwordField || !button) {
      errorBox.textContent = "The sign-in form could not be initialized. Refresh the page and try again.";
      return;
    }

    const email = emailField.value.trim();
    const password = passwordField.value;
    if (!email || !password) {
      errorBox.textContent = "Enter your administrator email and password.";
      return;
    }

    button.disabled = true;
    button.textContent = "Verifying access…";
    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const raw = await response.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; }
      catch { throw new Error("The account service returned an invalid response. Refresh and try again."); }

      if (!response.ok) {
        if (response.status === 401) throw new Error("The administrator email or password does not match the registered account.");
        if (response.status === 429) throw new Error(data.error || "Too many attempts. Wait 15 minutes before trying again.");
        throw new Error(data.error || "Sign-in could not be completed. Please try again.");
      }

      const check = await fetch("/api/admin/auth/me", { credentials: "same-origin", cache: "no-store" });
      if (!check.ok) throw new Error("Credentials were accepted, but the secure session was not established. Check that cookies are enabled and try again.");
      location.replace("/admin/");
    } catch (e) {
      errorBox.textContent = e.message || "Unable to sign in. Please try again.";
      button.disabled = false;
      button.textContent = "Sign in securely";
    }
  });
})();