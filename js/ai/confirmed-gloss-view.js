import {interpretConfirmedGlosses} from './gloss-language-engine.js';

/** Presentation only. The confirmed history remains untouched and authoritative. */
export function confirmedGlossView(committed) {
  const glosses = committed.map(entry => entry.label);
  const glossText = glosses.map(label => label.replaceAll('_', ' ')).join(' · ');
  let language;
  try { language = interpretConfirmedGlosses(glosses); }
  catch (error) { language = {status:'unsupported', text:null, reason:error.message}; }
  const interpretation = language.status === 'ok' ? language.text : '';
  return {glosses, glossText, interpretation, language,
    displayText:interpretation || glossText || '...',
    spokenText:interpretation || glosses.map(label => label.replaceAll('_', ' ')).join(' ')};
}
