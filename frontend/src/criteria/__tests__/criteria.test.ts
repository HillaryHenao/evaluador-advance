import { describe, it, expect } from 'vitest'
import corte from '../corte'
import lleno from '../lleno'
import pilotes from '../pilotes'
import numeroArboles from '../numero_arboles'
import propietario from '../propietario'
import servidumbre from '../servidumbre'
import cluster from '../cluster'
import aprovechamientoForestal from '../aprovechamiento_forestal'
import ocupacionCauce from '../ocupacion_cauce'
import distanciaRed from '../distancia_red'
import distanciaVia from '../distancia_via'
import obrasHidraulicas from '../obras_hidraulicas'

const ctx = { baseCapex: 4_000_000_000, kWp: 1320 }

describe('corte', () => {
  it('calcula 57.000 COP por m³', () => {
    expect(corte.computeCost(100, ctx)).toBe(5_700_000)
  })
  it('retorna 0 para valor nulo', () => {
    expect(corte.computeCost(null, ctx)).toBe(0)
  })
  it('tiene formulaDefined true', () => {
    expect(corte.formulaDefined).toBe(true)
  })
})

describe('lleno', () => {
  it('calcula 190.000 COP por m³', () => {
    expect(lleno.computeCost(10, ctx)).toBe(1_900_000)
  })
  it('retorna 0 para valor nulo', () => {
    expect(lleno.computeCost(null, ctx)).toBe(0)
  })
})

describe('pilotes', () => {
  it('retorna 156.000.000 cuando es true', () => {
    expect(pilotes.computeCost(true, ctx)).toBe(156_000_000)
  })
  it('retorna 0 cuando es false', () => {
    expect(pilotes.computeCost(false, ctx)).toBe(0)
  })
})

describe('numero_arboles', () => {
  it('calcula 142.500 COP por árbol', () => {
    expect(numeroArboles.computeCost(5, ctx)).toBe(5 * 142_500)
  })
  it('retorna 0 para valor nulo', () => {
    expect(numeroArboles.computeCost(null, ctx)).toBe(0)
  })
  it('tiene formulaDefined true y category fijo', () => {
    expect(numeroArboles.formulaDefined).toBe(true)
    expect(numeroArboles.category).toBe('fijo')
  })
})

describe('propietario', () => {
  it('bueno no agrega sobrecosto', () => {
    expect(propietario.computeCost('bueno', ctx)).toBe(0)
  })
  it('medio agrega 30.000.000', () => {
    expect(propietario.computeCost('medio', ctx)).toBe(30_000_000)
  })
  it('malo agrega 60.000.000', () => {
    expect(propietario.computeCost('malo', ctx)).toBe(60_000_000)
  })
})

describe('servidumbre', () => {
  it('0 meses no agrega sobrecosto (aprobada o propia)', () => {
    expect(servidumbre.computeCost(0, ctx)).toBe(0)
  })
  it('retorna 0 para valor nulo (aún sin definir manualmente)', () => {
    expect(servidumbre.computeCost(null, ctx)).toBe(0)
  })
  it('calcula 60.000.000 por mes de retraso', () => {
    expect(servidumbre.computeCost(1, ctx)).toBe(60_000_000)
    expect(servidumbre.computeCost(3, ctx)).toBe(180_000_000)
  })
  it('es db_or_manual para permitir ajuste manual cuando no hay estado aprobado', () => {
    expect(servidumbre.dataSource).toBe('db_or_manual')
  })
  it('tiene riskType meses', () => {
    expect(servidumbre.riskType).toBe('meses')
  })
})

describe('cluster', () => {
  it('1 proyecto no reduce el CAPEX', () => {
    expect(cluster.computeCost(1, ctx)).toBe(0)
  })
  it('2 proyectos reduce 15.000.000', () => {
    expect(cluster.computeCost(2, ctx)).toBe(-15_000_000)
  })
  it('más de 2 proyectos reduce 30.000.000', () => {
    expect(cluster.computeCost(3, ctx)).toBe(-30_000_000)
  })
  it('retorna 0 para valor nulo', () => {
    expect(cluster.computeCost(null, ctx)).toBe(0)
  })
})

