// ====================================================================
// TecSign — ia_razonador.js  (razonador con memoria y explicación)
// - Mantiene prototipos por letra (centroides + varianza por feature)
// - Similaridad (coseno) y distancia tipo-Mahalanobis (ligera)
// - kNN sobre memoria cruda como respaldo (few-shot)
// - API: Reasoner.load(mem), Reasoner.predict(vec), Reasoner.learn(letter, vec)
// ====================================================================

const Reasoner = (() => {
  const CLASSES = "A,B,C,D,E,F,G,H,I,J,K,L,M,N,Ñ,O,P,Q,R,S,T,U,V,W,X,Y,Z".split(",");
  const D = 63;                     // 21*3
  const K = 5;                      // k-NN
  const MAX_SAMPLES = 400;          // tope de memoria “cruda”
  const EPS = 1e-8;

  // ---- Estado ----
  const proto = {};   // {A:{mean:Float32Array(D), var:Float32Array(D), n:int}, ...}
  const bank  = [];   // [{letter, vec:Float32Array(D)}...]

  // ---- Utils ----
  function _toFloat(a){ return (a instanceof Float32Array)? a : new Float32Array(a); }
  function _norm(v){ let s=0; for(let i=0;i<D;i++) s += v[i]*v[i]; return Math.sqrt(s)+EPS; }
  function _cos(a,b){
    let s=0; for(let i=0;i<D;i++) s += a[i]*b[i];
    return s / (_norm(a)*_norm(b));
  }
  function _mahalanobis(x, mean, vari){
    // d^2 = Σ ((x-μ)^2 / (σ^2 + EPS))
    let s=0; for(let i=0;i<D;i++){ const d=x[i]-mean[i]; s += (d*d)/(vari[i]+EPS); }
    return Math.sqrt(s);
  }

  function _initLetter(L){
    if (proto[L]) return;
    proto[L] = { mean:new Float32Array(D), var:new Float32Array(D), n:0 };
  }

  // ---- API ----
  function load(memory){
    // memory: { prototypes: {A:{mean:[..], var:[..], n}}, samples:[{letter, vec:[..]}] }
    if (memory?.prototypes){
      for (const L of Object.keys(memory.prototypes)){
        _initLetter(L);
        const p = memory.prototypes[L];
        proto[L].mean.set(_toFloat(p.mean));
        proto[L].var.set(_toFloat(p.var));
        proto[L].n = p.n|0;
      }
    }
    if (memory?.samples){
      for (const s of memory.samples){
        bank.push({ letter:s.letter, vec:_toFloat(s.vec) });
      }
    }
    console.log('[Reasoner] memoria cargada:',
      Object.keys(proto).length, 'letras,', bank.length, 'ejemplos');
  }

  function learn(letter, vec){
    const v = _toFloat(vec);
    _initLetter(letter);
    // actualización online de mean/var (Welford simplificado feature-wise)
    const P = proto[letter];
    const n0 = P.n;
    const n1 = ++P.n;
    for (let i=0;i<D;i++){
      const m0 = P.mean[i];
      const delta = v[i] - m0;
      const m1 = m0 + delta/n1;
      const delta2 = v[i] - m1;
      // actualizar var como var de población aproximada
      P.var[i] = (n0===0) ? 0 : ( (n0*P.var[i] + delta*delta2) / n1 );
      P.mean[i] = m1;
    }
    // añade a banco (con límite)
    bank.push({ letter, vec:v });
    if (bank.length > MAX_SAMPLES) bank.shift();
  }

  function predict(vec){
    const x = _toFloat(vec);

    // 1) Score por prototipos (coseno ↑, mahalanobis ↓)
    let bestL=null, bestScore=-1, bestWhy=null;
    for (const L of CLASSES){
      const P = proto[L]; if (!P || P.n===0) continue;
      const cos = _cos(x, P.mean);
      const dmh = _mahalanobis(x, P.mean, P.var);
      // score combinado (ajusta pesos si quieres)
      const score = 0.7*(cos) + 0.3*(1/(1+dmh));
      if (score > bestScore){
        bestScore = score; bestL = L; bestWhy = {cos:+cos.toFixed(3), dmh:+dmh.toFixed(3)};
      }
    }

    // 2) Respaldo k-NN sobre banco si hay pocos prototipos
    let knnVote = null;
    if (bank.length >= K){
      const dists = bank.map(({letter, vec}) => {
        // distancia angular ~ (1 - cos)
        const c = _cos(x, vec);
        return { letter, dist: 1 - c };
      }).sort((a,b)=>a.dist-b.dist).slice(0, K);

      // votación
      const tally = {};
      for (const {letter} of dists) tally[letter] = (tally[letter]||0)+1;
      knnVote = Object.entries(tally).sort((a,b)=>b[1]-a[1])[0][0];
    }

    // 3) Fusión simple: si kNN coincide con prototipo, sube confianza
    const agree = knnVote && (knnVote===bestL);
    const conf  = agree ? Math.min(0.99, bestScore*1.08) : bestScore;

    return {
      letter: bestL,
      confidence: +conf.toFixed(3),
      why: { ...bestWhy, agreeKNN: !!agree, kNN: knnVote || null }
    };
  }

  // export
  return { load, learn, predict };
})();

window.TecSignReasoner = Reasoner;
