// Plain-language, client-voice ("you") readings of each analysis. Pure
// functions of the report data, so the digital link and the PDF say the same
// thing. Ported from the consumer view; invest and sequence-risk are new.
import { usd, pct } from '../format';
import type { ReportData } from './reportData';

const yrs = (n: number) => `${n} year${n === 1 ? '' : 's'}`;

export function locInsight(d: ReportData): string {
  const { itm, result, ref } = d;
  if (itm.isShortToday) {
    return itm.itmAge != null
      ? `Today the loan would fall ${usd(itm.shortfallToday)} short of paying off your mortgage and closing costs, so it can't close yet. Bringing ${usd(itm.depositToQualifyNow)} to closing would qualify you now — or, with no cash at all, you come into the money at age ${itm.itmAge} as the program's limits rise with age, your home appreciates, and your mortgage pays down.`
      : `Today the loan would fall ${usd(itm.shortfallToday)} short of paying off your mortgage and closing costs, and that gap doesn't close on its own within this projection. Qualifying would take cash at closing — your advisor can show you how much.`;
  }
  return `Your starting line of credit of ${usd(result.remainingCredit)} could grow to about ${usd(ref.availableLOC)} by age ${ref.age} — even if your home's value never changes. It grows whether or not you use it, and you can't be cut off for a drop in home values.`;
}

export function spendingInsight(d: ReportData): string {
  const { spending, spendRef } = d;
  const lump = spending.lumpSum > 0 ? `${usd(spending.lumpSum)} in cash right away` : '';
  const freed =
    spending.annualFreed > 0
      ? `${usd(spending.monthlyFreed)} a month you no longer pay on your mortgage (for ${yrs(spending.freedYears)})`
      : '';
  const draws =
    spending.totalCreditDraws > 0
      ? `${usd(spending.totalCreditDraws)} drawn from your credit line over the years you planned`
      : '';
  const both = [lump, freed, draws].filter(Boolean).join(', plus ');
  if (!both) {
    return `In this scenario the money stays in your growing line of credit rather than coming to you as new spending — see Credit line growth.`;
  }
  return `This reverse mortgage gives you ${both}. That's ${usd(spending.firstYearTotal)} of new spending in the first year, and about ${usd(spendRef.cumulative)} by age ${spendRef.age}. Cash at closing and credit-line draws are borrowed against your home, so the loan balance grows; the freed-up payment is money you simply stop spending.`;
}

export function networthInsight(d: ReportData): string {
  const { inp, cmp, cmpRef, hasLien } = d;
  const be = cmp.breakEvenAge ? ` You come out ahead by age ${cmp.breakEvenAge}.` : '';
  const longevity =
    cmp.noHecmDepletionAge != null
      ? cmp.hecmDepletionAge != null
        ? ` Your savings last to about age ${cmp.hecmDepletionAge} with the reverse mortgage, versus age ${cmp.noHecmDepletionAge} without it.`
        : ` Without the reverse mortgage your savings run out around age ${cmp.noHecmDepletionAge}; with it, they last through the projection.`
      : '';
  const body = hasLien
    ? `By age ${cmpRef.age}, using the reverse mortgage to pay off your ${usd(inp.existingLiens)} mortgage leaves a projected net worth of ${usd(cmpRef.netWorthHecm)}, versus ${usd(cmpRef.netWorthNoHecm)} if you keep your current mortgage — because the reverse mortgage removes your ${usd(cmp.monthlyMortgagePayment)}/month payment.`
    : `With the reverse mortgage, your projected net worth at age ${cmpRef.age} is ${usd(cmpRef.netWorthHecm)} — your home equity after the loan balance, plus the ${usd(cmp.hecm.netCashDrawn)} you take at closing, invested — versus ${usd(cmpRef.netWorthNoHecm)} if you take no reverse mortgage. The difference reflects the loan's growth and costs, set against those invested proceeds.`;
  return body + be + longevity;
}

export function equityInsight(d: ReportData): string {
  const { ref } = d;
  return `At age ${ref.age} your home is projected at ${usd(ref.homeValue)} with a ${usd(ref.upb)} loan balance — leaving ${usd(ref.equity)} in equity for you or your heirs. Because the loan is FHA-insured, you or your heirs never owe more than the home is worth when it's sold.`;
}

export function investInsight(d: ReportData): string {
  const { inp, result } = d;
  const row = result.projection.find((r) => r.age >= 90) ?? d.last;
  return `This is an illustration only — not a recommendation to borrow in order to invest. If the ${usd(result.netCashDrawn)} taken at closing were invested at ${pct(inp.investmentReturn, 1)}, it could grow to about ${usd(row.investment)} by age ${row.age}; with your remaining home equity that's ${usd(row.investmentPlusEquity)}, versus ${usd(row.equity)} from equity alone. Investment returns are not guaranteed, and the loan balance grows regardless of how the investment performs.`;
}

export function seqInsight(d: ReportData): string {
  const { seq, seqLast, inp } = d;
  const sellDies = seq.sellDepletionAge !== null;
  const bridgeDies = seq.bridgeDepletionAge !== null;
  const setup = `If markets dropped ${pct(inp.crashPct, 0)} tomorrow and you kept spending ${usd(inp.annualSpending)} a year: `;
  if (sellDies && !bridgeDies) {
    return `${setup}selling investments through the downturn, your savings would run out at age ${seq.sellDepletionAge}. Drawing ${usd(seq.totalBridgeDraws)} of spending from the credit line instead — and leaving your investments alone to recover — keeps your savings going through age ${seqLast.age}, ending at ${usd(seqLast.portfolioBridge)}. The trade-off is a ${usd(seqLast.hecmDebt)} loan balance, leaving ${usd(seqLast.equity)} of home equity.`;
  }
  if (!sellDies && !bridgeDies) {
    return `${setup}both approaches keep you funded through age ${seqLast.age}. Bridging from the credit line ends with ${usd(seqLast.portfolioBridge)} in savings plus ${usd(seqLast.equity)} of home equity (${usd(seqLast.netBridge)} in all); selling investments ends with ${usd(seqLast.portfolioSell)} plus ${usd(seqLast.netSell - seqLast.portfolioSell)} of home equity (${usd(seqLast.netSell)}). At this spending level the standby credit line is insurance against a worse downturn rather than a numbers win.`;
  }
  if (bridgeDies && !sellDies) {
    return `${setup}the credit line doesn't solve it — even bridging from the line, savings run out at age ${seq.bridgeDepletionAge}, while selling investments alone lasts through age ${seqLast.age}. The line's capacity is finite; a lower spending level or a shorter bridge would change this picture.`;
  }
  return `${setup}spending outruns both approaches — savings run out at age ${seq.sellDepletionAge} without the reverse mortgage and age ${seq.bridgeDepletionAge} with the bridge. This spending level may not be sustainable either way; it's worth revisiting with your advisor.`;
}
