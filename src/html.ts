export const esc = (text = "") => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
