(function () {
  let count = 0;
  const timers = new Map();
  const escape = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  window.Notify = {
    create({
      type = "message",
      title = "",
      bodyHtml = "",
      footerHtml = "",
      persistent = false,
      duration = 5000,
      id,
    } = {}) {
      const uid = id || "notice-" + ++count;
      this.remove(uid, true);
      const card = document.createElement("article");
      card.className = "toast " + type;
      card.id = uid;
      card.innerHTML = `<button class="toast-close" aria-label="알림 닫기">×</button><strong>${escape(title)}</strong><div class="toast-body">${bodyHtml}</div>${footerHtml ? `<footer>${footerHtml}</footer>` : ""}`;
      card.querySelector("button").onclick = () => this.remove(uid);
      document.getElementById("notifications").append(card);
      if (!persistent)
        timers.set(
          uid,
          setTimeout(() => this.remove(uid), duration),
        );
      return uid;
    },
    update(uid, bodyHtml) {
      const el = document.getElementById(uid);
      if (el) el.querySelector(".toast-body").innerHTML = bodyHtml;
    },
    remove(uid, immediate = false) {
      clearTimeout(timers.get(uid));
      timers.delete(uid);
      const el = document.getElementById(uid);
      if (!el) return;
      if (immediate) {
        el.remove();
        return;
      }
      el.style.height = el.offsetHeight + "px";
      requestAnimationFrame(() => {
        el.classList.add("leaving");
        setTimeout(() => el.remove(), 260);
      });
    },
  };
})();
