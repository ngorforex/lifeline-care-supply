const body = document.body;
const title = document.getElementById("page-title");
const crumb = document.getElementById("crumb");
const titles = {
  overview: body.dataset.portal === "admin" ? "Administrator overview" : "Good day, Investor",
  investments: "My investments",
  packages: "Investment packages",
  transactions: "Transactions",
  profile: "My profile",
  investors: "Individual investors",
  deposits: "Deposit management",
  withdrawals: "Withdrawal management",
  reports: "Reports",
  staff: "Staff & permissions",
  audit: "Audit log"
};
function activateTab(tab) {
  const panel = document.getElementById("panel-" + tab);
  if (!panel) return;
  document.querySelectorAll(".tab-panel").forEach((item) => item.classList.remove("active"));
  panel.classList.add("active");
  document.querySelectorAll(".side-nav a[data-tab]").forEach((item) => item.classList.toggle("active", item.dataset.tab === tab));
  if (title) title.textContent = titles[tab] || "Workspace";
  if (crumb) crumb.textContent = titles[tab] || "Workspace";
}
document.querySelectorAll("[data-tab]").forEach((link) => {
  link.addEventListener("click", (event) => {
    const tab = link.dataset.tab;
    if (!document.getElementById("panel-" + tab)) return;
    event.preventDefault();
    activateTab(tab);
    history.replaceState(null, "", "#" + tab);
  });
});
const initialTab = location.hash.slice(1);
if (initialTab && document.getElementById("panel-" + initialTab)) activateTab(initialTab);
document.querySelectorAll(".year").forEach((item) => item.textContent = String(new Date().getFullYear()));