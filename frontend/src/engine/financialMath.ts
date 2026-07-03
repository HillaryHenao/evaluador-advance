// npv replica Excel NPV(): descuenta cashflows[0] a t=1, cashflows[1] a t=2, etc.
// (NO incluye el flujo del año 0 — ese se suma aparte, igual que en el Excel: NPV(...)+C38)
export function npv(rate: number, cashflows: number[]): number {
  return cashflows.reduce((acc, flujo, i) => acc + flujo / Math.pow(1 + rate, i + 1), 0)
}

// irr: Newton-Raphson sobre la función VPN completa (cashflows[0] es el flujo en t=0)
export function irr(cashflows: number[], guess = 0.1): number {
  const vpnCompleto = (rate: number) =>
    cashflows.reduce((acc, flujo, t) => acc + flujo / Math.pow(1 + rate, t), 0)
  const derivada = (rate: number) =>
    cashflows.reduce((acc, flujo, t) => acc - (t * flujo) / Math.pow(1 + rate, t + 1), 0)

  let rate = guess
  for (let i = 0; i < 100; i++) {
    const valor = vpnCompleto(rate)
    const pendiente = derivada(rate)
    if (Math.abs(pendiente) < 1e-12) break
    const siguienteRate = rate - valor / pendiente
    if (Math.abs(siguienteRate - rate) < 1e-9) return siguienteRate
    rate = siguienteRate
  }
  return rate
}
