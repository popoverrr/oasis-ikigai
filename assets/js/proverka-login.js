// v24: «Показать пароль» на входе в проверку каталога
document.getElementById('pw-show')?.addEventListener('change', e => {
  document.getElementById('pw').type = e.target.checked ? 'text' : 'password';
});
