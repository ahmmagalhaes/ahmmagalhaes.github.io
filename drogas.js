/* Banco de Dados Farmacológico
   ap: { f: tipo_frasco, m: massa, u: unidade, v: volume_ml }
   dil: [{ nome, qtd: qtd_ampolas, solvente: vol_ml_solvente, [massa], [vol] }]
*/
const DROGAS = {
  "Vasoativas e Inotrópicas": {
    "Noradrenalina": {
      u: "mcg/kg/min", r: [0.05, 1], f: 0, s: "SG5%",
      ap: { f: "amp", m: 4, u: "mg", v: 4 },
      dil: [
        { nome: "Padrão (4 amp)", qtd: 4, solvente: 234 },
        { nome: "Dobrada (8 amp)", qtd: 8, solvente: 218 },
        { nome: "Quadruplicada (16 amp)", qtd: 16, solvente: 186 },
        { nome: "Solução 2 (5 amp)", qtd: 5, solvente: 230 },
        { nome: "Acesso periférico (1 amp)", qtd: 1, solvente: 246 }
      ]
    },
    "Adrenalina": {
      u: "mcg/kg/min", r: [0.01, 1], f: 0, s: "SG5%",
      ap: { f: "amp", m: 1, u: "mg", v: 1 },
      dil: [
        { nome: "Padrão (10 amp)", qtd: 10, solvente: 190 }
      ]
    },
    "Dobutamina": {
      u: "mcg/kg/min", r: [2.5, 20], f: 0, s: "SF0,9% ou SG5%",
      ap: { f: "amp", m: 250, u: "mg", v: 20 },
      dil: [
        { nome: "Padrão (1 amp)", qtd: 1, solvente: 230 },
        { nome: "Concentrada (2 amp)", qtd: 2, solvente: 210 },
        { nome: "Concentrada (4 amp)", qtd: 4, solvente: 170 }, // 80mL + 170mL = 250mL (4000 mcg/mL)
		{ nome: "Restrição hídrica (2 amp)", qtd: 2, solvente: 60 } // 40mL + 60mL = 100mL (5000 mcg/mL)    
	]
    },
    "Dopamina": {
      u: "mcg/kg/min", r: [5, 20], f: 0, s: "SF0,9% ou SG5%",
      ap: { f: "amp", m: 50, u: "mg", v: 10 },
      dil: [
        { nome: "Padrão (5 amp)", qtd: 5, solvente: 200 }
      ]
    },
    "Milrinona": {
      u: "mcg/kg/min", r: [0.375, 0.75], f: 0, s: "SF0,9% ou SG5%",
      ap: { f: "amp", m: 10, u: "mg", v: 10 },
      at: { v: 50, u: "mcg/kg", t: 10 },
      dil: [
        { nome: "Padrão (2 amp)", qtd: 2, solvente: 80 }
      ]
    },
    "Levosimendan": {
      u: "mcg/kg/min", r: [0.05, 0.2], f: 0, s: "SG5%",
      ap: { f: "frasco", m: 12.5, u: "mg", v: 5 },
      at: { v: 12, u: "mcg/kg", t: 10 },
      dil: [
        { nome: "Padrão (1 frasco)", qtd: 1, solvente: 245 }
      ]
    },
    "Nitroglicerina": {
      u: "mcg/min", r: [5, 200], f: 1, s: "SF0,9% ou SG5%",
      ap: { f: "amp", m: 50, u: "mg", v: 10 },
      dil: [
        { nome: "Padrão (1 amp)", qtd: 1, solvente: 240 }
      ]
    },
    "Nitroprussiato": {
      u: "mcg/kg/min", r: [0.25, 10], f: 1, s: "SG5%",
      ap: { f: "amp", m: 50, u: "mg", v: 2 },
      dil: [
        { nome: "Padrão (1 amp)", qtd: 1, solvente: 248 }
      ]
    },
    "Vasopressina": {
      u: "U/min", r: [0.01, 0.04], f: 0, s: "SF0.9%",
      ap: { f: "amp", m: 20, u: "U", v: 1 },
      dil: [
        { nome: "Padrão (1 amp)", qtd: 1, solvente: 99 },
        { nome: "Concentrada (2 amp)", qtd: 2, solvente: 98 }
      ]
    },
    "Azul de Metileno": {
      u: "mg/kg/h", r: [0.25, 2], f: 0, s: "SG5%",
      ap: { f: "amp", m: 10, u: "mg", v: 10 },
      at: { v: 2, u: "mg/kg", t: 20 },
      dil: [
        { nome: "Padrão (5 amp)", qtd: 5, solvente: 50 }
      ]
    }
  },
  "Sedação e Analgesia": {
    "Fentanil": {
      u: "mcg/kg/h", r: [1, 5], f: 0, s: "SF0,9% ou SG5%",
      ap: { f: "amp", m: 500, u: "mcg", v: 10 },
      dil: [
        { nome: "Padrão (5 amp)", qtd: 5, solvente: 200 }
      ]
    },
    "Midazolam": {
      u: "mg/kg/h", r: [0.03, 0.2], f: 0, s: "SF0,9% ou SG5%",
      ap: { f: "amp", m: 50, u: "mg", v: 10 },
      dil: [
        { nome: "Padrão (5 amp)", qtd: 5, solvente: 200 }
      ]
    },
    "Propofol": {
      u: "mg/kg/h", r: [0.3, 4], f: 0, s: "Puro (sem solvente adicional)",
      ap: { f: "frasco", m: 500, u: "mg", v: 50 },
      dil: [
        { nome: "Propofol 1% (Puro)", qtd: 1, solvente: 0 },
        { nome: "Propofol 2% (Puro)", qtd: 1, solvente: 0, massa: 1000 }
      ]
    },
    "Cetamina": {
      u: "mg/kg/h", r: [0.05, 2.5], f: 0, s: "SF0,9% ou SG5%",
      ap: { f: "frasco", m: 500, u: "mg", v: 10 },
      dil: [
        { nome: "Padrão (2 frascos)", qtd: 2, solvente: 80 }
      ]
    },
    "Morfina": {
      u: "mg/h", r: [1, 5], f: 0, s: "SF0,9% ou SG5%",
      ap: { f: "amp", m: 10, u: "mg", v: 1 },
      dil: [
        { nome: "Padrão (5 amp)", qtd: 5, solvente: 45 }
      ]
    },
    "Dexmedetomidina": {
      u: "mcg/kg/h", r: [0.2, 1.5], f: 0, s: "SF0.9%",
      ap: { f: "amp", m: 200, u: "mcg", v: 2 },
      dil: [
        { nome: "Padrão (2 amp)", qtd: 2, solvente: 96 }
      ]
    },
    "Remifentanil": {
      u: "mcg/kg/min", r: [0.05, 0.5], f: 0, s: "SF0,9% ou SG5%",
      ap: { f: "frasco", m: 2, u: "mg", v: 0 },
      dil: [
        { nome: "Padrão (1 frasco)", qtd: 1, solvente: 40 }
      ]
    }
  },
  "Bloqueadores Neuromusculares": {
    "Rocuronio": {
      u: "mg/kg/h", r: [0.3, 0.6], f: 0, s: "Puro ou SF0,9%",
      ap: { f: "frasco", m: 50, u: "mg", v: 5 },
      at: { v: 0.6, u: "mg/kg", t: 0 },
      dil: [
        { nome: "Puro (10 mg/mL)", qtd: 1, solvente: 0 },
        { nome: "Diluído 1:1 (5 mg/mL)", qtd: 1, solvente: 5 }
      ]
    },
    "Atracurio": {
      u: "mg/kg/h", r: [0.3, 0.6], f: 0, s: "SF0,9% ou SG5%",
      ap: { f: "amp", m: 50, u: "mg", v: 5 },
      dil: [
        { nome: "Padrão (5 amp)", qtd: 5, solvente: 225 }
      ]
    },
    "Cisatracurio": {
      u: "mcg/kg/min", r: [0.5, 2], f: 0, s: "Puro (sem solvente adicional)",
      ap: { f: "amp", m: 20, u: "mg", v: 10 },
      at: { v: 150, u: "mcg/kg", t: 0 },
      dil: [
        { nome: "Puro (2 mg/mL)", qtd: 1, solvente: 0 }
      ]
    }
  },
  "Antiarrítmicos": {
    "Amiodarona": {
      u: "mg/h", r: [15, 30], f: 0, s: "SG5%",
      ap: { f: "amp", m: 150, u: "mg", v: 3 },
      at: { v: 150, u: "mg", t: 10 },
      dil: [
        { nome: "Padrão (2 amp)", qtd: 2, solvente: 240 } // 6mL fármaco + 240mL solvente = 246mL (1,22 mg/mL)
      ]
    },
    "Lidocaina 2%": {
      u: "mg/min", r: [1, 4], f: 0, s: "Puro (sem solvente adicional)",
      ap: { f: "frasco", m: 400, u: "mg", v: 20 },
      at: { v: 1.5, u: "mg/kg", t: 0 },
      dil: [
        { nome: "Puro (20 mg/mL)", qtd: 1, solvente: 0 }
      ]
    }
  }
};

const ORDEM = Object.keys(DROGAS);