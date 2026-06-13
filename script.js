const toggle = document.querySelector('.nav-toggle');
const menu = document.querySelector('#menu');

if (toggle && menu) {
  toggle.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();

const emailLink = document.querySelector('#email-link');
if (emailLink) {
  const address = `${emailLink.dataset.user}@${emailLink.dataset.domain}`;
  emailLink.href = `mailto:${address}`;
  emailLink.textContent = 'E-mail';
}
