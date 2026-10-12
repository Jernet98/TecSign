/** Demo Spanish realization from already-confirmed glosses. No detector imports,
 * video, model loading, network, timers, speech or shared state.
 */
const freeze = value => {
  for (const child of Object.values(value)) if (child && typeof child === 'object') freeze(child);
  return Object.freeze(value);
};

export const DEMO_LEXICON = freeze({
  YO: { role: 'subject', text: 'yo', person: '1s' },
  NECESITAR: { role: 'verb', lemma: 'necesitar', objectRoles: ['object'] },
  DOCTOR: { role: 'object', text: 'doctor', gender: 'masculine', number: 'singular', article: 'indefinite' },
  AYUDA: { role: 'object', text: 'ayuda', gender: 'feminine', number: 'singular', article: 'none', omitFirstPerson: true },
  COMIDA: { role: 'object', text: 'comida', gender: 'feminine', number: 'singular', article: 'none' },
  TELEFONO: { role: 'object', text: 'teléfono', gender: 'masculine', number: 'singular', article: 'indefinite' },
  HOSPITAL: { role: 'object', text: 'hospital', gender: 'masculine', number: 'singular', article: 'indefinite', omitFirstPerson: true },
  DOLOR: { role: 'state', text: 'dolor', predicate: 'tener', article: 'none', omitFirstPerson: true },
  HOLA: { role: 'discourse', text: 'hola', position: 'prefix' },
  BUENOS_DIAS: { role: 'discourse', text: 'buenos días', position: 'prefix' },
  GRACIAS: { role: 'discourse', text: 'gracias', position: 'suffix' },
  POR_FAVOR: { role: 'courtesy', text: 'por favor', position: 'suffix' },
  SI: { role: 'answer', text: 'sí' },
  NO: { role: 'negation', text: 'no', standalone: 'no' },
  NO_SIGN: { role: 'blank' },
});

export const DEMO_CONJUGATIONS = freeze({
  necesitar: { '1s': 'necesito', '2s': 'necesitas', '3s': 'necesita', '1p': 'necesitamos', impersonal: 'se necesita' },
  tener: { '1s': 'tengo', '2s': 'tienes', '3s': 'tiene', '1p': 'tenemos', impersonal: 'hay' },
});

export const DEMO_ARTICLES = freeze({
  indefinite: { masculine: { singular: 'un', plural: 'unos' }, feminine: { singular: 'una', plural: 'unas' } },
  definite: { masculine: { singular: 'el', plural: 'los' }, feminine: { singular: 'la', plural: 'las' } },
});

// Explicit demo conventions, configurable without changing recognition or
// adding phrase-specific branches. An omitted subject means the speaker here.
export const DEMO_STYLE = freeze({ implicitPerson: '1s', joinGreeting: ', ', omitFirstPersonAfterGreeting: true });

// Optional slots are still consumed in sequence. Every confirmed token must be
// accounted for; unsupported order/words never receive a guessed translation.
export const DEMO_GRAMMAR = freeze([
  { id: 'subject-verb-object', slots: [{ name: 'subject', role: 'subject', optional: true },
    { name: 'negation', role: 'negation', optional: true }, { name: 'verb', role: 'verb' },
    { name: 'object', role: 'object' }], realization: 'predicate' },
  { id: 'subject-state', slots: [{ name: 'subject', role: 'subject', optional: true },
    { name: 'negation', role: 'negation', optional: true }, { name: 'state', role: 'state' }], realization: 'predicate' },
  { id: 'answer', slots: [{ name: 'answer', roles: ['answer', 'negation'] }], realization: 'standalone' },
  { id: 'subject-only', slots: [{ name:'subject',role:'subject' }],realization:'subject' },
  { id: 'unfinished-verb', slots: [{name:'subject',role:'subject',optional:true},{name:'verb',role:'verb'}],realization:'unfinished',complete:false,ending:'...' },
]);

