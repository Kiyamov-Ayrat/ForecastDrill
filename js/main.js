// main.js — точка входа: подключение переключателя темы и первый рендер

$('themeBtn').addEventListener('click', () => {
  const d = document.documentElement;
  d.dataset.theme = d.dataset.theme === 'dark' ? '' : 'dark';
});

render();
