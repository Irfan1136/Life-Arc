// Runs before the app. If the app cannot start (or crashes to a blank screen) show a Reload button instead of a frozen page.
(function () {
  var root = document.getElementById("root");
  function recover(msg) {
    if (document.getElementById("la-recover")) return;
    var d = document.createElement("div");
    d.id = "la-recover"; d.setAttribute("role", "alert");
    d.innerHTML = '<div><h2>Something went wrong</h2><p></p><button id="la-reload">Reload</button></div>';
    d.querySelector("p").textContent = msg;
    document.body.appendChild(d);
    document.getElementById("la-reload").onclick = function () { location.reload(); };
  }
  setTimeout(function () { if (root && root.querySelector(".boot-sk")) recover("The app is taking longer than usual to start."); }, 8000);
  window.addEventListener("error", function () {
    setTimeout(function () {
      if (root && !root.firstElementChild) recover("The app stopped unexpectedly.");
      else if (root && root.querySelector(".boot-sk")) recover("The app could not start.");
    }, 400);
  });
})();
