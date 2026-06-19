import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { registerServiceWorker } from "./pwa/registerSW";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if (import.meta.env.PROD || import.meta.env.DEV) {
  registerServiceWorker({
    onRegistered: () => {
      console.info("[PWA] Service Worker 已注册，离线缓存已就绪");
    },
    onUpdateReady: () => {
      console.info("[PWA] 检测到新版本，可刷新页面以启用");
    },
    onError: (err) => {
      console.warn("[PWA] Service Worker 注册失败：", err.message);
    },
  }).catch((err) => {
    console.warn("[PWA] Service Worker 初始化失败：", err);
  });
}
