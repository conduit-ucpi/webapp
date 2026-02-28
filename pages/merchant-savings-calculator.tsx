import { useState, useMemo } from 'react';
import SEO from '@/components/SEO';

interface CostRow {
  label: string;
  traditional: number;
  stablecoin: number;
  traditionalNote: string;
  stablecoinNote: string;
  highlight: boolean;
}

interface Calculations {
  yearlyVolume: number;
  yearlyTransactions: number;
  yearlyChargebacks: number;
  rows: CostRow[];
  traditionalTotal: number;
  traditionalPercent: number;
  stablecoinTotal: number;
  stablecoinPercent: number;
  annualSavings: number;
  savingsPercent: number;
  currentProfit: number | null;
  profitIncrease: number | null;
  newProfit: number | null;
}

export default function MerchantSavingsCalculator() {
  const [monthlyVolume, setMonthlyVolume] = useState(25000);
  const [avgTransaction, setAvgTransaction] = useState(75);
  const [chargebackRate, setChargebackRate] = useState(0.5);
  const [profitMargin, setProfitMargin] = useState<number | null>(10);

  const calculations: Calculations = useMemo(() => {
    const monthlyTransactions = monthlyVolume / avgTransaction;
    const yearlyVolume = monthlyVolume * 12;
    const yearlyTransactions = monthlyTransactions * 12;
    const yearlyChargebacks = Math.round(yearlyTransactions * (chargebackRate / 100));

    // Traditional card costs
    const interchange = yearlyVolume * 0.02;
    const networkFee = yearlyVolume * 0.0014;
    const processorMarkup = yearlyVolume * 0.004;
    const perTransactionFee = yearlyTransactions * 0.25;
    const pciCompliance = 300;
    const chargebackFees = yearlyChargebacks * 20;
    const fraudLosses = yearlyVolume * 0.005;
    const floatCost = (monthlyVolume * 0.08 * 3) / 365 * 12;

    const traditionalTotal = interchange + networkFee + processorMarkup +
      perTransactionFee + pciCompliance + chargebackFees + fraudLosses + floatCost;

    const traditionalPercent = (traditionalTotal / yearlyVolume) * 100;

    // Stablecoin escrow costs
    const escrowFee = yearlyVolume * 0.01;

    const stablecoinTotal = escrowFee;
    const stablecoinPercent = (stablecoinTotal / yearlyVolume) * 100;

    const annualSavings = traditionalTotal - stablecoinTotal;
    const savingsPercent = (annualSavings / traditionalTotal) * 100;

    // Profit calculations (only if margin provided)
    const currentProfit = profitMargin ? yearlyVolume * (profitMargin / 100) : null;
    const profitIncrease = currentProfit ? (annualSavings / currentProfit) * 100 : null;
    const newProfit = currentProfit ? currentProfit + annualSavings : null;

    return {
      yearlyVolume,
      yearlyTransactions: Math.round(yearlyTransactions),
      yearlyChargebacks,
      rows: [
        {
          label: 'Payment processing fee',
          traditional: 0,
          stablecoin: escrowFee,
          traditionalNote: 'Broken out below',
          stablecoinNote: '1% — that\'s it',
          highlight: false
        },
        {
          label: 'Interchange fees',
          traditional: interchange,
          stablecoin: 0,
          traditionalNote: '~2% to issuing bank',
          stablecoinNote: 'No intermediaries',
          highlight: true
        },
        {
          label: 'Network fees',
          traditional: networkFee,
          stablecoin: 0,
          traditionalNote: '0.14% to Visa/MC',
          stablecoinNote: 'No card network',
          highlight: true
        },
        {
          label: 'Processor markup',
          traditional: processorMarkup,
          stablecoin: 0,
          traditionalNote: '~0.4%',
          stablecoinNote: 'No processor',
          highlight: true
        },
        {
          label: 'Per-transaction fees',
          traditional: perTransactionFee,
          stablecoin: 0,
          traditionalNote: '$0.25 each',
          stablecoinNote: 'None',
          highlight: true
        },
        {
          label: 'PCI compliance',
          traditional: pciCompliance,
          stablecoin: 0,
          traditionalNote: 'Annual audit',
          stablecoinNote: 'No card data',
          highlight: true
        },
        {
          label: 'Chargeback fees',
          traditional: chargebackFees,
          stablecoin: 0,
          traditionalNote: `$20 × ${yearlyChargebacks} disputes`,
          stablecoinNote: 'Escrow, not chargebacks',
          highlight: true
        },
        {
          label: 'Fraud losses',
          traditional: fraudLosses,
          stablecoin: 0,
          traditionalNote: '~0.5% CNP fraud',
          stablecoinNote: 'No stolen card numbers',
          highlight: true
        },
        {
          label: 'Settlement delay cost',
          traditional: floatCost,
          stablecoin: 0,
          traditionalNote: '2-3 day float',
          stablecoinNote: 'Instant settlement',
          highlight: true
        },
        {
          label: 'Gas fees',
          traditional: 0,
          stablecoin: 0,
          traditionalNote: 'N/A',
          stablecoinNote: 'Covered',
          highlight: false
        },
      ],
      traditionalTotal,
      traditionalPercent,
      stablecoinTotal,
      stablecoinPercent,
      annualSavings,
      savingsPercent,
      currentProfit,
      profitIncrease,
      newProfit
    };
  }, [monthlyVolume, avgTransaction, chargebackRate, profitMargin]);

  const exportSpreadsheet = async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Conduit Checkout Cost Calculator';
    const ws = wb.addWorksheet('Cost Comparison');

    // Column widths
    ws.columns = [
      { width: 28 },  // A - labels
      { width: 18 },  // B - values / card
      { width: 18 },  // C - stablecoin
      { width: 6 },   // D - spacer
      { width: 22 },  // E - summary labels
      { width: 18 },  // F - summary values
    ];

    // Styles
    const green = '00FF88';
    const red = 'FF4444';
    const dark = '0A0A0A';
    const darkBg = '111111';
    const headerFont = { bold: true, size: 14, color: { argb: 'FFFFFF' } };
    const subFont = { bold: true, size: 11, color: { argb: '888888' } };
    const inputFont = { bold: true, size: 12, color: { argb: green } };
    const labelFont = { size: 10, color: { argb: 'AAAAAA' } };
    const cardFont = { bold: true, size: 11, color: { argb: red } };
    const stableFont = { bold: true, size: 11, color: { argb: green } };
    const currency = '#,##0';
    const currencyDec = '#,##0.00';
    const pct = '0.00%';

    const fillDark = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: dark } };
    const fillRow = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: darkBg } };
    const fillHeader = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: '1A1A1A' } };

    // Fill entire sheet background
    for (let r = 1; r <= 40; r++) {
      const row = ws.getRow(r);
      for (let c = 1; c <= 6; c++) {
        row.getCell(c).fill = fillDark;
        row.getCell(c).font = { color: { argb: 'E8E8E8' }, size: 10 };
      }
    }

    // ── Title ──
    const titleCell = ws.getCell('A1');
    titleCell.value = 'Checkout Cost Calculator';
    titleCell.font = headerFont;
    titleCell.fill = fillDark;

    // ── Inputs (rows 3-6) ──
    // Labels in A, editable values in B
    ws.getCell('A3').value = 'Monthly Card Volume';
    ws.getCell('A3').font = labelFont;
    ws.getCell('B3').value = monthlyVolume;
    ws.getCell('B3').numFmt = currency;
    ws.getCell('B3').font = inputFont;
    ws.getCell('B3').fill = fillRow;

    ws.getCell('A4').value = 'Average Transaction';
    ws.getCell('A4').font = labelFont;
    ws.getCell('B4').value = avgTransaction;
    ws.getCell('B4').numFmt = currency;
    ws.getCell('B4').font = inputFont;
    ws.getCell('B4').fill = fillRow;

    ws.getCell('A5').value = 'Chargeback Rate';
    ws.getCell('A5').font = labelFont;
    ws.getCell('B5').value = chargebackRate / 100;
    ws.getCell('B5').numFmt = pct;
    ws.getCell('B5').font = inputFont;
    ws.getCell('B5').fill = fillRow;

    ws.getCell('A6').value = 'Profit Margin';
    ws.getCell('A6').font = labelFont;
    ws.getCell('B6').value = profitMargin ? profitMargin / 100 : 0;
    ws.getCell('B6').numFmt = pct;
    ws.getCell('B6').font = inputFont;
    ws.getCell('B6').fill = fillRow;

    ws.getCell('C3').value = '← Change these values';
    ws.getCell('C3').font = { italic: true, size: 9, color: { argb: '666666' } };

    // ── Derived values (row 8-10) ──
    // B3=monthlyVolume, B4=avgTransaction, B5=chargebackRate
    ws.getCell('A8').value = 'Annual Volume';
    ws.getCell('A8').font = labelFont;
    ws.getCell('B8').value = { formula: 'B3*12' };
    ws.getCell('B8').numFmt = currency;
    ws.getCell('B8').font = { bold: true, size: 11, color: { argb: 'FFFFFF' } };

    ws.getCell('A9').value = 'Annual Transactions';
    ws.getCell('A9').font = labelFont;
    ws.getCell('B9').value = { formula: 'ROUND((B3/B4)*12,0)' };
    ws.getCell('B9').numFmt = '#,##0';
    ws.getCell('B9').font = { size: 11, color: { argb: 'FFFFFF' } };

    ws.getCell('A10').value = 'Annual Chargebacks';
    ws.getCell('A10').font = labelFont;
    ws.getCell('B10').value = { formula: 'ROUND(B9*B5,0)' };
    ws.getCell('B10').numFmt = '#,##0';
    ws.getCell('B10').font = { size: 11, color: { argb: 'FFFFFF' } };

    // ── Cost Comparison Table (row 12+) ──
    const tableStart = 12;

    // Header row
    ws.getCell(`A${tableStart}`).value = 'Cost Category';
    ws.getCell(`A${tableStart}`).font = subFont;
    ws.getCell(`A${tableStart}`).fill = fillHeader;
    ws.getCell(`B${tableStart}`).value = 'Card Payment';
    ws.getCell(`B${tableStart}`).font = { bold: true, size: 11, color: { argb: red } };
    ws.getCell(`B${tableStart}`).fill = fillHeader;
    ws.getCell(`C${tableStart}`).value = 'Stablecoin';
    ws.getCell(`C${tableStart}`).font = { bold: true, size: 11, color: { argb: green } };
    ws.getCell(`C${tableStart}`).fill = fillHeader;

    // Cost rows with formulas referencing B8 (annual volume), B9 (annual txns), B10 (annual chargebacks)
    const costRows: Array<{ label: string; cardFormula: string; stableFormula: string }> = [
      { label: 'Payment processing fee',   cardFormula: '0',              stableFormula: 'B8*0.01' },
      { label: 'Interchange fees (~2%)',    cardFormula: 'B8*0.02',       stableFormula: '0' },
      { label: 'Network fees (0.14%)',      cardFormula: 'B8*0.0014',     stableFormula: '0' },
      { label: 'Processor markup (0.4%)',   cardFormula: 'B8*0.004',      stableFormula: '0' },
      { label: 'Per-transaction ($0.25)',   cardFormula: 'B9*0.25',       stableFormula: '0' },
      { label: 'PCI compliance',            cardFormula: '300',           stableFormula: '0' },
      { label: 'Chargeback fees ($20)',     cardFormula: 'B10*20',        stableFormula: '0' },
      { label: 'Fraud losses (0.5%)',       cardFormula: 'B8*0.005',      stableFormula: '0' },
      { label: 'Settlement delay cost',     cardFormula: '(B3*0.08*3)/365*12', stableFormula: '0' },
      { label: 'Gas fees',                  cardFormula: '0',             stableFormula: '0' },
    ];

    costRows.forEach((row, i) => {
      const r = tableStart + 1 + i;
      const rowFill = i % 2 === 0 ? fillRow : fillDark;

      ws.getCell(`A${r}`).value = row.label;
      ws.getCell(`A${r}`).font = { size: 10, color: { argb: 'E8E8E8' } };
      ws.getCell(`A${r}`).fill = rowFill;

      ws.getCell(`B${r}`).value = { formula: row.cardFormula };
      ws.getCell(`B${r}`).numFmt = currencyDec;
      ws.getCell(`B${r}`).font = row.cardFormula === '0' ? { size: 10, color: { argb: '444444' } } : cardFont;
      ws.getCell(`B${r}`).fill = rowFill;

      ws.getCell(`C${r}`).value = { formula: row.stableFormula };
      ws.getCell(`C${r}`).numFmt = currencyDec;
      ws.getCell(`C${r}`).font = row.stableFormula === '0' ? { size: 10, color: { argb: green } } : { size: 10, color: { argb: 'E8E8E8' } };
      ws.getCell(`C${r}`).fill = rowFill;
    });

    // Totals row
    const firstDataRow = tableStart + 1;
    const lastDataRow = tableStart + costRows.length;
    const totalRow = lastDataRow + 1;

    ws.getCell(`A${totalRow}`).value = 'ANNUAL TOTAL';
    ws.getCell(`A${totalRow}`).font = { bold: true, size: 12, color: { argb: 'FFFFFF' } };
    ws.getCell(`A${totalRow}`).fill = fillHeader;

    ws.getCell(`B${totalRow}`).value = { formula: `SUM(B${firstDataRow}:B${lastDataRow})` };
    ws.getCell(`B${totalRow}`).numFmt = currency;
    ws.getCell(`B${totalRow}`).font = { bold: true, size: 14, color: { argb: red } };
    ws.getCell(`B${totalRow}`).fill = fillHeader;

    ws.getCell(`C${totalRow}`).value = { formula: `SUM(C${firstDataRow}:C${lastDataRow})` };
    ws.getCell(`C${totalRow}`).numFmt = currency;
    ws.getCell(`C${totalRow}`).font = { bold: true, size: 14, color: { argb: green } };
    ws.getCell(`C${totalRow}`).fill = fillHeader;

    // % of volume row
    const pctRow = totalRow + 1;
    ws.getCell(`A${pctRow}`).value = '% of volume';
    ws.getCell(`A${pctRow}`).font = labelFont;
    ws.getCell(`B${pctRow}`).value = { formula: `IF(B8=0,0,B${totalRow}/B8)` };
    ws.getCell(`B${pctRow}`).numFmt = pct;
    ws.getCell(`B${pctRow}`).font = cardFont;
    ws.getCell(`C${pctRow}`).value = { formula: `IF(B8=0,0,C${totalRow}/B8)` };
    ws.getCell(`C${pctRow}`).numFmt = pct;
    ws.getCell(`C${pctRow}`).font = stableFont;

    // ── Summary section (right side, rows 3-10) ──
    ws.getCell('E3').value = 'Annual Savings';
    ws.getCell('E3').font = { bold: true, size: 10, color: { argb: green } };
    ws.getCell('F3').value = { formula: `B${totalRow}-C${totalRow}` };
    ws.getCell('F3').numFmt = currency;
    ws.getCell('F3').font = { bold: true, size: 16, color: { argb: green } };
    ws.getCell('F3').fill = fillRow;

    ws.getCell('E4').value = 'Savings vs Cards';
    ws.getCell('E4').font = labelFont;
    ws.getCell('F4').value = { formula: `IF(B${totalRow}=0,0,(B${totalRow}-C${totalRow})/B${totalRow})` };
    ws.getCell('F4').numFmt = pct;
    ws.getCell('F4').font = { bold: true, size: 11, color: { argb: green } };

    ws.getCell('E6').value = 'Current Profit';
    ws.getCell('E6').font = labelFont;
    ws.getCell('F6').value = { formula: 'B8*B6' };
    ws.getCell('F6').numFmt = currency;
    ws.getCell('F6').font = { size: 11, color: { argb: '888888' } };

    ws.getCell('E7').value = 'New Profit';
    ws.getCell('E7').font = labelFont;
    ws.getCell('F7').value = { formula: `F6+F3` };
    ws.getCell('F7').numFmt = currency;
    ws.getCell('F7').font = { bold: true, size: 11, color: { argb: green } };

    ws.getCell('E8').value = 'Profit Increase';
    ws.getCell('E8').font = labelFont;
    ws.getCell('F8').value = { formula: 'IF(F6=0,0,F3/F6)' };
    ws.getCell('F8').numFmt = pct;
    ws.getCell('F8').font = { bold: true, size: 11, color: { argb: green } };

    ws.getCell('E10').value = 'Even with 5% adoption';
    ws.getCell('E10').font = { italic: true, size: 9, color: { argb: '888888' } };
    ws.getCell('F10').value = { formula: 'F3*0.05' };
    ws.getCell('F10').numFmt = currency;
    ws.getCell('F10').font = { size: 11, color: { argb: green } };

    // ── Disclaimer ──
    const disclaimerRow = pctRow + 2;
    ws.getCell(`A${disclaimerRow}`).value = 'Estimates based on typical e-commerce card-not-present rates. Actual costs vary by merchant category, processor, and card mix.';
    ws.getCell(`A${disclaimerRow}`).font = { italic: true, size: 8, color: { argb: '555555' } };

    // Download
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'checkout-cost-comparison.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatCurrency = (num: number): string => {
    if (num === 0) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  const formatPercent = (num: number): string => num.toFixed(2) + '%';

  return (
    <>
      <SEO
        title="Merchant Savings Calculator - Compare Card vs Stablecoin Payment Costs"
        description="Calculate how much you can save by accepting stablecoin payments instead of traditional card payments. Compare interchange fees, network fees, chargeback costs, and more."
        structuredData={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          "name": "Merchant Savings Calculator",
          "description": "Interactive calculator comparing traditional card payment costs vs stablecoin escrow payment costs for online merchants",
          "applicationCategory": "FinanceApplication",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "USD"
          }
        }}
      />

      <div style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        color: '#e8e8e8',
        fontFamily: "'IBM Plex Mono', monospace",
        padding: '20px 20px',
        margin: '0 auto'
      }}>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Space+Grotesk:wght@400;500;700&display=swap');

          input[type="range"] {
            -webkit-appearance: none;
            width: 100%;
            height: 4px;
            background: #333;
            border-radius: 2px;
            outline: none;
          }

          input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 20px;
            height: 20px;
            background: #00ff88;
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
          }

          input[type="range"]::-moz-range-thumb {
            width: 20px;
            height: 20px;
            background: #00ff88;
            border-radius: 50%;
            cursor: pointer;
            border: none;
            box-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
          }

          .calculator-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
          }

          @media (max-width: 968px) {
            .calculator-grid {
              grid-template-columns: 1fr;
            }

            .mobile-scroll {
              overflow-x: auto;
              -webkit-overflow-scrolling: touch;
            }

            .mobile-text-sm {
              font-size: 0.9rem !important;
            }

            .mobile-padding-sm {
              padding: 10px 15px !important;
            }
          }

          @media (max-width: 640px) {
            .comparison-table {
              font-size: 0.85rem;
            }

            .comparison-table-value {
              font-size: 1.1rem !important;
            }

            .savings-title {
              font-size: 1.75rem !important;
            }

            .page-header h1 {
              font-size: 1.5rem !important;
            }

            .input-field {
              font-size: 1rem !important;
              padding: 8px 12px !important;
            }

            .result-box {
              padding: 16px !important;
            }

            .table-cell-padding {
              padding: 8px 10px !important;
            }

            .table-header-padding {
              padding: 10px 12px !important;
            }

            .table-total-padding {
              padding: 15px 12px !important;
            }

            .mobile-footer {
              font-size: 0.75rem !important;
              line-height: 1.5 !important;
            }

            .comparison-table {
              min-width: 500px !important;
            }

            .scroll-hint {
              display: block !important;
              text-align: center;
              padding: 8px;
              background: #1a1a1a;
              color: #666;
              font-size: 0.7rem;
              border-bottom: 1px solid #222;
            }

            /* Hide desktop table on mobile */
            .desktop-comparison {
              display: none !important;
            }

            /* Show mobile cards on mobile */
            .mobile-comparison {
              display: block !important;
            }
          }

          /* Hide mobile cards on desktop */
          .mobile-comparison {
            display: none;
          }
        `}</style>

        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <header className="page-header" style={{ marginBottom: '20px' }}>
            <h1 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '1.75rem',
              fontWeight: 700,
              margin: 0,
              letterSpacing: '-1px'
            }}>
              Checkout Cost Calculator
            </h1>
            <p style={{
              color: '#666',
              fontSize: '0.8rem',
              marginTop: '6px'
            }}>
              See what you're really paying for
            </p>
          </header>

          {/* Inputs and Results Side-by-Side */}
          <div className="calculator-grid" style={{
            marginBottom: '30px'
          }}>
            {/* Left: Inputs */}
            <div style={{
              padding: '20px',
              background: '#111',
              borderRadius: '12px',
              border: '1px solid #222',
              display: 'flex',
              flexDirection: 'column',
              gap: '15px'
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: '10px' }}>
                  <span style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Monthly Card Volume
                  </span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={monthlyVolume === 0 ? '' : formatCurrency(monthlyVolume)}
                  placeholder="$0"
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setMonthlyVolume(val ? Number(val) : 0);
                  }}
                  style={{
                    width: '100%',
                    maxWidth: '250px',
                    padding: '8px 12px',
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    color: '#00ff88',
                    background: '#0a0a0a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    outline: 'none',
                    fontFamily: "'IBM Plex Mono', monospace",
                    marginBottom: '6px'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#00ff88'}
                  onBlur={(e) => e.target.style.borderColor = '#333'}
                />
                <input
                  type="range"
                  min="1000"
                  max="50000000"
                  step="10000"
                  value={Math.min(monthlyVolume, 50000000)}
                  onChange={(e) => setMonthlyVolume(Number(e.target.value))}
                />
                <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '5px' }}>
                  Slider: $1k - $50M (type for higher amounts)
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '10px' }}>
                  <span style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Average Transaction
                  </span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={avgTransaction === 0 ? '' : formatCurrency(avgTransaction)}
                  placeholder="$0"
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setAvgTransaction(val ? Number(val) : 0);
                  }}
                  style={{
                    width: '100%',
                    maxWidth: '140px',
                    padding: '8px 12px',
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    color: '#00ff88',
                    background: '#0a0a0a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    outline: 'none',
                    fontFamily: "'IBM Plex Mono', monospace",
                    marginBottom: '6px'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#00ff88'}
                  onBlur={(e) => e.target.style.borderColor = '#333'}
                />
                <input
                  type="range"
                  min="10"
                  max="5000"
                  step="10"
                  value={Math.min(avgTransaction, 5000)}
                  onChange={(e) => setAvgTransaction(Number(e.target.value))}
                />
                <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '5px' }}>
                  Slider: $10 - $5k (type for higher amounts)
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '10px' }}>
                  <span style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Chargeback Rate
                  </span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={chargebackRate === 0 ? '' : `${chargebackRate}%`}
                  placeholder="0%"
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.]/g, '');
                    setChargebackRate(val ? Number(val) : 0);
                  }}
                  style={{
                    width: '100%',
                    maxWidth: '100px',
                    padding: '8px 12px',
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    color: '#00ff88',
                    background: '#0a0a0a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    outline: 'none',
                    fontFamily: "'IBM Plex Mono', monospace",
                    marginBottom: '6px'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#00ff88'}
                  onBlur={(e) => e.target.style.borderColor = '#333'}
                />
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={Math.min(chargebackRate, 5)}
                  onChange={(e) => setChargebackRate(Number(e.target.value))}
                />
                <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '5px' }}>
                  Slider: 0% - 5% (type for higher rates)
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '10px' }}>
                  <span style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Current Profit Margin
                  </span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={profitMargin ? `${profitMargin}%` : ''}
                  placeholder="0%"
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.]/g, '');
                    setProfitMargin(val ? Number(val) : null);
                  }}
                  style={{
                    width: '100%',
                    maxWidth: '120px',
                    padding: '8px 12px',
                    fontSize: '1.1rem',
                    fontWeight: 600,
                    color: profitMargin ? '#00ff88' : '#666',
                    background: '#0a0a0a',
                    border: '1px solid #333',
                    borderRadius: '8px',
                    outline: 'none',
                    fontFamily: "'IBM Plex Mono', monospace",
                    marginBottom: '6px'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#00ff88'}
                  onBlur={(e) => e.target.style.borderColor = '#333'}
                />
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="0.5"
                  value={profitMargin || 0}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setProfitMargin(val === 0 ? null : val);
                  }}
                />
                <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '5px' }}>
                  Slider: 0% - 50% (type for higher margins)
                </div>
              </div>
            </div>

            {/* Right: Key Results */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {/* Annual Savings */}
              <div className="result-box" style={{
                background: 'linear-gradient(135deg, #001a0d 0%, #0a0a0a 100%)',
                borderRadius: '12px',
                border: '2px solid #00ff88',
                padding: '20px',
                textAlign: 'center',
                boxShadow: '0 0 60px rgba(0, 255, 136, 0.1)',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center'
              }}>
                <div style={{
                  color: '#00ff88',
                  fontSize: '0.65rem',
                  textTransform: 'uppercase',
                  letterSpacing: '2px',
                  marginBottom: '8px'
                }}>
                  Annual Savings
                </div>
                <div className="savings-title" style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: '2.25rem',
                  fontWeight: 700,
                  color: '#00ff88',
                  textShadow: '0 0 40px rgba(0, 255, 136, 0.5)',
                  marginBottom: '4px'
                }}>
                  {formatCurrency(calculations.annualSavings)}
                </div>
                <div style={{
                  color: '#888',
                  fontSize: '0.8rem'
                }}>
                  {formatPercent(calculations.savingsPercent)} less than cards
                </div>

                {calculations.currentProfit && (
                  <div style={{
                    marginTop: '15px',
                    paddingTop: '15px',
                    borderTop: '1px solid #1a3d2a'
                  }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '12px',
                      textAlign: 'center'
                    }}>
                      <div>
                        <div style={{ color: '#666', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                          Current Profit
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#888' }}>
                          {formatCurrency(calculations.currentProfit)}
                        </div>
                      </div>
                      <div>
                        <div style={{ color: '#666', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                          New Profit
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#00ff88' }}>
                          {formatCurrency(calculations.newProfit!)}
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ color: '#666', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                        Profit Increase
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#00ff88' }}>
                        +{formatPercent(calculations.profitIncrease!)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Stats */}
              <div style={{
                background: '#111',
                borderRadius: '12px',
                border: '1px solid #222',
                padding: '15px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '15px'
              }}>
                <div>
                  <div style={{ color: '#666', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                    Card Processing
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#ff4444' }}>
                    {formatCurrency(calculations.traditionalTotal)}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#888', marginTop: '2px' }}>
                    {formatPercent(calculations.traditionalPercent)} of volume
                  </div>
                </div>
                <div>
                  <div style={{ color: '#666', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                    Stablecoin
                  </div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#00ff88' }}>
                    {formatCurrency(calculations.stablecoinTotal)}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#888', marginTop: '2px' }}>
                    {formatPercent(calculations.stablecoinPercent)} of volume
                  </div>
                </div>
              </div>

              {/* Partial Adoption */}
              <div style={{
                background: '#111',
                borderRadius: '12px',
                border: '1px solid #222',
                padding: '12px 15px',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: '4px' }}>
                  Even with just 5% adoption
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#00ff88' }}>
                  {formatCurrency(calculations.annualSavings * 0.05)}/year saved
                </div>
              </div>

              {/* CTA Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <a
                  href="/plugins"
                  style={{
                    flex: 1,
                    display: 'block',
                    background: 'linear-gradient(135deg, #00ff88 0%, #00cc6a 100%)',
                    color: '#0a0a0a',
                    textDecoration: 'none',
                    padding: '14px 24px',
                    borderRadius: '12px',
                    textAlign: 'center',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    fontFamily: "'Space Grotesk', sans-serif",
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    boxShadow: '0 0 30px rgba(0, 255, 136, 0.3)',
                    transition: 'all 0.3s ease',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 5px 40px rgba(0, 255, 136, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 0 30px rgba(0, 255, 136, 0.3)';
                  }}
                >
                  Find out more
                </a>
                <button
                  onClick={exportSpreadsheet}
                  style={{
                    background: '#1a1a1a',
                    color: '#e8e8e8',
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: '1px solid #333',
                    cursor: 'pointer',
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    transition: 'all 0.3s ease',
                    whiteSpace: 'nowrap'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#00ff88';
                    e.currentTarget.style.color = '#00ff88';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#333';
                    e.currentTarget.style.color = '#e8e8e8';
                  }}
                  title="Download as spreadsheet"
                >
                  Export
                </button>
              </div>
            </div>
          </div>

          {/* Desktop comparison table */}
          <div className="desktop-comparison" style={{
            background: '#111',
            borderRadius: '12px',
            border: '1px solid #222',
            overflow: 'hidden',
            marginBottom: '40px'
          }}>
            <div className="comparison-table" style={{ minWidth: '600px' }}>
            {/* Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr',
              background: '#1a1a1a',
              borderBottom: '1px solid #333'
            }}>
              <div className="table-header-padding" style={{ padding: '15px 20px' }}>
                <span style={{
                  color: '#666',
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  Cost Category
                </span>
              </div>
              <div className="table-header-padding" style={{
                padding: '15px 20px',
                textAlign: 'right',
                borderLeft: '1px solid #333'
              }}>
                <span style={{
                  color: '#ff4444',
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontWeight: 600
                }}>
                  Card Payment
                </span>
              </div>
              <div className="table-header-padding" style={{
                padding: '15px 20px',
                textAlign: 'right',
                borderLeft: '1px solid #333'
              }}>
                <span style={{
                  color: '#00ff88',
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontWeight: 600
                }}>
                  Stablecoin
                </span>
              </div>
            </div>

            {/* Rows */}
            {calculations.rows.map((row, i) => (
              <div
                key={row.label}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr',
                  borderBottom: i < calculations.rows.length - 1 ? '1px solid #222' : 'none',
                  background: row.highlight && row.traditional > 0 ? 'rgba(255, 68, 68, 0.03)' : 'transparent'
                }}
              >
                <div className="table-cell-padding" style={{ padding: '12px 20px' }}>
                  <div style={{ fontWeight: 500, marginBottom: '2px' }}>{row.label}</div>
                </div>
                <div className="table-cell-padding" style={{
                  padding: '12px 20px',
                  textAlign: 'right',
                  borderLeft: '1px solid #222'
                }}>
                  <div style={{
                    fontWeight: 600,
                    color: row.traditional > 0 ? '#ff4444' : '#444'
                  }}>
                    {formatCurrency(row.traditional)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '2px' }}>
                    {row.traditionalNote}
                  </div>
                </div>
                <div className="table-cell-padding" style={{
                  padding: '12px 20px',
                  textAlign: 'right',
                  borderLeft: '1px solid #222'
                }}>
                  <div style={{
                    fontWeight: 600,
                    color: row.stablecoin > 0 ? '#e8e8e8' : '#00ff88'
                  }}>
                    {formatCurrency(row.stablecoin)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '2px' }}>
                    {row.stablecoinNote}
                  </div>
                </div>
              </div>
            ))}

            {/* Totals */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr',
              background: '#1a1a1a',
              borderTop: '2px solid #333'
            }}>
              <div className="table-total-padding" style={{ padding: '20px' }}>
                <span style={{
                  fontWeight: 600,
                  fontSize: '1rem'
                }}>
                  Annual Total
                </span>
                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>
                  on {formatCurrency(calculations.yearlyVolume)} volume
                </div>
              </div>
              <div className="table-total-padding" style={{
                padding: '20px',
                textAlign: 'right',
                borderLeft: '1px solid #333'
              }}>
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: '#ff4444'
                }}>
                  {formatCurrency(calculations.traditionalTotal)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#888' }}>
                  {formatPercent(calculations.traditionalPercent)} of volume
                </div>
              </div>
              <div className="table-total-padding" style={{
                padding: '20px',
                textAlign: 'right',
                borderLeft: '1px solid #333'
              }}>
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: '#00ff88'
                }}>
                  {formatCurrency(calculations.stablecoinTotal)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#888' }}>
                  {formatPercent(calculations.stablecoinPercent)} of volume
                </div>
              </div>
            </div>
            </div>
          </div>

          {/* Mobile card-based comparison */}
          <div className="mobile-comparison" style={{ marginBottom: '40px' }}>
            {/* Header Summary */}
            <div style={{
              background: '#1a1a1a',
              borderRadius: '12px 12px 0 0',
              border: '1px solid #222',
              padding: '15px 20px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '15px',
              marginBottom: '2px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  color: '#ff4444',
                  fontSize: '0.65rem',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontWeight: 600,
                  marginBottom: '5px'
                }}>
                  Card Payment
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#ff4444' }}>
                  {formatCurrency(calculations.traditionalTotal)}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '2px' }}>
                  {formatPercent(calculations.traditionalPercent)} of volume
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  color: '#00ff88',
                  fontSize: '0.65rem',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  fontWeight: 600,
                  marginBottom: '5px'
                }}>
                  Stablecoin
                </div>
                <div style={{ fontSize: '1.3rem', fontWeight: 700, color: '#00ff88' }}>
                  {formatCurrency(calculations.stablecoinTotal)}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '2px' }}>
                  {formatPercent(calculations.stablecoinPercent)} of volume
                </div>
              </div>
            </div>

            {/* Cost breakdown cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {calculations.rows.map((row, i) => (
                <div
                  key={row.label}
                  style={{
                    background: row.highlight && row.traditional > 0 ? 'rgba(255, 68, 68, 0.05)' : '#111',
                    border: '1px solid #222',
                    borderRadius: i === 0 ? '0' : i === calculations.rows.length - 1 ? '0 0 12px 12px' : '0',
                    padding: '15px 20px'
                  }}
                >
                  {/* Category name */}
                  <div style={{
                    fontWeight: 600,
                    marginBottom: '12px',
                    fontSize: '0.9rem',
                    color: '#e8e8e8'
                  }}>
                    {row.label}
                  </div>

                  {/* Card vs Stablecoin comparison */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '15px'
                  }}>
                    {/* Card payment */}
                    <div>
                      <div style={{
                        fontSize: '0.65rem',
                        color: '#ff4444',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        marginBottom: '5px'
                      }}>
                        Card
                      </div>
                      <div style={{
                        fontSize: '1.1rem',
                        fontWeight: 600,
                        color: row.traditional > 0 ? '#ff4444' : '#444',
                        marginBottom: '4px'
                      }}>
                        {formatCurrency(row.traditional)}
                      </div>
                      <div style={{
                        fontSize: '0.7rem',
                        color: '#666',
                        lineHeight: 1.4
                      }}>
                        {row.traditionalNote}
                      </div>
                    </div>

                    {/* Stablecoin */}
                    <div>
                      <div style={{
                        fontSize: '0.65rem',
                        color: '#00ff88',
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        marginBottom: '5px'
                      }}>
                        Stablecoin
                      </div>
                      <div style={{
                        fontSize: '1.1rem',
                        fontWeight: 600,
                        color: row.stablecoin > 0 ? '#e8e8e8' : '#00ff88',
                        marginBottom: '4px'
                      }}>
                        {formatCurrency(row.stablecoin)}
                      </div>
                      <div style={{
                        fontSize: '0.7rem',
                        color: '#666',
                        lineHeight: 1.4
                      }}>
                        {row.stablecoinNote}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals footer */}
            <div style={{
              background: '#1a1a1a',
              borderRadius: '0 0 12px 12px',
              border: '1px solid #222',
              borderTop: '2px solid #333',
              padding: '20px',
              marginTop: '2px'
            }}>
              <div style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                marginBottom: '15px',
                textAlign: 'center',
                color: '#888'
              }}>
                Annual Total on {formatCurrency(calculations.yearlyVolume)} volume
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '15px'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.65rem', color: '#666', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Card Total
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ff4444' }}>
                    {formatCurrency(calculations.traditionalTotal)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '4px' }}>
                    {formatPercent(calculations.traditionalPercent)}
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '0.65rem', color: '#666', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Stablecoin Total
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#00ff88' }}>
                    {formatCurrency(calculations.stablecoinTotal)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#888', marginTop: '4px' }}>
                    {formatPercent(calculations.stablecoinPercent)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <footer className="mobile-footer" style={{
            marginTop: '50px',
            padding: '20px',
            borderTop: '1px solid #222',
            color: '#555',
            fontSize: '0.7rem',
            lineHeight: 1.6
          }}>
            <p style={{ margin: 0 }}>
              Estimates based on typical e-commerce card-not-present rates. Actual costs vary by merchant category,
              processor, and card mix. Traditional costs assume: interchange (~2%), network fees (0.14%),
              processor markup (0.4%), per-transaction fees ($0.25), PCI compliance ($300/yr),
              chargeback fees ($20 each), estimated fraud losses (0.5% of volume), and opportunity cost
              of 3-day settlement float at 8% annual rate.
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}