describe('aprovechamiento_forestal', () => {
  it('sin registro/resuelto no agrega sobrecosto', () => {
    expect(aprovechamientoForestal.computeCost(null, ctx)).toBe(0)
  })
  it('visita agrega 20.000.000', () => {
    expect(aprovechamientoForestal.computeCost('visita', ctx)).toBe(20_000_000)
  })
  it('solicitud radicada agrega 150.000.000', () => {
    expect(aprovechamientoForestal.computeCost('radicada', ctx)).toBe(150_000_000)
  })
  it('otro estado agrega 200.000.000', () => {
    expect(aprovechamientoForestal.computeCost('otro', ctx)).toBe(200_000_000)
  })
})

describe('ocupacion_cauce', () => {
  it('false (No Requiere/Aprobado) no agrega sobrecosto', () => {
    expect(ocupacionCauce.computeCost(false, ctx)).toBe(0)
  })
  it('true (cualquier otro estado) agrega 100.000.000', () => {
    expect(ocupacionCauce.computeCost(true, ctx)).toBe(100_000_000)
  })
  it('tiene formulaDefined true y category fijo', () => {
    expect(ocupacionCauce.formulaDefined).toBe(true)
    expect(ocupacionCauce.category).toBe('fijo')
  })
})

describe('distancia_red', () => {
  it('aplica tarifa de 509.000/m para ≤99m', () => {
    expect(distanciaRed.computeCost(65, ctx)).toBe(65 * 509_000)
  })
  it('aplica tarifa de 420.000/m para tramo 100-299m', () => {
    expect(distanciaRed.computeCost(130, ctx)).toBe(130 * 420_000)
  })
  it('aplica tarifa de 380.000/m para tramo 300-499m', () => {
    expect(distanciaRed.computeCost(400, ctx)).toBe(400 * 380_000)
  })
  it('aplica tarifa de 350.000/m para tramo 500-799m', () => {
    expect(distanciaRed.computeCost(600, ctx)).toBe(600 * 350_000)
  })
  it('aplica tarifa de 312.500/m para ≥800m', () => {
    expect(distanciaRed.computeCost(1000, ctx)).toBe(1000 * 312_500)
  })
  it('retorna 0 para valor nulo', () => {
    expect(distanciaRed.computeCost(null, ctx)).toBe(0)
  })
})

describe('distancia_via', () => {
  it('calcula 457.292 COP por metro', () => {
    expect(distanciaVia.computeCost(100, ctx)).toBe(100 * 457_292)
  })
  it('retorna 0 para valor nulo', () => {
    expect(distanciaVia.computeCost(null, ctx)).toBe(0)
  })
})

describe('obras_hidraulicas', () => {
  const vacio = {
    canal_concreto: { activo: false, cantidad: null },
    cuneta_via: { activo: false, cantidad: null },
    box_culvert: { activo: false, cantidad: null },
    alcantarilla_cruce: { activo: false, cantidad: null },
  }

  it('calcula 40m de canal en concreto a 1.300.000/m', () => {
    const value = { ...vacio, canal_concreto: { activo: true, cantidad: 40 } }
    expect(obrasHidraulicas.computeCost(value, ctx)).toBe(52_000_000)
  })

  it('suma varios tipos activos (canal + box culvert)', () => {
    const value = {
      ...vacio,
      canal_concreto: { activo: true, cantidad: 40 },
      box_culvert: { activo: true, cantidad: 1 },
    }
    expect(obrasHidraulicas.computeCost(value, ctx)).toBe(52_000_000 + 170_000_000)
  })

  it('ignora la cantidad de un ítem no activo', () => {
    const value = { ...vacio, alcantarilla_cruce: { activo: false, cantidad: 3 } }
    expect(obrasHidraulicas.computeCost(value, ctx)).toBe(0)
  })

  it('retorna 0 para valor nulo', () => {
    expect(obrasHidraulicas.computeCost(null, ctx)).toBe(0)
  })

  it('tiene formulaDefined true y category fijo', () => {
    expect(obrasHidraulicas.formulaDefined).toBe(true)
    expect(obrasHidraulicas.category).toBe('fijo')
  })
})
