/* ============================================================
   GRID — init
   Runs after all other scripts. Builds dynamic UI once.
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  buildChips();
  renderGrid();
  buildGiftBar();
  buildPkgs();
  buildPay();
  buildGoLive();
  refreshBal();
});
