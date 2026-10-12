// Text examples only; these are never passed to the recognition pipeline.
export const DEMO_EXAMPLES = [
  {glosses:['YO','NECESITAR','DOCTOR'], expected:'Yo necesito un doctor.'},
  {glosses:['YO','NECESITAR','AYUDA'], expected:'Necesito ayuda.'},
  {glosses:['YO','DOLOR'], expected:'Tengo dolor.'},
  {glosses:['NECESITAR','DOCTOR'], expected:'Necesito un doctor.'},
  {glosses:['HOLA','YO','NECESITAR','DOCTOR'], expected:'Hola, necesito un doctor.'},
  {glosses:['YO','NECESITAR','HOSPITAL'], expected:'Necesito un hospital.'},
];
