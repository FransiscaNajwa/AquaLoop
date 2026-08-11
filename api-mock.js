function randomBetween(min, max, digits = 2) {
  return (min + Math.random() * (max - min)).toFixed(digits);
}

function updateReading(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

function pushMockData() {
  const activePond = (window.aqualoopState && window.aqualoopState.activePond) || "A";
  const profiles = window.aqualoopProfiles || {};
  const profile = profiles[activePond];

  if (!profile) return;

  const doValue = randomBetween(profile.do - 0.3, profile.do + 0.3);
  const phValue = randomBetween(profile.ph - 0.2, profile.ph + 0.2);

  updateReading("val-do", doValue);
  updateReading("val-ph", phValue);
}

document.addEventListener("DOMContentLoaded", () => {
  pushMockData();
  setInterval(pushMockData, 4000);
});
