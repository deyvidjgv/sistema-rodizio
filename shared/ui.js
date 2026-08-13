/* shared/ui.js - Lógica compartida de interfaz de usuario */

(function(global) {
  // Manejo centralizado de notificaciones (Toasts)
  let __toastT;
  
  global.mostrarToast = function(mensaje, duracion = 2600) {
    let t = document.getElementById("global-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "global-toast";
      document.body.appendChild(t);
    }
    
    t.className = "";
    void t.offsetWidth; // trigger reflow
    
    t.className = "toast";
    t.textContent = mensaje;
    
    clearTimeout(__toastT);
    __toastT = setTimeout(() => {
      t.className = "";
      t.textContent = "";
    }, duracion);
  };

  // Manejo de la instalación de PWA independiente por panel
  let deferredPrompt = null;

  global.actualizarBotonInstalarPWA = function() {
    const btns = document.querySelectorAll(".btn-instalar-pwa");
    btns.forEach(btn => {
      if (deferredPrompt) {
        btn.style.display = "inline-flex";
        btn.onclick = async () => {
          if (!deferredPrompt) return;
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === "accepted") {
            document.querySelectorAll(".btn-instalar-pwa").forEach(b => b.style.display = "none");
          }
          deferredPrompt = null;
        };
      } else {
        btn.style.display = "none";
      }
    });
  };

  global.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    global.actualizarBotonInstalarPWA();
  });
})(window);
