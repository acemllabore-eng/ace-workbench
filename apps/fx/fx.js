/* Survey Unit – Masbate: shared effects layer (see fx.css). Added to each app by the panel; safe to load twice.
   An app that draws its own effects sets <html data-fx="own"> and is left alone. Turn off per device with
   localStorage "aw.fx" = "off" (the panel's Effects button does this). */
(function () {
  var d = document, root = d.documentElement;
  if (root.dataset.fx === "own" || root.dataset.fxOn) return;
  try { if (localStorage.getItem("aw.fx") === "off") return; } catch (e) {}
  root.dataset.fxOn = "1";
  var still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function start() {
    if (!d.body) return setTimeout(start, 30);
    root.classList.add("aw-fx-in");
    var top = d.createElement("div"); top.id = "aw-fx-top"; top.setAttribute("aria-hidden", "true"); top.innerHTML = "<i></i>";
    d.body.appendChild(top);
    if (still) return;
    if (matchMedia("(pointer: fine)").matches) {
      var glow = d.createElement("div"); glow.id = "aw-fx-glow"; glow.setAttribute("aria-hidden", "true");
      d.body.appendChild(glow);
      var raf = 0, x = 0, y = 0;
      d.addEventListener("pointermove", function (e) {
        x = e.clientX; y = e.clientY;
        if (!raf) raf = requestAnimationFrame(function () { raf = 0; glow.style.transform = "translate(" + x + "px," + y + "px)"; glow.classList.add("on"); });
      }, { passive: true });
      d.addEventListener("pointerleave", function () { glow.classList.remove("on"); });
    }
    d.addEventListener("pointerdown", function (e) {
      var t = e.target && e.target.closest && e.target.closest("button,.btn,[role=button],a[href],summary,.tab,.pill,.chip");
      if (!t || t.disabled) return;
      var r = d.createElement("span"); r.className = "aw-fx-rip";
      r.style.left = e.clientX + "px"; r.style.top = e.clientY + "px";
      d.body.appendChild(r); setTimeout(function () { r.remove(); }, 600);
    }, { passive: true });
  }
  start();
})();
