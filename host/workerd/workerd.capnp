# workerd config. Paths are relative to this file; deploy.sh installs it in the app directory.
using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [
    (name = "budokan", worker = .budokan),
    (name = "store", disk = (path = "data", writable = true)),
    (name = "public", disk = (path = "public")),
    (name = "internet", network = (allow = ["public"], tlsOptions = (trustBrowserCas = true))),
  ],
  # Loopback only: a reverse proxy terminates TLS in front.
  sockets = [(name = "http", address = "127.0.0.1:8790", http = (), service = "budokan")],
);

const budokan :Workerd.Worker = (
  modules = [(name = "worker.js", esModule = embed "worker.js")],
  compatibilityDate = "2026-09-01",
  bindings = [(name = "STORE", service = "store"), (name = "PUBLIC", service = "public")],
  globalOutbound = "internet",
);
