'use strict';
// About dialog: version number and the build log (web/CHANGELOG.md, rendered as plain DOM).

$('verTag').textContent = 'v' + APP_VERSION;
$('aboutVer').textContent = 'Version ' + APP_VERSION;

const aboutDlg = $('about');
let changelogLoaded = false;

function renderChangelog(md) {
  const root = $('changelog');
  root.textContent = '';
  let list = null;
  md.split('\n').forEach(line => {
    let m;
    if ((m = /^## \[(.+?)\](?: - (.+))?$/.exec(line))) {
      if (m[1] === 'Unreleased') return;
      const h = document.createElement('h4');
      h.textContent = m[1] + (m[2] ? '  ·  ' + m[2] : '');
      root.appendChild(h); list = null;
    } else if ((m = /^### (.+)$/.exec(line))) {
      const h = document.createElement('h5');
      h.textContent = m[1];
      root.appendChild(h); list = null;
    } else if ((m = /^- (.+)$/.exec(line))) {
      if (!list) { list = document.createElement('ul'); root.appendChild(list); }
      const li = document.createElement('li');
      li.textContent = m[1];
      list.appendChild(li);
    }
  });
}

async function openAbout() {
  aboutDlg.showModal();
  if (changelogLoaded) return;
  try {
    const res = await fetch('CHANGELOG.md', { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    renderChangelog(await res.text());
    changelogLoaded = true;
  } catch {
    $('changelog').textContent = 'Build log unavailable offline.';
  }
}

$('aboutBtn').onclick = openAbout;
$('aboutClose').onclick = () => aboutDlg.close();
aboutDlg.addEventListener('click', e => { if (e.target === aboutDlg) aboutDlg.close(); }); // click the backdrop
