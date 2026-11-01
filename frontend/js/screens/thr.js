// thr.js — интерфейс S-9 «Пороги тревог» (UC-6, F-7, F-12)
// Экран полностью работает через REST API: GET/PUT /wells/{id}/thresholds (реализация — thrView/saveThr в live-views.js).
registerScreen('thr', () => thrView());
