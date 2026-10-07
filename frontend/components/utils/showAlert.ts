import { Alert, Platform } from "react-native";

export function showAlert(title: string, message?: string) {
    const safeTitle = title?.trim() || "Error";
    const safeMessage = message?.trim() || "";

    // AllergyGenie-styled dialog on web, where window.alert cannot be themed.
    if (Platform.OS === "web") {
        document.getElementById('allergygenie-alert-backdrop')?.remove();
        const isError = /error|failed|invalid|denied/i.test(safeTitle);
        const accent = isError ? '#ef4444' : '#0d8fa1';
        const tint = isError ? '#fff1f2' : '#e8f8fa';
        const border = isError ? '#fecdd3' : '#b2e4eb';

        const backdrop = document.createElement('div');
        backdrop.id = 'allergygenie-alert-backdrop';
        backdrop.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(14,34,68,.44);backdrop-filter:blur(4px)';

        const card = document.createElement('section');
        card.setAttribute('role', 'alertdialog');
        card.setAttribute('aria-modal', 'true');
        card.setAttribute('aria-labelledby', 'allergygenie-alert-title');
        card.style.cssText = 'position:relative;box-sizing:border-box;width:min(100%,420px);overflow:hidden;padding:30px 32px 28px;border:1px solid #c9dde2;border-radius:22px;background:linear-gradient(180deg,#ffffff 0%,#f8fcfd 100%);box-shadow:0 24px 70px rgba(14,34,68,.25);font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;text-align:center';

        const accentBar = document.createElement('div');
        accentBar.style.cssText = `position:absolute;top:0;left:0;right:0;height:5px;background:${accent}`;

        const brand = document.createElement('div');
        brand.textContent = 'ALLERGYGENIE  ·  NOTIFICATION';
        brand.style.cssText = 'margin:0 0 20px;color:#0d8fa1;font-size:10px;font-weight:800;letter-spacing:1.7px';

        const icon = document.createElement('div');
        icon.textContent = isError ? '!' : '✓';
        icon.style.cssText = `display:flex;width:62px;height:62px;margin:0 auto 17px;align-items:center;justify-content:center;border:1px solid ${border};border-radius:50%;background:${tint};color:${accent};font-size:30px;font-weight:800;box-shadow:0 6px 18px ${isError ? 'rgba(239,68,68,.12)' : 'rgba(13,143,161,.12)'}`;

        const heading = document.createElement('h2');
        heading.id = 'allergygenie-alert-title';
        heading.textContent = safeTitle;
        heading.style.cssText = 'margin:0;color:#0e2244;font-size:22px;font-weight:800;line-height:1.3';

        const detail = document.createElement('p');
        detail.textContent = safeMessage;
        detail.style.cssText = 'margin:11px 0 24px;color:#475569;font-size:15px;line-height:1.6;white-space:pre-line';

        const close = () => backdrop.remove();
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Got it';
        button.style.cssText = `min-width:132px;padding:12px 25px;border:0;border-radius:999px;background:${accent};color:#fff;font-size:14px;font-weight:800;letter-spacing:.2px;cursor:pointer;box-shadow:0 7px 18px ${isError ? 'rgba(239,68,68,.22)' : 'rgba(13,143,161,.24)'}`;
        button.addEventListener('click', close);
        backdrop.addEventListener('click', event => {
            if (event.target === backdrop) close();
        });
        card.append(accentBar, brand, icon, heading, detail, button);
        backdrop.append(card);
        document.body.append(backdrop);
        button.focus();
        return;
    }

    // Native (iOS / Android)
    Alert.alert(safeTitle, safeMessage);
}
