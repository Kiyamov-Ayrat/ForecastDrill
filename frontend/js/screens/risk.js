// risk.js — интерфейс S-2 «Риск по скважине» (UC-2, UC-3, UC-4; F-3…F-9)
// Данные берутся из REST API через Bridge (GET /wells/{id}/risk, /risk/history, /alerts).
registerScreen('risk', () => riskView());
