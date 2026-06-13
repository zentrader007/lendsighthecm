import mipTable from '../data/mipTable.json';

interface MipRow {
  year: number;
  cost: number | null;
}

const rows = mipTable as MipRow[];
const byYear = new Map<number, number>();
for (const r of rows) {
  if (typeof r.cost === 'number') byYear.set(r.year, r.cost);
}

/** Annual MIP cost for a given loan year, replicating the XLOOKUP into 'MIP Annual Costs'. */
export function lookupAnnualMIP(year: number): number {
  return byYear.get(year) ?? 0;
}
