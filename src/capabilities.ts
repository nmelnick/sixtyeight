import { MACHINE_TYPES } from "./machine-types.js";

type CapabilityList = Record<string, string[]>;

const capabilities: Record<string, CapabilityList> = {
  command: {
    "Get Version": Object.keys(MACHINE_TYPES).filter(
      (t) => t.charCodeAt(0) > "B".charCodeAt(0),
    ),
    "Non-Critical Tests": Object.keys(MACHINE_TYPES).filter(
      (t) => t.charCodeAt(0) > "6".charCodeAt(0),
    ),
  },
  critical: {
    "Size Memory": ["*"],
    "Data Bus Test": ["*"],
    "Mod3 RAM Test": ["*"],
    "Address Line Test": ["*"],
    "ROM checksum": ["*"],
    "RevMod3 RAM Test": ["*"],
    "Extra RAM Test/March Test": ["*"],
    "ModInv RAM Test": Object.keys(MACHINE_TYPES).filter(
      (t) => t.charCodeAt(0) > "B".charCodeAt(0),
    ),
    "Size Video RAM Test": Object.keys(MACHINE_TYPES).filter(
      (t) => t.charCodeAt(0) > "C".charCodeAt(0),
    ),
  },
  nonCritical: {
    "Mapper RAM data test (Portable)": ["6"],
    "Mapper RAM unique test (Portable)": ["6"],
    "VRAM data test (Portable)": ["6"],
    "VRAM address test (Portable)": ["6"],
    "SCC test 1": Object.keys(MACHINE_TYPES).filter(
      (t) => t.charCodeAt(0) >= "6".charCodeAt(0),
    ),
    "SCC test 2": Object.keys(MACHINE_TYPES).filter(
      (t) => t.charCodeAt(0) >= "6".charCodeAt(0),
    ),
    "SCC test 3": Object.keys(MACHINE_TYPES).filter(
      (t) => t.charCodeAt(0) >= "6".charCodeAt(0),
    ),
    "VIA test": Object.keys(MACHINE_TYPES).filter(
      (t) => t.charCodeAt(0) >= "6".charCodeAt(0),
    ),
    "General SCSI test": Object.keys(MACHINE_TYPES).filter(
      (t) => t.charCodeAt(0) >= "6".charCodeAt(0),
    ),
    Sound: Object.keys(MACHINE_TYPES).filter(
      (t) => t.charCodeAt(0) >= "6".charCodeAt(0),
    ),
    PRAM: Object.keys(MACHINE_TYPES).filter(
      (t) => t.charCodeAt(0) >= "7".charCodeAt(0),
    ),
    RBV: Object.keys(MACHINE_TYPES).filter(
      (t) => t.charCodeAt(0) >= "7".charCodeAt(0),
    ),
    SWIM: Object.keys(MACHINE_TYPES).filter(
      (t) => t.charCodeAt(0) >= "7".charCodeAt(0),
    ),
    FPU: Object.keys(MACHINE_TYPES).filter(
      (t) => t.charCodeAt(0) >= "7".charCodeAt(0),
    ),
    "PGC - Parity Generator/Checker": Object.keys(MACHINE_TYPES).filter(
      (t) => t.charCodeAt(0) >= "7".charCodeAt(0),
    ),
    "FMC - Fitch Memory Controller 1": Object.keys(MACHINE_TYPES).filter(
      (t) => t.charCodeAt(0) >= "8".charCodeAt(0),
    ),
    "FMC - Fitch Memory Controller 2": Object.keys(MACHINE_TYPES).filter(
      (t) => t.charCodeAt(0) >= "8".charCodeAt(0),
    ),
    "OSS - IIfx Operating System Support Chip 1": ["8"],
    "OSS - IIfx Operating System Support Chip 2": ["8"],
    "RPU - Tests the RAM Parity Unit used in 840av": Object.keys(
      MACHINE_TYPES,
    ).filter((t) => t.charCodeAt(0) >= "C".charCodeAt(0)),
    "Egret - Tests the Egret by executing its built in diagnostics":
      Object.keys(MACHINE_TYPES).filter(
        (t) => t.charCodeAt(0) >= "C".charCodeAt(0),
      ),
    "SoundInts - Checks that sound interrupts are working properly":
      Object.keys(MACHINE_TYPES).filter(
        (t) => t.charCodeAt(0) >= "C".charCodeAt(0),
      ),
    "CLUT - Tests the Color Lookup Table (LC, Q700/Q900, LC III)": Object.keys(
      MACHINE_TYPES,
    ).filter((t) => t.charCodeAt(0) >= "C".charCodeAt(0)),
    "VRAM - Tests VRAM (V8 controller)": Object.keys(MACHINE_TYPES).filter(
      (t) => t.charCodeAt(0) >= "C".charCodeAt(0),
    ),
    "Classic II PWM": ["C", "J"],
    "Classic II SoundInts": ["C", "J"],
    "53C96 SCSI": ["E", "H", "I", "L", "M", "O", "e", "v"],
    "SONIC ethernet 1": Object.keys(MACHINE_TYPES).filter(
      (t) => t.charCodeAt(0) >= "N".charCodeAt(0),
    ),
    "SONIC ethernet 2": Object.keys(MACHINE_TYPES).filter(
      (t) => t.charCodeAt(0) >= "N".charCodeAt(0),
    ),
    "SONIC ethernet 3": Object.keys(MACHINE_TYPES).filter(
      (t) => t.charCodeAt(0) >= "N".charCodeAt(0),
    ),
    "GSCRegs - Tests Grayscale Chip registers": Object.keys(
      MACHINE_TYPES,
    ).filter((t) => t.charCodeAt(0) >= "N".charCodeAt(0)),
    "PGE - Tests PG&E power manager (PowerBook Duo)": Object.keys(
      MACHINE_TYPES,
    ).filter((t) => t.charCodeAt(0) >= "N".charCodeAt(0)),
    "CSCRegs - Test Color Support Chip registers": Object.keys(
      MACHINE_TYPES,
    ).filter((t) => t.charCodeAt(0) >= "j".charCodeAt(0)),
  },
  utility: {},
};

export function checkCapability(
  type: string,
  capability: string,
  machineIdentifier: string,
): boolean {
  const row = capabilities[type][capability];
  if (type === "command" && !row) {
    return true;
  }
  return row.includes("*") || row.includes(machineIdentifier);
}
