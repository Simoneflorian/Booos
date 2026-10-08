// Kleiner, sicherer Markdown-Renderer für KI-Antworten: erst alles escapen, dann wenige Formate erlauben.

function escape(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inline(text) {
  let t = escape(text);
  t = t.replace(/\[(Offiziell|Beratung|Forum)\]/g, (_, art) => `<span class="badge tag-${art.toLowerCase()}">${art}</span>`);
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  t = t.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');
  return t;
}

export function markdownZuHtml(md) {
  const zeilen = String(md || '').replace(/\r/g, '').split('\n');
  const html = [];
  let liste = null;
  let absatz = [];
  const absatzEnde = () => {
    if (absatz.length) html.push(`<p>${absatz.map(inline).join('<br>')}</p>`);
    absatz = [];
  };
  const listeEnde = () => {
    if (liste) html.push(`</${liste}>`);
    liste = null;
  };
  for (const zeile of zeilen) {
    const ueberschrift = /^(#{1,4})\s+(.*)$/.exec(zeile);
    const punkt = /^\s*[-*•]\s+(.*)$/.exec(zeile);
    const nummer = /^\s*\d+[.)]\s+(.*)$/.exec(zeile);
    if (ueberschrift) {
      absatzEnde(); listeEnde();
      const stufe = Math.min(4, ueberschrift[1].length + 1);
      html.push(`<h${stufe}>${inline(ueberschrift[2])}</h${stufe}>`);
    } else if (punkt || nummer) {
      absatzEnde();
      const art = punkt ? 'ul' : 'ol';
      if (liste !== art) { listeEnde(); html.push(`<${art}>`); liste = art; }
      html.push(`<li>${inline((punkt || nummer)[1])}</li>`);
    } else if (/^\s*(---|\*\*\*)\s*$/.test(zeile)) {
      absatzEnde(); listeEnde(); html.push('<hr>');
    } else if (!zeile.trim()) {
      absatzEnde(); listeEnde();
    } else {
      listeEnde();
      absatz.push(zeile.trim());
    }
  }
  absatzEnde(); listeEnde();
  return html.join('\n');
}