const labelKey = value => value.normalize('NFKC').trim().toLocaleUpperCase('es-MX')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC').replace(/\s+/g, '_');
const sentence = (value,ending='.') => value ? value[0].toLocaleUpperCase('es-MX') + value.slice(1) + ending : '';

export function normalizeGlosses(glosses, lexicon = DEMO_LEXICON) {
  if (!Array.isArray(glosses) || !glosses.every(g => typeof g === 'string' && g.trim())) {
    throw new TypeError('Expected an array of non-empty, already-confirmed gloss strings');
  }
  if (glosses.length > 64) throw new RangeError('At most 64 glosses per explicit utterance');
  const entries = glosses.map((input, index) => {
    const gloss = labelKey(input);
    return { input, index, gloss, lexeme: lexicon[gloss] ?? null };
  });
  return {
    entries: entries.filter(e => e.lexeme?.role !== 'blank'),
    glosses: entries.filter(e => e.lexeme?.role !== 'blank').map(e => e.gloss),
    ignored: entries.filter(e => e.lexeme?.role === 'blank').map(({ input, index, gloss }) => ({ input, index, gloss })),
    unknownGlosses: entries.filter(e => !e.lexeme).map(e => e.gloss),
  };
}

/** Explicit adapters, not a claim that the external training vocabularies match.
 * Uppercase/lowercase OPUS variants were both experimentally tested. MSLG-SPA
 * is the inspected code's surface convention; its trained adapter is absent.
 */
export function buildPublicModelInput(glosses, format = 'opus-uppercase') {
  const normalized = normalizeGlosses(glosses);
  if (normalized.unknownGlosses.length) throw new RangeError('Unmapped glosses: ' + normalized.unknownGlosses.join(', '));
  const formats = {
    'opus-uppercase': tokens => tokens.join(' '),
    'opus-lowercase': tokens => tokens.join(' ').toLocaleLowerCase('es-MX'),
    'mslg-spa-baseline': tokens => tokens.join(' '),
  };
  if (!formats[format]) throw new RangeError('Unknown public translator format: ' + format);
  // POR_FAVOR is a TecSign class ID, not an external tokenizer token. The
  // provisional mapping is POR FAVOR, with no unverified DOCTOR→MÉDICO synonym.
  return formats[format](normalized.glosses.flatMap(g => g === 'POR_FAVOR' ? ['POR', 'FAVOR'] : [g]));
}

function match(rule, entries) {
  let cursor = 0;
  const slots = {};
  for (const slot of rule.slots) {
    const entry = entries[cursor];
    if (entry && (slot.roles ?? [slot.role]).includes(entry.lexeme.role)) {
      slots[slot.name] = entry.lexeme;
      cursor++;
    } else if (!slot.optional) return null;
  }
  return cursor === entries.length ? slots : null;
}

