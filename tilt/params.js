// Tunable parameters: the tuning panel edits these, and they're saved per browser.

export const PARAM_SPECS = [
  { group: 'world' },
  { key: 'gravity',   label: 'gravity',            min: 0,  max: 30,  step: 0.1,  def: 9.81, unit: 'm/s²' },
  { group: 'ball' },
  { key: 'mass',      label: 'mass',               min: 1,  max: 50,  step: 0.5,  def: 5.5,  unit: 'kg' },
  { key: 'friction',  label: 'grip (friction)',    min: 0,  max: 2,   step: 0.05, def: 0.9 },
  { key: 'bounce',    label: 'bounce',             min: 0,  max: 1,   step: 0.05, def: 0.1 },
  { key: 'rollDamp',  label: 'rolling resistance', min: 0,  max: 3,   step: 0.05, def: 0.15 },
  { key: 'airDrag',   label: 'air drag',           min: 0,  max: 2,   step: 0.01, def: 0.02 },
  { group: 'steering' },
  { key: 'torque',    label: 'roll torque',        min: 0,  max: 150, step: 1,    def: 18,   unit: 'N·m' },
  { key: 'push',      label: 'push force',         min: 0,  max: 150, step: 1,    def: 33,   unit: 'N' },
  { key: 'pushSlope', label: 'push fades out by', min: 1,  max: 90,  step: 1,    def: 30,   unit: '°' },
  { key: 'maxSpeed',  label: 'top speed',          min: 1,  max: 30,  step: 0.5,  def: 7,    unit: 'm/s' },
  { key: 'brake',     label: 'brake (shift)',      min: 0,  max: 20,  step: 0.5,  def: 4 },
  { key: 'jump',      label: 'jump',               min: 0,  max: 12,  step: 0.1,  def: 4.5,  unit: 'm/s' },
  { group: 'tilting platform' },
  { key: 'platMass',  label: 'mass',               min: 5,  max: 600, step: 5,    def: 250,  unit: 'kg' },
  { key: 'spring',    label: 'self-levelling',     min: 0,  max: 600, step: 5,    def: 30,   unit: 'N·m/rad' },
  { key: 'platDamp',  label: 'wobble damping',     min: 0,  max: 600, step: 5,    def: 90,   unit: 'N·m·s' },
  { key: 'maxTilt',   label: 'max tilt',           min: 0,  max: 45,  step: 1,    def: 20,   unit: '°' },
  { group: 'cube' },
  { key: 'cubeMass',  label: 'mass',               min: 1,  max: 100, step: 0.5,  def: 6,    unit: 'kg' },
  { key: 'cubeGrip',  label: 'grip (friction)',    min: 0,  max: 1,   step: 0.01, def: 0.33 },
  { group: 'seesaws & sweeper' },
  { key: 'seesawMass', label: 'seesaw mass',       min: 1,  max: 100, step: 1,    def: 20,   unit: 'kg' },
  { key: 'sweepRpm',  label: 'sweeper speed',      min: 0,  max: 30,  step: 0.5,  def: 8,    unit: 'rpm' },
  { group: 'camera' },
  { key: 'zoom',      label: 'view size',          min: 8,  max: 50,  step: 0.5,  def: 20,   unit: 'm' },
  { key: 'follow',    label: 'follow speed',       min: 0.5, max: 20, step: 0.5,  def: 4 },
];

export const DEFAULTS = Object.fromEntries(PARAM_SPECS.filter(s => s.key).map(s => [s.key, s.def]));
const STORE_KEY = 'tilt.params.v3';

export const params = { ...DEFAULTS };
try {
  const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  for (const k in DEFAULTS) if (typeof saved[k] === 'number' && isFinite(saved[k])) params[k] = saved[k];
} catch (e) { /* storage unavailable: use defaults */ }

export function saveParams() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(params)); } catch (e) {}
}

function fmt(spec, v) {
  const dec = spec.step < 0.1 ? 2 : spec.step < 1 ? 1 : 0;
  return v.toFixed(dec) + (spec.unit ? ' ' + spec.unit : '');
}

// Builds the sliders into `container`. Returns a function that restores every slider to its default.
export function buildPanel(container, onChange) {
  const els = {};
  for (const spec of PARAM_SPECS) {
    if (spec.group) {
      const h = document.createElement('h3'); h.textContent = spec.group; container.appendChild(h); continue;
    }
    const row = document.createElement('div'); row.className = 'row';
    const id = 'p-' + spec.key;
    row.innerHTML = `<label for="${id}">${spec.label}</label><output></output>
      <input id="${id}" type="range" min="${spec.min}" max="${spec.max}" step="${spec.step}">`;
    const input = row.querySelector('input'), out = row.querySelector('output');
    input.value = params[spec.key]; out.textContent = fmt(spec, params[spec.key]);
    input.addEventListener('input', () => {
      params[spec.key] = parseFloat(input.value);
      out.textContent = fmt(spec, params[spec.key]);
      onChange(); saveParams();
    });
    els[spec.key] = { input, out, spec };
    container.appendChild(row);
  }
  return function resetToDefaults() {
    Object.assign(params, DEFAULTS);
    for (const k in els) { const s = els[k]; s.input.value = params[k]; s.out.textContent = fmt(s.spec, params[k]); }
    onChange(); saveParams();
  };
}
