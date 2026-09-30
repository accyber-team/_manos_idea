// Comportamento comum: dropdowns Fomantic, selects com envio automático e abas das quebras.
(function ($) {
  $('.ui.dropdown').dropdown();
  $('.auto-submit').on('change', function () { this.form && this.form.submit(); });
  $('.breakdown-tabs .item').tab();
  // Botão "Recarregar" volta para a página atual.
  $('form[action="/recarregar"] input[name="back"]').val(location.pathname + location.search);
})(window.jQuery);
