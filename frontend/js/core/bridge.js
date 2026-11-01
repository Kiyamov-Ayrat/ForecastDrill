/* Мост между REST API и экранами */
const TYPE_RU = { sticking: 'Прихват', kick: 'Флюидопроявление', loss: 'Поглощение' };
const LEVEL_CLS = { green: 'g', yellow: 'y', red: 'r' };
const LEVEL_RU = { green: 'Норма', yellow: 'Внимание', red: 'Высокий риск' };
const STATUS_RU = { active: 'Активно', confirmed: 'Подтверждено', false_alarm: 'Ложная тревога', closed: 'Закрыто' };
// ПРОВЕРЬТЕ: ключи справа должны совпадать с ключами ROLES в вашем state.js
const ROLE_MAP = { operator: 'op', supervisor: 'sv', ml_engineer: 'ml', director: 'td', admin: 'ad' };

const Bridge = {
  wells: [], current: null, snapshot: null, alerts: [], thresholds: [],
  timer: null, busy: false, failed: false,

  reset() { this.wells = []; this.current = null; this.snapshot = null; this.alerts = []; this.thresholds = []; },
  currentWell() { return this.wells.find(w => w.id === this.current) || this.wells[0] || null; },

  async loadWells() {
    this.wells = await api('/wells');
    if (!this.current && this.wells.length) this.current = this.wells[0].id;
    // ПРОВЕРЬТЕ: формат строки WELLS в вашем data.js: [название, куст, индекс, статус данных]; id добавлен пятым элементом
    WELLS.splice(0, WELLS.length, ...this.wells.map(w =>
      [w.name, w.field, w.risk_index, w.data_status === 'ok' ? 'ok' : 'bad', w.id]));
  },

  async loadRisk() {
    const w = this.currentWell();
    if (!w) return;
    const [snap, hist, alerts] = await Promise.all([
      api(`/wells/${w.id}/risk`),
      api(`/wells/${w.id}/risk/history?minutes=30`),
      api(`/alerts?well_id=${w.id}&limit=20`)
    ]);
    this.snapshot = snap; this.alerts = alerts;
    const pts = hist.map(p => p.index);
    while (pts.length < 2) pts.push(snap.index);
    RISK.splice(0, RISK.length, ...pts);                    // массив, который рисует график индекса
    if (typeof Alerts !== 'undefined') Alerts.check(snap.index);   // звук и повтор из лабораторной 3
  },

  async loadThresholds() {
    const w = this.currentWell();
    if (w) this.thresholds = await api(`/wells/${w.id}/thresholds`);
  },

  async prepare(key) {                                      // данные для экрана до его отрисовки
    if (!st.role) return;
    if (key === 'dash' || !this.wells.length) await this.loadWells();
    if (key === 'risk' || key === 'well') await this.loadRisk();
    if (key === 'thr') await this.loadThresholds();
  },

  start() { this.stop(); this.timer = setInterval(() => this.tick(), 2000); },
  stop() { clearInterval(this.timer); this.timer = null; },

  async tick() {
    if (this.busy || !st.role || document.hidden) return;
    if (!['dash', 'risk', 'well'].includes(st.cur)) return;
    this.busy = true;
    try {
      if (st.cur === 'dash') await this.loadWells(); else await this.loadRisk();
      this.failed = false;
      render();
    } catch (e) {
      if (!this.failed) { this.failed = true; toast(e.message); }   // не засыпаем пользователя сообщениями
    } finally { this.busy = false; }
  }
};

/* Данные подгружаются перед открытием экрана */
(function () {
  const base = window.go;
  if (typeof base !== 'function') { console.warn('go() не найдена как глобальная функция: адаптируйте bridge.js'); return; }
  window.go = async function (key) {
    try { await Bridge.prepare(key); } catch (e) { toast(e.message); }
    return base(key);
  };
})();

function openWell(id) { Bridge.current = id; go('well'); }