export function createGlossLanguageEngine({ lexicon = {}, conjugations = {}, articles = {}, grammar = DEMO_GRAMMAR, style = {} } = {}) {
  const vocabulary = { ...DEMO_LEXICON, ...lexicon };
  const verbs = Object.fromEntries(Object.entries({ ...DEMO_CONJUGATIONS, ...conjugations })
    .map(([lemma, forms]) => [lemma, { ...DEMO_CONJUGATIONS[lemma], ...forms }]));
  const determiners = { ...DEMO_ARTICLES, ...articles };
  const realizationStyle = { ...DEMO_STYLE, ...style };

  function interpretConfirmedGlosses(glosses) {
    const normalized = normalizeGlosses(glosses, vocabulary);
    const base = { engine: 'declarative-demo-v1', input: [...glosses], glosses: normalized.glosses,
      ignored: normalized.ignored, unknownGlosses: normalized.unknownGlosses, assumptions: [] };
    if (normalized.unknownGlosses.length) return { ...base, status: 'unsupported', text: null, reason: 'UNKNOWN_GLOSS' };
    if (!normalized.entries.length) return { ...base, status: 'empty', text: '', reason: 'NO_CONTENT' };
    const core = [...normalized.entries], before = [], after = [];
    while (core[0]?.lexeme.role === 'discourse' && core[0].lexeme.position === 'prefix') before.push(core.shift().lexeme.text);
    while (core.at(-1)?.lexeme.position === 'suffix') after.unshift(core.pop().lexeme);
    const clauses = [];
    if (core.length) {
      const selected = grammar.map(rule => ({ rule, slots: match(rule, core) })).find(result => result.slots);
      if (!selected) return { ...base, status: 'unsupported', text: null, reason: 'UNSUPPORTED_GRAMMAR' };
      const { rule, slots } = selected;
      let words;
      if (rule.realization === 'standalone') words = [slots.answer.standalone ?? slots.answer.text];
      else if (rule.realization === 'subject') words = [slots.subject.text];
      else if (rule.realization === 'unfinished') {
        words=[slots.subject?.text,verbs[slots.verb.lemma]?.[slots.subject?.person ?? realizationStyle.implicitPerson]].filter(Boolean);
        base.assumptions.push('Fragmento confirmado todavía sin objeto; no se completa el contenido faltante.');
      }
      else {
        const predicate = slots.verb?.lemma ?? slots.state?.predicate;
        const person = slots.subject?.person ?? realizationStyle.implicitPerson;
        const verb = verbs[predicate]?.[person];
        const object = slots.object ?? slots.state;
        if (!verb || !object || (slots.verb && !slots.verb.objectRoles.includes(object.role))) {
          return { ...base, status: 'unsupported', text: null, reason: 'MISSING_REALIZATION' };
        }
        const article = object.article === 'none' ? '' : determiners[object.article]?.[object.gender]?.[object.number];
        if (article === undefined) return { ...base, status: 'unsupported', text: null, reason: 'MISSING_ARTICLE' };
        const omitSubject = slots.subject?.person === '1s' && (object.omitFirstPerson ||
          (before.length && realizationStyle.omitFirstPersonAfterGreeting));
        words = [omitSubject ? null : slots.subject?.text, slots.negation?.text, verb, article, object.text].filter(Boolean);
        if (!slots.subject) base.assumptions.push('Convención de demo: sin sujeto explícito se interpreta al hablante en primera persona singular.');
        if (omitSubject) base.assumptions.push('Se omite el pronombre YO en español; la conjugación conserva la primera persona.');
        if (slots.state) base.assumptions.push(`La lectura de ${slots.state.text} como estado añade ${predicate} en presente para la demo.`);
        base.assumptions.push('Tiempo presente por defecto; estas glosas no codifican tiempo verbal.');
      }
      const courtesy = after.filter(e => e.role === 'courtesy').map(e => e.text);
      const greeting = before.length ? before.join(realizationStyle.joinGreeting) + realizationStyle.joinGreeting : '';
      clauses.push(sentence(greeting + words.join(' ') + (courtesy.length ? ', ' + courtesy.join(', ') : ''),rule.ending || '.'));
      base.grammar = rule.id;
      base.complete = rule.complete !== false;
    } else {
      clauses.push(...before.map(value => sentence(value)));
      // A courtesy without a clause remains an independent phrase.
      clauses.push(...after.filter(e => e.role === 'courtesy').map(e => sentence(e.text)));
    }
    clauses.push(...after.filter(e => e.role === 'discourse').map(e => sentence(e.text)));
    return { ...base, status: 'ok', text: clauses.join(' ') };
  }

  return { interpretConfirmedGlosses, toSpanish: glosses => interpretConfirmedGlosses(glosses).text };
}

const demoEngine = createGlossLanguageEngine();
export const interpretConfirmedGlosses = glosses => demoEngine.interpretConfirmedGlosses(glosses);
export const glossesToSpanish = glosses => demoEngine.toSpanish(glosses);
